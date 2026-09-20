package com.margelo.nitro.wifiaware

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.aware.DiscoverySessionCallback
import android.net.wifi.aware.PeerHandle
import android.net.wifi.aware.ServiceDiscoveryInfo
import android.net.wifi.aware.SubscribeConfig
import android.net.wifi.aware.SubscribeDiscoverySession
import android.net.wifi.aware.WifiAwareNetworkInfo
import android.net.wifi.aware.WifiAwareNetworkSpecifier
import android.os.Build
import androidx.annotation.Keep
import androidx.annotation.RequiresApi
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise
import com.margelo.nitro.wifiaware.support.AwareAttachment
import com.margelo.nitro.wifiaware.support.ListenerStore
import com.margelo.nitro.wifiaware.support.BootstrappingMethods
import com.margelo.nitro.wifiaware.support.PairingEvents
import com.margelo.nitro.wifiaware.support.PeerRegistry
import com.margelo.nitro.wifiaware.support.ServiceNameValidator
import com.margelo.nitro.wifiaware.support.WifiAwareFailure
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout

/**
 * An active search for peers advertising a service.
 *
 * The subscriber is the active side: it discovers peers, then dials the socket the publisher is
 * listening on. The publisher's port arrives inside the encrypted network specifier, so both sides
 * must supply the same data-path secret.
 */
