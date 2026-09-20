import Foundation
import NitroModules
import Network

#if canImport(WiFiAware)
  import WiFiAware
#endif

/// Root of the Wi-Fi Aware API on Apple platforms.
///
/// This class must remain usable on OS versions below the Wi-Fi Aware minimum, because Nitro
/// instantiates it as soon as JS imports the module. Every framework call is therefore gated behind
/// an availability check, and unsupported devices get a descriptive error rather than a crash.
final class WifiAware: HybridWifiAwareSpec, @unchecked Sendable {
  private let lock = NSLock()
  private let availabilityListeners = ListenerStore<Availability>()
  private let pairedDeviceListeners = ListenerStore<[PairedDevice]>()

  /// Watches the paired-device sequence while anything is listening.
  private var pairedDevicesTask: Task<Void, Never>?

  // MARK: - Capabilities

  func getCapabilities() throws -> Promise<Capabilities> {
    return Promise.async {
      #if canImport(WiFiAware)
        if #available(iOS 26.0, *), WifiAwareSupport.isSupported {
          return Capabilities(
            isSupported: true,
            maxConnectableDevices: Double(WACapabilities.maximumConnectableDevices),
            maxPublishableServices: Double(WACapabilities.maximumPublishableServices),
            maxSubscribableServices: Double(WACapabilities.maximumSubscribableServices),
            // The framework publishes no service-name or advertisement-payload limits.
            maxServiceNameLength: nil,
            maxServiceSpecificInfoLength: nil,
            isPairingUISupported: true,
            // Pairing here is system-owned; there is no programmatic pairing to offer, and so
            // nothing to check for cross-ecosystem pairing either.
            isProgrammaticPairingSupported: false,
            isCrossPlatformPairingSupported: false
          )
        }
      #endif

      return Capabilities(
        isSupported: false,
        maxConnectableDevices: nil,
        maxPublishableServices: nil,
        maxSubscribableServices: nil,
        maxServiceNameLength: nil,
        maxServiceSpecificInfoLength: nil,
        isPairingUISupported: false,
        isProgrammaticPairingSupported: false,
        isCrossPlatformPairingSupported: false
      )
    }
  }

  func getAvailability() throws -> Promise<Availability> {
    return Promise.async {
      // Apple exposes no live availability or resource accounting; radio conditions surface as
      // errors when a session is started. Counts stay absent rather than being invented.
      return Availability(
        isAvailable: WifiAwareSupport.isSupported,
        availableDataPaths: nil,
        availablePublishSessions: nil,
        availableSubscribeSessions: nil
      )
    }
  }

  func addOnAvailabilityChangedListener(listener: @escaping (Availability) -> Void) throws
    -> ListenerSubscription
  {
    // Registered for cross-platform symmetry. Apple broadcasts no availability transitions, so
    // this never fires here.
    return availabilityListeners.add(listener)
  }

  // MARK: - Pairing

  func presentPairingUI(options: PairingUIOptions) throws -> Promise<PairedDevice?> {
    #if canImport(WiFiAware) && canImport(DeviceDiscoveryUI)
      if #available(iOS 26.0, *) {
        try WifiAwareSupport.assertSupported()
        try ServiceNameValidator.assertValid(options.serviceName)

        return Promise.async {
          do {
            return try await PairingPresenter.present(options: options)
          } catch {
            throw throwingClassified(error, fallback: .pairingFailed)
          }
        }
      }
    #endif

    throw WifiAwareFailure.error(
      .unsupported, "Wi-Fi Aware is not supported on this device or OS version.")
  }

  func getProgrammaticPairing() throws -> Promise<(any HybridProgrammaticPairingSpec)> {
    throw WifiAwareFailure.error(
      .programmaticPairingUnsupported,
      "This platform pairs through system UI and exposes no programmatic pairing. "
        + "Use presentPairingUI() instead, and branch on "
        + "Capabilities.isProgrammaticPairingSupported."
    )
  }

  func getPairedDevices() throws -> Promise<[PairedDevice]> {
    return Promise.async {
      #if canImport(WiFiAware)
        if #available(iOS 26.0, *), WifiAwareSupport.isSupported {
          do {
            return try await DeviceResolver.currentDevices().map { $0.toPairedDevice() }
          } catch {
            throw throwingClassified(error)
          }
        }
      #endif
      return []
    }
  }

  func addOnPairedDevicesChangedListener(listener: @escaping ([PairedDevice]) -> Void) throws
    -> ListenerSubscription
  {
    let subscription = pairedDeviceListeners.add(listener)
    startWatchingPairedDevices()
    return subscription
  }

  /// Starts the paired-device stream once, on first subscription.
  private func startWatchingPairedDevices() {
    #if canImport(WiFiAware)
      guard #available(iOS 26.0, *), WifiAwareSupport.isSupported else { return }

      lock.lock()
      guard pairedDevicesTask == nil else {
        lock.unlock()
        return
      }

      let task = Task<Void, Never> { [weak self] in
        do {
          for try await snapshot in WAPairedDevice.allDevices {
            guard let self else { return }
            let devices = snapshot.values.map { $0.toPairedDevice() }
            self.pairedDeviceListeners.emit(devices)
          }
        } catch {
          // The sequence ending is not itself an error worth surfacing; a failure that matters
          // shows up again when the app next touches the framework.
        }
      }
      pairedDevicesTask = task
      lock.unlock()
    #endif
  }

  func removePairedDevice(deviceId: String) throws -> Promise<Void> {
    throw WifiAwareFailure.error(
      .unsupportedOperation,
      "Pairings on this platform are managed by the user in "
        + "Settings > Privacy & Security > Paired Devices, and cannot be removed by an app."
    )
  }

  // MARK: - Discovery

  func publish(options: PublishOptions) throws -> Promise<(any HybridPublishSessionSpec)> {
    #if canImport(WiFiAware)
      if #available(iOS 26.0, *) {
        return Promise.async {
          do {
            return try await HybridPublishSession.start(options: options)
          } catch {
            throw throwingClassified(error, fallback: .sessionConfigFailed)
          }
        }
      }
    #endif

    throw WifiAwareFailure.error(
      .unsupported, "Wi-Fi Aware is not supported on this device or OS version.")
  }

  func subscribe(options: SubscribeOptions) throws -> Promise<(any HybridSubscribeSessionSpec)> {
    #if canImport(WiFiAware)
      if #available(iOS 26.0, *) {
        return Promise.async {
          do {
            return try await HybridSubscribeSession.start(options: options)
          } catch {
            throw throwingClassified(error, fallback: .sessionConfigFailed)
          }
        }
      }
    #endif

    throw WifiAwareFailure.error(
      .unsupported, "Wi-Fi Aware is not supported on this device or OS version.")
  }
}
