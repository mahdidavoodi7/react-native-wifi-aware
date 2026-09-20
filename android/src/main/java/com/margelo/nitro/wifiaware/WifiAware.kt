package com.margelo.nitro.wifiaware

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.aware.WifiAwareManager
import android.os.Build
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.wifiaware.support.AwareAttachment
import com.margelo.nitro.wifiaware.support.ListenerStore
import com.margelo.nitro.wifiaware.support.WifiAwareFailure
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Root of the Wi-Fi Aware API on Android.
 *
 * Must stay usable on API levels below the Wi-Fi Aware minimum, because Nitro instantiates it as
 * soon as JS imports the module. Every framework call is therefore version-gated, and unsupported
 * devices get a descriptive error rather than a crash.
 */
@Keep
@DoNotStrip
class WifiAware : HybridWifiAwareSpec() {
  private val availabilityListeners = ListenerStore<Availability>()
  private val pairedDeviceListeners = ListenerStore<Array<PairedDevice>>()
  private val executor = Executors.newSingleThreadExecutor()

  private var availabilityReceiver: BroadcastReceiver? = null

  /** Whether this device is new enough and has the hardware. */
  private val isSupported: Boolean
    get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AwareAttachment.hasFeature

  private val characteristics
    get() =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        AwareAttachment.manager?.characteristics
      } else {
        null
      }

  /** Whether this device's radio exposes NAN pairing. Vendor-gated, not an API-level check. */
  private val isPairingSupported: Boolean
    get() =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
        (characteristics?.isAwarePairingSupported ?: false)

  // MARK: - Capabilities

  override fun getCapabilities(): Promise<Capabilities> =
    Promise.async {
      if (!isSupported) {
        return@async Capabilities(
          isSupported = false,
          maxConnectableDevices = null,
          maxPublishableServices = null,
          maxSubscribableServices = null,
          maxServiceNameLength = null,
          maxServiceSpecificInfoLength = null,
          isPairingUISupported = false,
          isProgrammaticPairingSupported = false,
          isCrossPlatformPairingSupported = false,
        )
      }

      // Characteristics is null while the radio is unavailable, even on capable hardware, so every
      // figure derived from it stays absent rather than being guessed.
      val current = characteristics
      val pairingSupported = isPairingSupported

      Capabilities(
        isSupported = true,
        maxConnectableDevices = current?.numberOfSupportedDataPaths?.toDouble(),
        maxPublishableServices = current?.numberOfSupportedPublishSessions?.toDouble(),
        maxSubscribableServices = current?.numberOfSupportedSubscribeSessions?.toDouble(),
        maxServiceNameLength = current?.maxServiceNameLength?.toDouble(),
        maxServiceSpecificInfoLength = current?.maxServiceSpecificInfoLength?.toDouble(),
        // Pairing here is app-driven; there is no system pairing UI to present.
        isPairingUISupported = false,
        isProgrammaticPairingSupported = pairingSupported,
        // Reports a radio capability only. It does not mean pairing with another ecosystem works.
        isCrossPlatformPairingSupported = pairingSupported,
      )
    }

  override fun getAvailability(): Promise<Availability> =
    Promise.async { currentAvailability() }

  private fun currentAvailability(): Availability {
    if (!isSupported) {
      return Availability(
        isAvailable = false,
        availableDataPaths = null,
        availablePublishSessions = null,
        availableSubscribeSessions = null,
      )
    }

    val manager = AwareAttachment.manager
    val resources =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        manager?.availableAwareResources
      } else {
        null
      }

    return Availability(
      isAvailable = manager?.isAvailable ?: false,
      availableDataPaths = resources?.availableDataPathsCount?.toDouble(),
      availablePublishSessions = resources?.availablePublishSessionsCount?.toDouble(),
      availableSubscribeSessions = resources?.availableSubscribeSessionsCount?.toDouble(),
    )
  }

  override fun addOnAvailabilityChangedListener(
    listener: (availability: Availability) -> Unit
  ): ListenerSubscription {
    val subscription = availabilityListeners.add(listener)
    startWatchingAvailability()
    return subscription
  }

  /** Registers the broadcast receiver once, on first subscription. */
  private fun startWatchingAvailability() {
    if (!isSupported || availabilityReceiver != null) return
    val context = AwareAttachment.context ?: return

    val receiver =
      object : BroadcastReceiver() {
        override fun onReceive(receivedContext: Context?, intent: Intent?) {
          availabilityListeners.emit(currentAvailability())
        }
      }

    val filter =
      IntentFilter(WifiAwareManager.ACTION_WIFI_AWARE_STATE_CHANGED).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          addAction(WifiAwareManager.ACTION_WIFI_AWARE_RESOURCE_CHANGED)
        }
      }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag") context.registerReceiver(receiver, filter)
    }
    availabilityReceiver = receiver
  }

  // MARK: - Pairing

  override fun presentPairingUI(options: PairingUIOptions): Promise<PairedDevice?> {
    throw WifiAwareFailure.error(
      WifiAwareErrorCode.UNSUPPORTED_OPERATION,
      "This platform has no system pairing UI. Pairing here is app-driven: use " +
        "getProgrammaticPairing(), and branch on Capabilities.isPairingUISupported.",
    )
  }

  override fun getProgrammaticPairing(): Promise<HybridProgrammaticPairingSpec> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.PROGRAMMATIC_PAIRING_UNSUPPORTED,
        "Wi-Fi Aware pairing requires a newer version of Android than this device runs.",
      )
    }
    if (!isPairingSupported) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.PROGRAMMATIC_PAIRING_UNSUPPORTED,
        "This device's radio does not expose Wi-Fi Aware pairing. Support is decided by the " +
          "hardware vendor, so it varies between devices running the same version of Android.",
      )
    }
    return Promise.async { WifiAwareProgrammaticPairing() }
  }

  override fun getPairedDevices(): Promise<Array<PairedDevice>> =
    Promise.async { fetchPairedDevices() }

  private suspend fun fetchPairedDevices(): Array<PairedDevice> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return emptyArray()
    val manager = AwareAttachment.manager ?: return emptyArray()

    val aliases =
      suspendCancellableCoroutine<List<String>> { continuation ->
        try {
          manager.getPairedDevices(executor) { list ->
            if (continuation.isActive) continuation.resume(list)
          }
        } catch (throwable: Throwable) {
          if (continuation.isActive) continuation.resume(emptyList())
        }
      }

    // The platform identifies a pairing by the alias the app chose when it paired.
    return aliases
      .map { alias -> PairedDevice(id = alias, displayName = alias, pairingInfo = null) }
      .toTypedArray()
  }

  override fun addOnPairedDevicesChangedListener(
    listener: (devices: Array<PairedDevice>) -> Unit
  ): ListenerSubscription {
    val subscription = pairedDeviceListeners.add(listener)
    // The platform broadcasts no pairing-change event, so the current set is delivered once on
    // subscription and again after this library changes it.
    Promise.async { pairedDeviceListeners.emit(fetchPairedDevices()) }
    return subscription
  }

  override fun removePairedDevice(deviceId: String): Promise<Unit> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.UNSUPPORTED_OPERATION,
        "Removing a pairing requires a newer version of Android than this device runs.",
      )
    }
    val manager =
      AwareAttachment.manager
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.UNSUPPORTED,
          "The Wi-Fi Aware system service is not available on this device.",
        )

    return Promise.async {
      manager.removePairedDevice(deviceId)
      pairedDeviceListeners.emit(fetchPairedDevices())
    }
  }

  // MARK: - Discovery

  override fun publish(options: PublishOptions): Promise<HybridPublishSessionSpec> {
    assertDataPathSupported()
    return Promise.async { WifiAwarePublishSession.start(options) }
  }

  override fun subscribe(options: SubscribeOptions): Promise<HybridSubscribeSessionSpec> {
    assertDataPathSupported()
    return Promise.async { WifiAwareSubscribeSession.start(options) }
  }

  /** Data paths need a newer API level than discovery alone. */
  private fun assertDataPathSupported() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.UNSUPPORTED,
        "Wi-Fi Aware data paths require a newer version of Android than this device runs.",
      )
    }
    if (!isSupported) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.UNSUPPORTED,
        "This device does not support Wi-Fi Aware.",
      )
    }
  }

}
