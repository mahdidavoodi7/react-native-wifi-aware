import Foundation

#if canImport(WiFiAware)
  import WiFiAware
#endif

#if canImport(WiFiAware)

  /// Resolves JS device identifiers back to framework paired-device values.
  @available(iOS 26.0, *)
  enum DeviceResolver {
    /// A snapshot of every device currently paired with this app.
    static func currentDevices() async throws -> [WAPairedDevice] {
      let snapshot = try await WAPairedDevice.allDevices.current()
      return Array((snapshot ?? [:]).values)
    }

    /// Resolves the identifiers in a selector.
    ///
    /// - Throws: `invalid-argument` if `'selected'` is used without identifiers, and
    ///   `device-invalid` if an identifier does not name a device paired with this app.
    static func resolve(_ selector: DeviceSelector?) async throws -> [WAPairedDevice]? {
      guard let selector, selector.kind == .selected else { return nil }

      guard let ids = selector.deviceIds, !ids.isEmpty else {
        throw WifiAwareFailure.error(
          .invalidArgument,
          "A device selector of kind 'selected' requires a non-empty deviceIds array."
        )
      }

      let wanted = Set(ids)
      let devices = try await currentDevices().filter { wanted.contains($0.jsIdentifier) }

      let found = Set(devices.map(\.jsIdentifier))
      let missing = wanted.subtracting(found)
      guard missing.isEmpty else {
        throw WifiAwareFailure.error(
          .deviceInvalid,
          "No paired device matches \(missing.sorted().joined(separator: ", "))."
        )
      }

      return devices
    }
  }

#endif