@Keep
@DoNotStrip
@RequiresApi(Build.VERSION_CODES.Q)
class WifiAwareSubscribeSession
private constructor(override val serviceName: String) : HybridSubscribeSessionSpec() {
  private val stopped = AtomicBoolean(false)
  private var discoverySession: SubscribeDiscoverySession? = null

  /** Peers currently visible, keyed by the identifier handed to JS. */
  private val peers = ConcurrentHashMap<String, PeerHandle>()

  private val peerFoundListeners = ListenerStore<DiscoveredPeer>()
  private val peerLostListeners = ListenerStore<String>()
  private val errorListeners = ListenerStore<WifiAwareErrorInfo>()
  private val stoppedListeners = ListenerStore<Unit>()
  private val discoveryMessageListeners = ListenerStore<Pair<String, ArrayBuffer>>()

  override val isActive: Boolean
    get() = !stopped.get()

  companion object {
    /** Default budget for establishing a data path when the caller gives none. */
    private const val DEFAULT_CONNECT_TIMEOUT_MS = 30_000L

    /** Starts searching, resolving once discovery is live. */
    suspend fun start(options: SubscribeOptions): WifiAwareSubscribeSession {
      ServiceNameValidator.assertValid(options.serviceName)

      val awareSession = AwareAttachment.session()
      val session = WifiAwareSubscribeSession(options.serviceName)

      val config =
        SubscribeConfig.Builder()
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
        suspendCancellableCoroutine<SubscribeDiscoverySession> { continuation ->
          awareSession.subscribe(
            config,
            object : DiscoverySessionCallback() {
              override fun onSubscribeStarted(subscribeSession: SubscribeDiscoverySession) {
                if (continuation.isActive) continuation.resume(subscribeSession)
              }

              override fun onSessionConfigFailed() {
                if (continuation.isActive) {
                  continuation.resumeWithException(
                    WifiAwareFailure.error(
                      WifiAwareErrorCode.SESSION_CONFIG_FAILED,
                      "The system rejected the subscribe configuration for " +
                        "\"${options.serviceName}\".",
                    )
                  )
                }
              }

              override fun onServiceDiscovered(info: ServiceDiscoveryInfo) {
                session.handleDiscovery(info)
              }

              override fun onServiceLost(peerHandle: PeerHandle, reason: Int) {
                val id = session.identifierFor(peerHandle)
                session.peers.remove(id)
                PeerRegistry.remove(id)
                session.peerLostListeners.emit(id)
              }

              override fun onMessageReceived(peerHandle: PeerHandle, message: ByteArray) {
                val id = session.identifierFor(peerHandle)
                session.discoveryMessageListeners.emit(id to ArrayBuffer.copy(message))
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
      return session
    }
  }

  /** Stable per-session identifier for a peer handle. */
  private fun identifierFor(handle: PeerHandle): String = handle.hashCode().toUInt().toString()

  private fun handleDiscovery(info: ServiceDiscoveryInfo) {
    val id = identifierFor(info.peerHandle)
    peers[id] = info.peerHandle
    val advertised =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        info.pairingConfig
      } else {
        null
      }
    discoverySession?.let { PeerRegistry.register(id, it, info.peerHandle, advertised) }

    val pairedAlias =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) info.pairedAlias else null

    peerFoundListeners.emit(
      DiscoveredPeer(
        id = id,
        displayName = pairedAlias,
        pairedDeviceId = pairedAlias,
        serviceSpecificInfo = info.serviceSpecificInfo?.let { ArrayBuffer.copy(it) },
      )
    )
  }

  private fun markStopped() {
    if (!stopped.compareAndSet(false, true)) return
    stoppedListeners.emit(Unit)
  }

  // MARK: - HybridSubscribeSessionSpec

  override fun addOnPeerFoundListener(
    listener: (peer: DiscoveredPeer) -> Unit
  ): ListenerSubscription = peerFoundListeners.add(listener)

  override fun addOnPeerLostListener(listener: (peerId: String) -> Unit): ListenerSubscription =
    peerLostListeners.add(listener)

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
          "Peer \"$peerId\" is not currently visible to this session.",
        )
    val session =
      discoverySession
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.SESSION_TERMINATED,
          "This subscribe session has stopped.",
        )

    val payload = data.toByteArray().copyOf()
    return Promise.parallel { session.sendMessage(handle, 0, payload) }
  }

  override fun connect(peerId: String, options: ConnectionOptions?): Promise<HybridConnectionSpec> {
    val handle =
      peers[peerId]
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.DEVICE_NO_LONGER_AVAILABLE,
          "Peer \"$peerId\" is not currently visible to this session.",
        )
    val session =
      discoverySession
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.SESSION_TERMINATED,
          "This subscribe session has stopped.",
        )
    val passphrase =
      options?.passphrase
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.INVALID_ARGUMENT,
          "This platform requires an app-supplied data-path secret. Set " +
            "ConnectionOptions.passphrase to the same value the publisher used in " +
            "PublishOptions.passphrase.",
        )

    val timeout = options.timeoutMs?.toLong() ?: DEFAULT_CONNECT_TIMEOUT_MS

    return Promise.async {
      try {
        withTimeout(timeout) { openDataPath(session, handle, peerId, passphrase) }
      } catch (timeoutError: TimeoutCancellationException) {
        throw WifiAwareFailure.error(
          WifiAwareErrorCode.CONNECTION_FAILED,
          "The data path to \"$peerId\" did not become usable within the requested timeout.",
        )
      }
    }
  }

  /**
   * Requests a Wi-Fi Aware network to the peer and dials the socket it is listening on.
   *
   * The network request must stay registered for the lifetime of the data path, so it is released
   * from the connection's close handler rather than here.
   */
  private suspend fun openDataPath(
    session: SubscribeDiscoverySession,
    handle: PeerHandle,
    peerId: String,
    passphrase: String,
  ): HybridConnectionSpec {
    val context =
      AwareAttachment.context
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.UNAVAILABLE,
          "No application context is available.",
        )
    val connectivity =
      context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    val specifier =
      WifiAwareNetworkSpecifier.Builder(session, handle).setPskPassphrase(passphrase).build()

    val request =
      NetworkRequest.Builder()
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI_AWARE)
        .setNetworkSpecifier(specifier)
        .build()

    var registered: ConnectivityManager.NetworkCallback? = null

    try {
      return suspendCancellableCoroutine { continuation ->
        val callback =
          object : ConnectivityManager.NetworkCallback() {
            private var settled = false

            override fun onCapabilitiesChanged(
              network: Network,
              capabilities: NetworkCapabilities,
            ) {
              if (settled) return
              val info = capabilities.transportInfo as? WifiAwareNetworkInfo ?: return

              // The peer's link-local address is documented as possibly absent; without it there
              // is nothing to dial.
              val address =
                info.peerIpv6Addr
                  ?: run {
                    settled = true
                    continuation.resumeWithException(
                      WifiAwareFailure.error(
                        WifiAwareErrorCode.PEER_ADDRESS_UNAVAILABLE,
                        "The system did not report an address for peer \"$peerId\".",
                      )
                    )
                    return
                  }

              settled = true
              try {
                val socket: Socket = network.socketFactory.createSocket(address, info.port)
                continuation.resume(
                  // The network request must outlive this call and be released only when the
                  // data path closes, so the connection owns that cleanup.
                  WifiAwareConnection(socket, peerId) {
                    registered?.let { runCatching { connectivity.unregisterNetworkCallback(it) } }
                    registered = null
                  }
                )
              } catch (throwable: Throwable) {
                continuation.resumeWithException(
                  WifiAwareFailure.error(
                    WifiAwareErrorCode.CONNECTION_FAILED,
                    throwable.message ?: "Could not open a socket to peer \"$peerId\".",
                  )
                )
              }
            }

            override fun onUnavailable() {
              if (settled) return
              settled = true
              continuation.resumeWithException(
                WifiAwareFailure.error(
                  WifiAwareErrorCode.CONNECTION_FAILED,
                  "The system could not establish a Wi-Fi Aware data path to \"$peerId\".",
                )
              )
            }

            override fun onLost(network: Network) {
              if (settled) return
              settled = true
              continuation.resumeWithException(
                WifiAwareFailure.error(
                  WifiAwareErrorCode.DEVICE_NO_LONGER_AVAILABLE,
                  "The data path to \"$peerId\" was lost before it became usable.",
                )
              )
            }
          }

        registered = callback
        connectivity.requestNetwork(request, callback)

        continuation.invokeOnCancellation {
          runCatching { connectivity.unregisterNetworkCallback(callback) }
        }
      }
    } catch (throwable: Throwable) {
      // We never handed the request to a connection, so release it here.
      registered?.let { runCatching { connectivity.unregisterNetworkCallback(it) } }
      registered = null
      throw throwable
    }
  }

  override fun stop(): Promise<Unit> =
    Promise.parallel {
      if (stopped.get()) return@parallel
      discoverySession?.let { PeerRegistry.removeAll(it) }
      runCatching { discoverySession?.close() }
      markStopped()
    }
}
