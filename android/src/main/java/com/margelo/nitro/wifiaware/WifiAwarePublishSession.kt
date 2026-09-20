package com.margelo.nitro.wifiaware

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.aware.AwarePairingConfig
import android.net.wifi.aware.DiscoverySessionCallback
import android.net.wifi.aware.PeerHandle
import android.net.wifi.aware.PublishConfig
import android.net.wifi.aware.PublishDiscoverySession
import android.net.wifi.aware.WifiAwareNetworkSpecifier
import android.os.Build
import androidx.annotation.Keep
import androidx.annotation.RequiresApi
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise
import com.margelo.nitro.wifiaware.support.AwareAttachment
import com.margelo.nitro.wifiaware.support.BootstrappingMethods
import com.margelo.nitro.wifiaware.support.ListenerStore
import com.margelo.nitro.wifiaware.support.PairingEvents
import com.margelo.nitro.wifiaware.support.PeerRegistry
import com.margelo.nitro.wifiaware.support.ServiceNameValidator
import com.margelo.nitro.wifiaware.support.WifiAwareFailure
import java.net.ServerSocket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * An active advertisement, accepting inbound data paths.
 *
 * The publisher is the passive side: it advertises, asks the framework for a data path that any
 * paired peer may join, and listens on a socket. Each accepted socket becomes a
 * [WifiAwareConnection].
 *
 * The port is carried inside the encrypted Wi-Fi Aware network specifier, which is why a data-path
 * secret is mandatory here — `setPort` is only honoured on a secure link.
 */
