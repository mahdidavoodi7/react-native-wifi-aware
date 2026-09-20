package com.margelo.nitro.wifiaware.support

import com.margelo.nitro.wifiaware.WifiAwareErrorCode

/**
 * Validates Wi-Fi Aware service names against the platform's naming rules.
 *
 * Enforced in three places that must stay in step: the Expo config plugin at build time,
 * `validateServiceName()` in JS, and here before any name reaches the framework. Apple crashes an
 * app at launch over a malformed name, so the rules are applied on both platforms for parity.
 */
object ServiceNameValidator {
  private const val MAXIMUM_LABEL_LENGTH = 15

  /** Throws `invalid-service-name` describing the specific rule broken, if any. */
  fun assertValid(serviceName: String) {
    val parts = serviceName.split(".")

    if (parts.size != 2 ||
      !parts[0].startsWith("_") ||
      (parts[1] != "_tcp" && parts[1] != "_udp")
    ) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.INVALID_SERVICE_NAME,
        "Service name \"$serviceName\" must look like \"_name._tcp\" or \"_name._udp\".",
      )
    }

    val label = parts[0].removePrefix("_")

    if (label.isEmpty() || label.length > MAXIMUM_LABEL_LENGTH) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.INVALID_SERVICE_NAME,
        "Service name \"$serviceName\" has a ${label.length}-character name component " +
          "(\"$label\"), but it must be between 1 and $MAXIMUM_LABEL_LENGTH characters.",
      )
    }

    if (!label.all { it in 'a'..'z' || it in 'A'..'Z' || it in '0'..'9' || it == '-' }) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.INVALID_SERVICE_NAME,
        "Service name \"$serviceName\" has a name component (\"$label\") containing characters " +
          "outside a-z, A-Z, 0-9 and \"-\".",
      )
    }

    if (label.none { it in 'a'..'z' || it in 'A'..'Z' }) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.INVALID_SERVICE_NAME,
        "Service name \"$serviceName\" has a name component (\"$label\") with no letter in it; " +
          "at least one a-z or A-Z character is required.",
      )
    }

    if (label.startsWith("-") || label.endsWith("-")) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.INVALID_SERVICE_NAME,
        "Service name \"$serviceName\" has a name component (\"$label\") that starts or ends " +
          "with a hyphen, which is not allowed.",
      )
    }
  }
}
