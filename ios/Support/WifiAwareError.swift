import Foundation
import NitroModules
import Network

#if canImport(WiFiAware)
  import WiFiAware
#endif

/// Maps every platform failure onto a stable ``WifiAwareErrorCode``.
///
/// Nitro can only carry a `String` across a thrown error, so calls throw a ``RuntimeError`` whose
/// message is tagged `[wifi-aware:<code>]`. JS reads that tag back with `getWifiAwareErrorCode()`.
/// Failures delivered through listeners are not throws, so those carry the full
/// ``WifiAwareErrorInfo`` struct instead.
enum WifiAwareFailure {
  /// Builds the canonical tagged message a thrown error must carry.
  ///
  /// `stringValue` is generated from the TypeScript union, so the tag JS parses back can never
  /// drift from the spec.
  static func message(_ code: WifiAwareErrorCode, _ detail: String) -> String {
    return "[wifi-aware:\(code.stringValue)] \(detail)"
  }

  /// A `RuntimeError` carrying the canonical tag, for throwing out of a Nitro method.
  static func error(_ code: WifiAwareErrorCode, _ detail: String) -> RuntimeError {
    return RuntimeError(message(code, detail))
  }

  /// The structured form, for delivery through an error listener.
  static func info(
    _ code: WifiAwareErrorCode,
    _ detail: String,
    nativeDomain: String? = nil,
    nativeCode: Double? = nil,
    nativeDescription: String? = nil,
    nativeDetails: String? = nil
  ) -> WifiAwareErrorInfo {
    return WifiAwareErrorInfo(
      code: code,
      message: detail,
      nativeDomain: nativeDomain,
      nativeCode: nativeCode,
      nativeDescription: nativeDescription,
      nativeDetails: nativeDetails
    )
  }
}

#if canImport(WiFiAware)

  @available(iOS 26.0, *)
  extension WAError {
    /// The stable code this framework error maps to.
    ///
    /// Every case is mapped explicitly rather than defaulting, so a new case added by a future SDK
    /// shows up here instead of silently becoming `.unknown`.
    var wifiAwareCode: WifiAwareErrorCode {
      switch self {
      case .error: return .unknown
      case .wifiAwareUnsupported: return .unsupported
      case .entitlementMissing: return .entitlementMissing
      case .noRadioResources: return .noRadioResources
      case .serviceNotDeclared: return .serviceNotDeclared
      case .serviceAlreadySubscribing: return .serviceAlreadySubscribing
      case .serviceAlreadyPublishing: return .serviceAlreadyPublishing
      case .noPairedDevices: return .noPairedDevices
      case .deviceInvalid: return .deviceInvalid
      case .deviceNoLongerAvailable: return .deviceNoLongerAvailable
      case .publisherTimeout: return .publisherTimeout
      case .subscriberTimeout: return .subscriberTimeout
      case .connectionFailed: return .connectionFailed
      case .connectionIdleTimeout: return .connectionIdleTimeout
      case .connectionTerminated: return .connectionTerminated
      @unknown default: return .unknown
      }
    }

    /// The error's associated detail payload, JSON-encoded.
    ///
    /// The detail structs expose no public stored properties — they are only `Codable` — so
    /// encoding is the sole way to surface what they contain.
    var encodedDetails: String? {
      guard let data = try? JSONEncoder().encode(self) else { return nil }
      return String(data: data, encoding: .utf8)
    }
  }

#endif

/// Translates any error thrown by the platform into this library's vocabulary.
///
/// Unwraps a `WAError` where one is present — directly, or carried inside an `NWError` — and
/// preserves the raw platform error either way.
func classifyError(_ error: Error, fallback: WifiAwareErrorCode = .unknown) -> WifiAwareErrorInfo {
  #if canImport(WiFiAware)
    if #available(iOS 26.0, *) {
      if let waError = error as? WAError {
        return WifiAwareFailure.info(
          waError.wifiAwareCode,
          waError.localizedDescription,
          nativeDomain: "WAError",
          nativeDescription: String(describing: waError),
          nativeDetails: waError.encodedDetails
        )
      }

      if let nwError = error as? NWError {
        // The Wi-Fi Aware framework projects its own errors through NWError; prefer the typed form
        // and keep the numeric NWError code alongside it.
        var nativeCode: Double?
        if case .wifiAware(let raw) = nwError { nativeCode = Double(raw) }

        if let waError = nwError.wifiAware {
          return WifiAwareFailure.info(
            waError.wifiAwareCode,
            waError.localizedDescription,
            nativeDomain: "NWError.wifiAware",
            nativeCode: nativeCode,
            nativeDescription: String(describing: nwError),
            nativeDetails: waError.encodedDetails
          )
        }

        return WifiAwareFailure.info(
          fallback,
          nwError.localizedDescription,
          nativeDomain: "NWError",
          nativeCode: nativeCode,
          nativeDescription: String(describing: nwError)
        )
      }
    }
  #endif

  if error is CancellationError {
    return WifiAwareFailure.info(.sessionTerminated, "The operation was cancelled.")
  }

  let nsError = error as NSError
  return WifiAwareFailure.info(
    fallback,
    nsError.localizedDescription,
    nativeDomain: nsError.domain,
    nativeCode: Double(nsError.code),
    nativeDescription: String(describing: error)
  )
}

/// Re-throws any platform error as a tagged `RuntimeError` that JS can classify.
func throwingClassified(_ error: Error, fallback: WifiAwareErrorCode = .unknown) -> RuntimeError {
  let info = classifyError(error, fallback: fallback)
  return WifiAwareFailure.error(info.code, info.message)
}
