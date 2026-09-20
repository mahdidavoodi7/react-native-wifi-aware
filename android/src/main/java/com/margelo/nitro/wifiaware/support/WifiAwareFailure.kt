package com.margelo.nitro.wifiaware.support

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.wifiaware.WifiAwareErrorCode
import com.margelo.nitro.wifiaware.WifiAwareErrorInfo

/**
 * Maps platform failures onto this library's stable error vocabulary.
 *
 * Nitro can only carry a message across a thrown error, so calls throw with a canonical
 * `[wifi-aware:<code>]` tag that JS reads back with `getWifiAwareErrorCode()`. Failures delivered
 * through listeners carry the full [WifiAwareErrorInfo] instead.
 */
@Keep
@DoNotStrip
object WifiAwareFailure {
  /** The wire spelling of each code, matching the TypeScript union exactly. */
  fun wireName(code: WifiAwareErrorCode): String =
    when (code) {
      WifiAwareErrorCode.UNSUPPORTED -> "unsupported"
      WifiAwareErrorCode.UNAVAILABLE -> "unavailable"
      WifiAwareErrorCode.PERMISSION_DENIED -> "permission-denied"
      WifiAwareErrorCode.ENTITLEMENT_MISSING -> "entitlement-missing"
      WifiAwareErrorCode.SERVICE_NOT_DECLARED -> "service-not-declared"
      WifiAwareErrorCode.INVALID_SERVICE_NAME -> "invalid-service-name"
      WifiAwareErrorCode.UNSUPPORTED_OPERATION -> "unsupported-operation"
      WifiAwareErrorCode.INVALID_ARGUMENT -> "invalid-argument"
      WifiAwareErrorCode.NO_RADIO_RESOURCES -> "no-radio-resources"
      WifiAwareErrorCode.SERVICE_ALREADY_PUBLISHING -> "service-already-publishing"
      WifiAwareErrorCode.SERVICE_ALREADY_SUBSCRIBING -> "service-already-subscribing"
      WifiAwareErrorCode.ATTACH_FAILED -> "attach-failed"
      WifiAwareErrorCode.SESSION_CONFIG_FAILED -> "session-config-failed"
      WifiAwareErrorCode.SESSION_TERMINATED -> "session-terminated"
      WifiAwareErrorCode.PUBLISHER_TIMEOUT -> "publisher-timeout"
      WifiAwareErrorCode.SUBSCRIBER_TIMEOUT -> "subscriber-timeout"
      WifiAwareErrorCode.NO_PAIRED_DEVICES -> "no-paired-devices"
      WifiAwareErrorCode.DEVICE_INVALID -> "device-invalid"
      WifiAwareErrorCode.DEVICE_NO_LONGER_AVAILABLE -> "device-no-longer-available"
      WifiAwareErrorCode.PAIRING_CANCELLED -> "pairing-cancelled"
      WifiAwareErrorCode.PAIRING_FAILED -> "pairing-failed"
      WifiAwareErrorCode.PAIRING_VERIFICATION_FAILED -> "pairing-verification-failed"
      WifiAwareErrorCode.BOOTSTRAPPING_FAILED -> "bootstrapping-failed"
      WifiAwareErrorCode.PROGRAMMATIC_PAIRING_UNSUPPORTED -> "programmatic-pairing-unsupported"
      WifiAwareErrorCode.CONNECTION_FAILED -> "connection-failed"
      WifiAwareErrorCode.CONNECTION_IDLE_TIMEOUT -> "connection-idle-timeout"
      WifiAwareErrorCode.CONNECTION_TERMINATED -> "connection-terminated"
      WifiAwareErrorCode.CONNECTION_CLOSED -> "connection-closed"
      WifiAwareErrorCode.PEER_ADDRESS_UNAVAILABLE -> "peer-address-unavailable"
      WifiAwareErrorCode.MESSAGE_SEND_FAILED -> "message-send-failed"
      WifiAwareErrorCode.UNKNOWN -> "unknown"
    }

  /** Builds the canonical tagged message a thrown error must carry. */
  fun message(code: WifiAwareErrorCode, detail: String): String =
    "[wifi-aware:${wireName(code)}] $detail"

  /** An exception carrying the canonical tag, for throwing out of a Nitro method. */
  fun error(code: WifiAwareErrorCode, detail: String): Throwable =
    IllegalStateException(message(code, detail))

  /** The structured form, for delivery through an error listener. */
  fun info(
    code: WifiAwareErrorCode,
    detail: String,
    nativeDomain: String? = null,
    nativeCode: Double? = null,
    nativeDescription: String? = null,
    nativeDetails: String? = null,
  ): WifiAwareErrorInfo =
    WifiAwareErrorInfo(
      code = code,
      message = detail,
      nativeDomain = nativeDomain,
      nativeCode = nativeCode,
      nativeDescription = nativeDescription,
      nativeDetails = nativeDetails,
    )

  /** Translates an arbitrary platform throwable, preserving the original for diagnostics. */
  fun classify(
    throwable: Throwable,
    fallback: WifiAwareErrorCode = WifiAwareErrorCode.UNKNOWN,
  ): WifiAwareErrorInfo {
    val code =
      when (throwable) {
        is SecurityException -> WifiAwareErrorCode.PERMISSION_DENIED
        is IllegalArgumentException -> WifiAwareErrorCode.INVALID_ARGUMENT
        else -> fallback
      }
    return info(
      code = code,
      detail = throwable.message ?: throwable.javaClass.simpleName,
      nativeDomain = throwable.javaClass.name,
      nativeDescription = throwable.toString(),
    )
  }
}
