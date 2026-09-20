import Foundation
import NitroModules
import Network

#if canImport(WiFiAware)
  import WiFiAware
#endif

#if canImport(WiFiAware)

  /// An active search for peers advertising a service.
  ///
  /// `NetworkBrowser.run` delivers the complete current set of endpoints on every change rather
  /// than deltas, so found/lost events are derived by diffing against the previous set.
  @available(iOS 26.0, *)
  final class HybridSubscribeSession: HybridSubscribeSessionSpec, @unchecked Sendable {
    private let lock = NSLock()
    private var runTask: Task<Void, Never>?
    private var stopped = false

    /// Endpoints currently visible, keyed by the identifier handed to JS.
    private var endpoints: [String: WAEndpoint] = [:]

    private let peerFoundListeners = ListenerStore<DiscoveredPeer>()
    private let peerLostListeners = ListenerStore<String>()
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

    /// Starts searching, resolving once the browser is running.
    static func start(options: SubscribeOptions) async throws -> HybridSubscribeSession {
      try WifiAwareSupport.assertSupported()
      try ServiceNameValidator.assertValid(options.serviceName)

      guard let service = WASubscribableService.allServices[options.serviceName] else {
        throw WifiAwareFailure.error(
          .serviceNotDeclared,
          "\"\(options.serviceName)\" is not declared as a subscribable service in this app's "
            + "Info.plist under WiFiAwareServices."
        )
      }

      let selected = try await DeviceResolver.resolve(options.devices)
      let devices: WASubscriberBrowser.Devices =
        selected.map { .selected($0) } ?? .allPairedDevices
      let duration = options.activeDurationMs.map { Duration.milliseconds($0) }

      let session = HybridSubscribeSession(serviceName: options.serviceName)

      let browser = NetworkBrowser(
        for: .wifiAware(.connecting(to: devices, from: service), active: duration)
      )

      // The weak capture is read once here; the browse loop lives on the instance so that the
      // nested `run` closure never re-captures it across concurrency domains.
      session.runTask = Task { [weak session] in
        await session?.browseForPeers(with: browser)
      }

      return session
    }

    /// Runs the browser until cancelled, diffing each snapshot into found/lost events.
    private func browseForPeers(with browser: NetworkBrowser<WASubscriberBrowser>) async {
      do {
        try await browser.run { found in
          self.updateEndpoints(found)
        }
      } catch {
        if !Task.isCancelled {
          errorListeners.emit(classifyError(error, fallback: .subscriberTimeout))
        }
      }
      markStopped()
    }

    /// Diffs a fresh endpoint snapshot against the previous one and emits found/lost events.
    private func updateEndpoints(_ found: [WAEndpoint]) {
      var next: [String: WAEndpoint] = [:]
      for endpoint in found {
        next[endpoint.device.jsIdentifier] = endpoint
      }

      lock.lock()
      let previous = endpoints
      endpoints = next
      lock.unlock()

      for (id, endpoint) in next where previous[id] == nil {
        peerFoundListeners.emit(
          DiscoveredPeer(
            id: id,
            displayName: endpoint.device.name,
            // On Apple platforms discovery only ever surfaces already-paired devices, so a
            // discovered peer is by construction a paired one.
            pairedDeviceId: id,
            serviceSpecificInfo: nil
          )
        )
      }

      for id in previous.keys where next[id] == nil {
        peerLostListeners.emit(id)
      }
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

    // MARK: - HybridSubscribeSessionSpec

    func addOnPeerFoundListener(listener: @escaping (DiscoveredPeer) -> Void) throws
      -> ListenerSubscription
    {
      return peerFoundListeners.add(listener)
    }

    func addOnPeerLostListener(listener: @escaping (String) -> Void) throws
      -> ListenerSubscription
    {
      return peerLostListeners.add(listener)
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
      return discoveryMessageListeners.add { listener($0.0, $0.1) }
    }

    func sendDiscoveryMessage(peerId: String, data: ArrayBuffer) throws -> Promise<Void> {
      throw WifiAwareFailure.error(
        .unsupportedOperation,
        "This platform has no discovery message channel. Open a connection and use "
          + "Connection.send() instead."
      )
    }

    func connect(peerId: String, options: ConnectionOptions?) throws
      -> Promise<(any HybridConnectionSpec)>
    {
      lock.lock()
      let endpoint = endpoints[peerId]
      lock.unlock()

      guard let endpoint else {
        throw WifiAwareFailure.error(
          .deviceNoLongerAvailable,
          "Peer \"\(peerId)\" is not currently visible to this session."
        )
      }

      let mode = options?.performanceMode ?? .bulk
      let category = options?.accessCategory ?? .bestEffort
      let timeoutMs = options?.timeoutMs

      return Promise.async {
        let connection = NetworkConnection(
          to: endpoint,
          using: .parameters { TLS() }
            .wifiAware { $0.performanceMode = mode.waPerformanceMode }
            .serviceClass(category.serviceClass)
        )

        let hybrid = HybridConnection(connection: connection, peerId: peerId)

        do {
          try await hybrid.waitUntilReady(timeoutMs: timeoutMs)
        } catch {
          try? await hybrid.close().await()
          throw throwingClassified(error, fallback: .connectionFailed)
        }

        return hybrid
      }
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
