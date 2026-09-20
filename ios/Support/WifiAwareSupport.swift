import Foundation
import Network

#if canImport(WiFiAware)
  import WiFiAware
#endif

/// Runtime support checks shared by every entry point.
enum WifiAwareSupport {
  /// Whether this device and OS can do Wi-Fi Aware at all.
  static var isSupported: Bool {
    #if targetEnvironment(simulator)
      // Apple states plainly that Wi-Fi Aware does not work in the Simulator.
      return false
    #else
      #if canImport(WiFiAware)
        if #available(iOS 26.0, *) {
          return WACapabilities.supportedFeatures.contains(.wifiAware)
        }
      #endif
      return false
    #endif
  }

  /// Throws a descriptive error when Wi-Fi Aware is unavailable on this device.
  static func assertSupported() throws {
    guard isSupported else {
      #if targetEnvironment(simulator)
        throw WifiAwareFailure.error(
          .unsupported,
          "Wi-Fi Aware is not available in the iOS Simulator. Run on a physical device."
        )
      #else
        throw WifiAwareFailure.error(
          .unsupported,
          "Wi-Fi Aware is not supported on this device or OS version."
        )
      #endif
    }
  }
}

#if canImport(WiFiAware)

  @available(iOS 26.0, *)
  extension NWEndpoint {
    /// The paired-device identifier behind this endpoint, when the OS can resolve one.
    ///
    /// Resolving an `NWEndpoint` back to a Wi-Fi Aware endpoint needs iOS 26.4; on earlier releases
    /// the endpoint stays opaque and callers fall back to a synthetic identifier.
    var wifiAwarePeerIdentifier: String? {
      if #available(iOS 26.4, *) {
        return wifiAware?.device.jsIdentifier
      }
      return nil
    }
  }

#endif
