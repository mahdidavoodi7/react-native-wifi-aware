import Foundation
import Network
import UIKit

#if canImport(DeviceDiscoveryUI)
  import DeviceDiscoveryUI
#endif
#if canImport(WiFiAware)
  import WiFiAware
#endif

#if canImport(WiFiAware) && canImport(DeviceDiscoveryUI)

  /// Presents the system pairing UI and reports what the user did.
  ///
  /// Pairing on Apple platforms is system-owned: this code can present the UI and observe the
  /// result, but it never sees or generates a PIN and cannot pair programmatically.
  @available(iOS 26.0, *)
  @MainActor
  enum PairingPresenter {
    /// Runs the pairing flow for a role, resolving with the newly paired device or `nil` if the
    /// user dismissed the UI without pairing.
    static func present(options: PairingUIOptions) async throws -> PairedDevice? {
      switch options.role {
      case .publisher: return try await presentPublisher(options: options)
      case .subscriber: return try await presentSubscriber(options: options)
      }
    }

    // MARK: - Publisher

    /// Shows this device to be paired with, displaying the PIN.
    private static func presentPublisher(options: PairingUIOptions) async throws -> PairedDevice? {
      guard let service = WAPublishableService.allServices[options.serviceName] else {
        throw WifiAwareFailure.error(
          .serviceNotDeclared,
          "\"\(options.serviceName)\" is not declared as a publishable service in this app's "
            + "Info.plist under WiFiAwareServices."
        )
      }

      // `.userSpecifiedDevices` is only valid for the pairing UI — Apple documents that it throws
      // if handed to a NetworkListener — which is exactly why it is not part of the public
      // DeviceSelector union.
      let provider: WAPublisherListener = .wifiAware(
        .connecting(to: service, from: .userSpecifiedDevices)
      )

      guard DDDevicePairingViewController.isSupported(provider) else {
        throw WifiAwareFailure.error(
          .unsupported, "The system pairing UI is not available on this device.")
      }

      let before = try await pairedDeviceIdentifiers()
      let controller = DDDevicePairingViewController(
        listenerProvider: provider,
        access: options.access.ddAccess
      )

      try await present(controller)
      await waitForDismissal(of: controller)

      return try await firstDevice(addedSince: before)
    }

    // MARK: - Subscriber

    /// Shows a picker of nearby devices for the user to choose from.
    private static func presentSubscriber(options: PairingUIOptions) async throws -> PairedDevice? {
      guard let service = WASubscribableService.allServices[options.serviceName] else {
        throw WifiAwareFailure.error(
          .serviceNotDeclared,
          "\"\(options.serviceName)\" is not declared as a subscribable service in this app's "
            + "Info.plist under WiFiAwareServices."
        )
      }

      // The picker takes a classic NWBrowser.Descriptor rather than a BrowserProvider, and the
      // Wi-Fi Aware browser publicly vends both the descriptor and matching parameters.
      let browser: WASubscriberBrowser = .wifiAware(
        .connecting(to: .allPairedDevices, from: service)
      )
      let descriptor = browser.makeDescriptor()
      let parameters = browser.configureParameters(nil)

      guard DDDevicePickerViewController.isSupported(descriptor, using: parameters) else {
        throw WifiAwareFailure.error(
          .unsupported, "The system device picker is not available on this device.")
      }

      guard
        let controller = DDDevicePickerViewController(
          browseDescriptor: descriptor,
          parameters: parameters,
          access: options.access.ddAccess
        )
      else {
        throw WifiAwareFailure.error(
          .unsupported, "The system device picker could not be created for this service.")
      }

      let before = try await pairedDeviceIdentifiers()
      try await present(controller)

      do {
        let endpoint = try await controller.endpoint
        controller.dismiss(animated: true)

        if #available(iOS 26.4, *), let device = endpoint.wifiAware?.device {
          return device.toPairedDevice()
        }
        // Before 26.4 an NWEndpoint cannot be resolved to a Wi-Fi Aware device, so fall back to
        // spotting whichever pairing appeared while the picker was open.
        return try await firstDevice(addedSince: before)
      } catch {
        controller.dismiss(animated: true)
        // A user who closes the picker is not an error condition worth throwing over.
        if let device = try? await firstDevice(addedSince: before) { return device }
        return nil
      }
    }

    // MARK: - Presentation helpers

    private static func present(_ controller: UIViewController) async throws {
      guard let presenter = topViewController() else {
        throw WifiAwareFailure.error(
          .unknown, "No view controller is available to present the pairing UI from.")
      }

      await withCheckedContinuation { continuation in
        presenter.present(controller, animated: true) { continuation.resume() }
      }
    }

    private static func waitForDismissal(of controller: UIViewController) async {
      // The pairing controller reports no completion of its own, so its dismissal is the signal.
      while controller.presentingViewController != nil {
        try? await Task.sleep(for: .milliseconds(150))
      }
    }

    private static func topViewController() -> UIViewController? {
      let scene = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .first { $0.activationState == .foregroundActive }
        ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first

      guard var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController else {
        return nil
      }
      while let presented = top.presentedViewController {
        top = presented
      }
      return top
    }

    // MARK: - Paired-device diffing

    private static func pairedDeviceIdentifiers() async throws -> Set<String> {
      let devices = try await DeviceResolver.currentDevices()
      return Set(devices.map(\.jsIdentifier))
    }

    private static func firstDevice(addedSince before: Set<String>) async throws -> PairedDevice? {
      let devices = try await DeviceResolver.currentDevices()
      return devices.first { !before.contains($0.jsIdentifier) }?.toPairedDevice()
    }
  }

  @available(iOS 26.0, *)
  extension PairingAccess? {
    /// The framework access value, defaulting to the system's own policy.
    fileprivate var ddAccess: DDDevicePairingAccess {
      switch self {
      case .permanent: return .permanent
      case .default, .none: return .default
      }
    }
  }

#endif
