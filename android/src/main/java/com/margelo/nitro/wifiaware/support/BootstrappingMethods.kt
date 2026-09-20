package com.margelo.nitro.wifiaware.support

import android.net.wifi.aware.AwarePairingConfig
import android.os.Build
import androidx.annotation.RequiresApi
import com.margelo.nitro.wifiaware.BootstrappingMethod

/**
 * Translates between the JS bootstrapping vocabulary and the platform's bitmask.
 *
 * The platform represents supported methods as an OR of flags; JS uses an explicit list, which is
 * both clearer to consume and safe against a device advertising a flag this library predates.
 */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
object BootstrappingMethods {
  private val flags: List<Pair<BootstrappingMethod, Int>> =
    listOf(
      BootstrappingMethod.OPPORTUNISTIC to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_OPPORTUNISTIC,
      BootstrappingMethod.PIN_CODE_DISPLAY to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_PIN_CODE_DISPLAY,
      BootstrappingMethod.PASSPHRASE_DISPLAY to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_PASSPHRASE_DISPLAY,
      BootstrappingMethod.QR_DISPLAY to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_QR_DISPLAY,
      BootstrappingMethod.NFC_TAG to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_NFC_TAG,
      BootstrappingMethod.PIN_CODE_KEYPAD to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_PIN_CODE_KEYPAD,
      BootstrappingMethod.PASSPHRASE_KEYPAD to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_PASSPHRASE_KEYPAD,
      BootstrappingMethod.QR_SCAN to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_QR_SCAN,
      BootstrappingMethod.NFC_READER to
        AwarePairingConfig.PAIRING_BOOTSTRAPPING_NFC_READER,
    )

  /** Expands a platform bitmask into the methods JS understands. */
  fun fromBitmask(mask: Int): Array<BootstrappingMethod> =
    flags.filter { (_, flag) -> mask and flag != 0 }.map { it.first }.toTypedArray()

  /** Folds a list of methods back into a platform bitmask. */
  fun toBitmask(methods: List<BootstrappingMethod>): Int =
    methods.fold(0) { mask, method -> mask or flagFor(method) }

  /** The single platform flag for one method. */
  fun flagFor(method: BootstrappingMethod): Int =
    flags.first { it.first == method }.second
}
