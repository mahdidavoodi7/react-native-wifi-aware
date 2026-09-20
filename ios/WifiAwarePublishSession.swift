import Foundation
import NitroModules
import Network

#if canImport(WiFiAware)
  import WiFiAware
#endif

#if canImport(WiFiAware)

  /// An active advertisement, accepting inbound data paths.
  ///
  /// `NetworkListener.run` owns the listener for the duration of its call and hands each accepted
  /// connection to a scoped handler, so the whole session runs inside one long-lived `Task` that
  /// `stop()` cancels.
  @available(iOS 26.0, *)
  final class HybridPublishSession: HybridPublishSessionSpec, @unchecked Sendable {
    private let lock = NSLock()
    private var runTask: Task<Void, Never>?
    private var stopped = false

    private let connectionListeners = ListenerStore<any HybridConnectionSpec>()
    private let errorListeners = ListenerStore<WifiAwareErrorInfo>()
    private let stoppedListeners = ListenerStore<Void>()
    private let discoveryMessageListeners = ListenerStore<(String, ArrayBuffer)>()

    let serviceName: String

    var isActive: Bool {
      lock.lock()
      defer { lock.unlock() }
      return !stopped
    }

    private init(serviceName: String) {
      self.serviceName = serviceName
      super.init()
    }

    /// Starts advertising, resolving once the listener is running.
    static func start(options: PublishOptions) async throws -> HybridPublishSession {
      try WifiAwareSupport.assertSupported()
      try ServiceNameValidator.assertValid(options.serviceName)

      guard let service = WAPublishableService.allServices[options.serviceName] else {
        throw WifiAwareFailure.error(
          .serviceNotDeclared,
          "\"\(options.serviceName)\" is not declared as a publishable service in this app's "
            + "Info.plist under WiFiAwareServices."
        )
      }

      let selected = try await DeviceResolver.resolve(options.devices)
      let devices: WAPublisherListener.Devices =
        selected.map { .selected($0) } ?? .allPairedDevices

      let mode = options.performanceMode ?? .bulk
      let datapath: WAPublisherListener.DatapathParameters =
        mode == .realtime ? .realtime : .defaults
      let duration = options.activeDurationMs.map { Duration.milliseconds($0) }

      let session = HybridPublishSession(serviceName: options.serviceName)

      let listener = try NetworkListener(
        for: .wifiAware(
          .connecting(to: service, from: devices, datapath: datapath),
          active: duration
        ),
        using: .parameters { TLS() }.wifiAware { $0.performanceMode = mode.waPerformanceMode }
      )

      // The weak capture is read once here; the accept loop lives on the instance so that the
      // nested `run` closure never re-captures it across concurrency domains.
      session.runTask = Task { [weak session] in
        await session?.acceptConnections(on: listener)
      }

      return session
    }

    /// Runs the listener until cancelled, handing each accepted connection to JS.
    private func acceptConnections(on listener: NetworkListener<TLS>) async {
      do {
        try await listener.run { connection in
          let peerId = connection.remoteEndpoint?.wifiAwarePeerIdentifier ?? UUID().uuidString
          let hybrid = HybridConnection(connection: connection, peerId: peerId)
          self.connectionListeners.emit(hybrid)
          // Returning here would tear the connection down, so hold the scope open until JS
          // closes it or the peer goes away.
          await hybrid.waitUntilClosed()
        }
      } catch {
        if !Task.isCancelled {
          errorListeners.emit(classifyError(error, fallback: .publisherTimeout))
        }
      }
      markStopped()
    }

    /// Detaches the running task under the lock, so cancellation happens outside it.
    private func takeRunTask() -> Task<Void, Never>? {
      lock.lock()
      defer { lock.unlock() }
      let task = runTask
      runTask = nil
      return task
    }

    private func markStopped() {
      lock.lock()
      if stopped {
        lock.unlock()
        return
      }
      stopped = true
      lock.unlock()
      stoppedListeners.emit(())
    }

    // MARK: - HybridPublishSessionSpec

    func addOnConnectionListener(listener: @escaping ((any HybridConnectionSpec)) -> Void) throws
      -> ListenerSubscription
    {
      return connectionListeners.add(listener)
    }

    func addOnErrorListener(listener: @escaping (WifiAwareErrorInfo) -> Void) throws
      -> ListenerSubscription
    {
      return errorListeners.add(listener)
    }

    func addOnStoppedListener(listener: @escaping () -> Void) throws -> ListenerSubscription {
      return stoppedListeners.add { _ in listener() }
    }

    func addOnDiscoveryMessageListener(
      listener: @escaping (String, ArrayBuffer) -> Void
    ) throws -> ListenerSubscription {
      // Apple's Wi-Fi Aware has no discovery-level message channel; the listener is accepted so
      // cross-platform code can register it unconditionally, and simply never fires here.
      return discoveryMessageListeners.add { listener($0.0, $0.1) }
    }

    func sendDiscoveryMessage(peerId: String, data: ArrayBuffer) throws -> Promise<Void> {
      throw WifiAwareFailure.error(
        .unsupportedOperation,
        "This platform has no discovery message channel. Open a connection and use "
          + "Connection.send() instead."
      )
    }

    func stop() throws -> Promise<Void> {
      return Promise.async { [weak self] in
        guard let self else { return }
        // Taking the lock happens synchronously: holding one across a suspension point is unsafe,
        // and is an error under the Swift 6 language mode.
        self.takeRunTask()?.cancel()
        self.markStopped()
      }
    }
  }

#endif
