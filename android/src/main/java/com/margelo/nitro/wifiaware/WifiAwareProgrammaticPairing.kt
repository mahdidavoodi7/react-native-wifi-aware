package com.margelo.nitro.wifiaware

import android.net.wifi.aware.Characteristics
import android.os.Build
import androidx.annotation.Keep
import androidx.annotation.RequiresApi
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.wifiaware.support.AwareAttachment
import com.margelo.nitro.wifiaware.support.BootstrappingMethods
import com.margelo.nitro.wifiaware.support.PairingEvents
import com.margelo.nitro.wifiaware.support.PeerRegistry
import com.margelo.nitro.wifiaware.support.WifiAwareFailure

/**
 * App-driven pairing.
 *
 * Only reachable through `WifiAware.getProgrammaticPairing()`, which fails on devices whose radio
 * does not expose NAN pairing — so holding an instance means these methods are genuinely usable.
 *
 * Pairing is driven through the discovery session that found the peer, which is why callers work
 * purely in terms of the peer identifier they were handed by a session.
 */
@Keep
@DoNotStrip
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
class WifiAwareProgrammaticPairing : HybridProgrammaticPairingSpec() {
  private companion object {
    /** Every bootstrapping flag this library understands. */
    const val ALL_BOOTSTRAPPING_METHODS = 0b1_1111_1111
  }

  override val supportedBootstrappingMethods: Array<BootstrappingMethod>
    // The platform exposes no per-device list, only the ability to request a method, so every
    // method this library understands is offered and an unsupported choice surfaces as a
    // bootstrapping failure.
    get() = BootstrappingMethods.fromBitmask(ALL_BOOTSTRAPPING_METHODS)

  override fun getSupportedMethods(peerId: String): Array<BootstrappingMethod> {
    val config = PeerRegistry.find(peerId)?.pairingConfig ?: return emptyArray()
    return BootstrappingMethods.fromBitmask(config.bootstrappingMethods)
  }

  private fun entryFor(peerId: String) =
    PeerRegistry.find(peerId)
      ?: throw WifiAwareFailure.error(
        WifiAwareErrorCode.DEVICE_NO_LONGER_AVAILABLE,
        "Peer \"$peerId\" is not currently visible to any active session.",
      )

  /**
   * The cipher suite to pair with.
   *
   * Pairing uses the dedicated PASN suites rather than the data-path suites, so the choice is made
   * from `getSupportedPairingCipherSuites()` and the strongest available is preferred.
   */
  private fun pairingCipherSuite(): Int {
    val supported =
      AwareAttachment.manager?.characteristics?.supportedPairingCipherSuites
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.PROGRAMMATIC_PAIRING_UNSUPPORTED,
          "This device reports no supported pairing cipher suites.",
        )

    return when {
      supported and Characteristics.WIFI_AWARE_CIPHER_SUITE_NCS_PK_PASN_256 != 0 ->
        Characteristics.WIFI_AWARE_CIPHER_SUITE_NCS_PK_PASN_256
      supported and Characteristics.WIFI_AWARE_CIPHER_SUITE_NCS_PK_PASN_128 != 0 ->
        Characteristics.WIFI_AWARE_CIPHER_SUITE_NCS_PK_PASN_128
      else ->
        throw WifiAwareFailure.error(
          WifiAwareErrorCode.PROGRAMMATIC_PAIRING_UNSUPPORTED,
          "This device supports no Wi-Fi Aware pairing cipher suite.",
        )
    }
  }

  // MARK: - HybridProgrammaticPairingSpec

  override fun requestBootstrapping(
    peerId: String,
    method: BootstrappingMethod,
  ): Promise<Unit> {
    val entry = entryFor(peerId)
    val flag = BootstrappingMethods.flagFor(method)

    return Promise.parallel {
      // Completion arrives asynchronously on addOnBootstrappingListener; this call only starts the
      // exchange.
      entry.session.initiateBootstrappingRequest(entry.handle, flag)
    }
  }

  override fun initiatePairing(options: InitiatePairingOptions): Promise<PairedDevice> {
    val entry = entryFor(options.peerId)
    val suite = pairingCipherSuite()

    return Promise.parallel {
      entry.session.initiatePairingRequest(
        entry.handle,
        options.alias,
        suite,
        options.password,
      )
      // The platform confirms through onPairingSetupSucceeded; the alias is the durable identity
      // and is what getPairedDevices() will subsequently report.
      PairedDevice(id = options.alias, displayName = options.alias, pairingInfo = null)
    }
  }

  override fun acceptPairingRequest(
    requestId: Double,
    options: InitiatePairingOptions,
  ): Promise<PairedDevice> {
    val entry = entryFor(options.peerId)
    val suite = pairingCipherSuite()

    return Promise.parallel {
      entry.session.acceptPairingRequest(
        requestId.toInt(),
        entry.handle,
        options.alias,
        suite,
        options.password,
      )
      PairedDevice(id = options.alias, displayName = options.alias, pairingInfo = null)
    }
  }

  override fun rejectPairingRequest(requestId: Double, peerId: String): Promise<Unit> {
    val entry = entryFor(peerId)
    return Promise.parallel { entry.session.rejectPairingRequest(requestId.toInt(), entry.handle) }
  }

  override fun addOnPairingRequestListener(
    listener: (request: PairingRequest) -> Unit
  ): ListenerSubscription = PairingEvents.onPairingRequest(listener)

  override fun addOnBootstrappingListener(
    listener: (peerId: String, method: BootstrappingMethod) -> Unit
  ): ListenerSubscription = PairingEvents.onBootstrapping { listener(it.first, it.second) }

  override fun initiatePairingWithForeignPeer(
    options: InitiatePairingOptions
  ): Promise<PairedDevice> {
    val supported =
      AwareAttachment.manager?.characteristics?.isAwarePairingSupported ?: false
    if (!supported) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.PROGRAMMATIC_PAIRING_UNSUPPORTED,
        "This device's radio does not expose standardised Wi-Fi Aware pairing, so pairing with a " +
          "peer outside its own ecosystem cannot be attempted.",
      )
    }

    // Deliberately identical to initiatePairing: the standard defines one exchange, and this entry
    // point exists to make the experimental intent explicit at the call site rather than to do
    // something different. Cross-ecosystem pairing is unproven — see the README.
    return initiatePairing(options)
  }
}