@Keep
@DoNotStrip
@RequiresApi(Build.VERSION_CODES.Q)
class WifiAwarePublishSession
private constructor(
  override val serviceName: String,
  private val passphrase: String,
) : HybridPublishSessionSpec() {
  private val stopped = AtomicBoolean(false)

  private var discoverySession: PublishDiscoverySession? = null
  private var serverSocket: ServerSocket? = null
  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var acceptThread: Thread? = null

  /** Peers seen through the discovery message channel, so replies can be addressed. */
  private val peers = ConcurrentHashMap<String, PeerHandle>()

  private val connectionListeners = ListenerStore<HybridConnectionSpec>()
  private val errorListeners = ListenerStore<WifiAwareErrorInfo>()
  private val stoppedListeners = ListenerStore<Unit>()
  private val discoveryMessageListeners = ListenerStore<Pair<String, ArrayBuffer>>()

  override val isActive: Boolean
    get() = !stopped.get()

  companion object {
    /** Starts advertising, resolving once the advertisement is live and accepting connections. */
    suspend fun start(options: PublishOptions): WifiAwarePublishSession {
      ServiceNameValidator.assertValid(options.serviceName)

      val passphrase =
        options.passphrase
          ?: throw WifiAwareFailure.error(
            WifiAwareErrorCode.INVALID_ARGUMENT,
            "This platform requires an app-supplied data-path secret. Set " +
              "PublishOptions.passphrase, and give the connecting peer the identical value in " +
              "ConnectionOptions.passphrase.",
          )

      val awareSession = AwareAttachment.session()
      val session = WifiAwarePublishSession(options.serviceName, passphrase)

      val config =
        PublishConfig.Builder()
          .setServiceName(options.serviceName)
          .apply {
            options.serviceSpecificInfo?.let { setServiceSpecificInfo(it.toByteArray()) }
            options.activeDurationMs?.let { setTtlSec((it / 1000).toInt().coerceAtLeast(1)) }
            options.pairing?.let { pairing ->
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                setPairingConfig(pairing.toAwarePairingConfig())
              }
            }
          }
          .build()

      val discovery =
        suspendCancellableCoroutine<PublishDiscoverySession> { continuation ->
          awareSession.publish(
            config,
            object : DiscoverySessionCallback() {
              override fun onPublishStarted(publishSession: PublishDiscoverySession) {
                if (continuation.isActive) continuation.resume(publishSession)
              }

              override fun onSessionConfigFailed() {
                if (continuation.isActive) {
                  continuation.resumeWithException(
                    WifiAwareFailure.error(
                      WifiAwareErrorCode.SESSION_CONFIG_FAILED,
                      "The system rejected the publish configuration for " +
                        "\"${options.serviceName}\".",
                    )
                  )
                }
              }

              override fun onMessageReceived(peerHandle: PeerHandle, message: ByteArray) {
                val peerId = session.identifierFor(peerHandle)
                session.discoveryMessageListeners.emit(peerId to ArrayBuffer.copy(message))
              }

              override fun onPairingSetupRequestReceived(peerHandle: PeerHandle, requestId: Int) {
                session.identifierFor(peerHandle).let { id ->
                  PairingEvents.emitPairingRequest(
                    PairingRequest(requestId = requestId.toDouble(), peerId = id)
                  )
                }
              }

              override fun onBootstrappingSucceeded(peerHandle: PeerHandle, method: Int) {
                val id = session.identifierFor(peerHandle)
                BootstrappingMethods.fromBitmask(method).firstOrNull()?.let {
                  PairingEvents.emitBootstrapping(id, it)
                }
              }

              override fun onSessionTerminated() {
                session.markStopped()
              }
            },
            AwareAttachment.handler,
          )
        }

      session.discoverySession = discovery
      session.startAcceptingConnections(discovery)
      return session
    }
  }

  /** Stable per-session identifier for a peer handle. */
  private fun identifierFor(handle: PeerHandle): String {
    val id = handle.hashCode().toUInt().toString()
    peers[id] = handle
    discoverySession?.let { PeerRegistry.register(id, it, handle) }
    return id
  }

  /**
   * Opens a listening socket and asks the framework for a data path any paired peer may join.
   *
   * The publisher-only specifier constructor accepts a connection from any peer, so the publisher
   * does not need to have discovered the subscriber first.
   */
  private fun startAcceptingConnections(discovery: PublishDiscoverySession) {
    val context =
      AwareAttachment.context
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.UNAVAILABLE,
          "No application context is available.",
        )
    val connectivity =
      context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    val socket = ServerSocket(0)
    serverSocket = socket

    val specifier =
      WifiAwareNetworkSpecifier.Builder(discovery)
        .setPskPassphrase(passphrase)
        .setPort(socket.localPort)
        .build()

    val request =
      NetworkRequest.Builder()
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI_AWARE)
        .setNetworkSpecifier(specifier)
        .build()

    val callback =
      object : ConnectivityManager.NetworkCallback() {
        override fun onUnavailable() {
          errorListeners.emit(
            WifiAwareFailure.info(
              WifiAwareErrorCode.CONNECTION_FAILED,
              "The system could not provide a Wi-Fi Aware data path for this publisher.",
            )
          )
        }
      }
    networkCallback = callback
    connectivity.requestNetwork(request, callback)

    acceptThread =
      thread(start = true, isDaemon = true, name = "wifi-aware-accept") {
        try {
          while (!stopped.get() && !socket.isClosed) {
            val client = socket.accept()
            val peerId = client.inetAddress.hostAddress ?: "peer"
            connectionListeners.emit(WifiAwareConnection(client, peerId) {})
          }
        } catch (throwable: Throwable) {
          if (!stopped.get()) {
            errorListeners.emit(
              WifiAwareFailure.classify(throwable, WifiAwareErrorCode.CONNECTION_FAILED)
            )
          }
        }
      }
  }

  private fun markStopped() {
    if (!stopped.compareAndSet(false, true)) return
    stoppedListeners.emit(Unit)
  }

  // MARK: - HybridPublishSessionSpec

  override fun addOnConnectionListener(
    listener: (connection: HybridConnectionSpec) -> Unit
  ): ListenerSubscription = connectionListeners.add(listener)

  override fun addOnErrorListener(
    listener: (error: WifiAwareErrorInfo) -> Unit
  ): ListenerSubscription = errorListeners.add(listener)

  override fun addOnStoppedListener(listener: () -> Unit): ListenerSubscription =
    stoppedListeners.add { listener() }

  override fun addOnDiscoveryMessageListener(
    listener: (peerId: String, data: ArrayBuffer) -> Unit
  ): ListenerSubscription = discoveryMessageListeners.add { listener(it.first, it.second) }

  override fun sendDiscoveryMessage(peerId: String, data: ArrayBuffer): Promise<Unit> {
    val handle =
      peers[peerId]
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.DEVICE_NO_LONGER_AVAILABLE,
          "Peer \"$peerId\" has not messaged this session, so there is no handle to reply to.",
        )
    val session =
      discoverySession
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.SESSION_TERMINATED,
          "This publish session has stopped.",
        )

    val payload = data.toByteArray().copyOf()
    return Promise.parallel {
      // Discovery messages are best-effort by design: the platform reports the send attempt, not
      // delivery.
      session.sendMessage(handle, 0, payload)
    }
  }

  override fun stop(): Promise<Unit> =
    Promise.parallel {
      if (stopped.get()) return@parallel

      runCatching { serverSocket?.close() }
      discoverySession?.let { PeerRegistry.removeAll(it) }
      runCatching { discoverySession?.close() }

      networkCallback?.let { callback ->
        val connectivity =
          AwareAttachment.context?.getSystemService(Context.CONNECTIVITY_SERVICE)
            as? ConnectivityManager
        runCatching { connectivity?.unregisterNetworkCallback(callback) }
      }
      networkCallback = null

      markStopped()
    }
}

/** Builds the platform pairing configuration from the session options. */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
internal fun SessionPairingOptions.toAwarePairingConfig(): AwarePairingConfig =
  AwarePairingConfig.Builder()
    .setPairingSetupEnabled(enableSetup ?: false)
    .setPairingVerificationEnabled(enableVerification ?: false)
    .setPairingCacheEnabled(enableCache ?: false)
    .setBootstrappingMethods(
      BootstrappingMethods.toBitmask(
        bootstrappingMethods?.map { it.method } ?: emptyList()
      )
    )
    .build()
