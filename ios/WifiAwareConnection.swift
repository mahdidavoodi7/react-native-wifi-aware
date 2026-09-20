import Foundation
import NitroModules
import Network

#if canImport(WiFiAware)
  import WiFiAware
#endif

#if canImport(WiFiAware)

  /// A live data path to one peer.
  ///
  /// Wraps a `NetworkConnection` and adapts it from a byte stream to the message-oriented JS API by
  /// applying ``MessageFraming`` in both directions.
  ///
  /// Two ownership models both end up here. A connection this device dialled is owned outright and
  /// lives as long as this object does. A connection handed to us by a listener is owned by the
  /// listener's `run` scope, which must stay alive for as long as JS holds the connection — see
  /// ``waitUntilClosed()``.
  @available(iOS 26.0, *)
  final class HybridConnection: HybridConnectionSpec, @unchecked Sendable {
    private let connection: NetworkConnection<TLS>
    private let lock = NSLock()

    private var receiveTask: Task<Void, Never>?
    private var closedContinuations: [CheckedContinuation<Void, Never>] = []
    private var currentState: ConnectionState = .connecting
    private var isClosed = false

    private let messageListeners = ListenerStore<ArrayBuffer>()
    private let stateListeners = ListenerStore<ConnectionState>()
    private let errorListeners = ListenerStore<WifiAwareErrorInfo>()

    let id: String
    let peerId: String

    var state: ConnectionState {
      lock.lock()
      defer { lock.unlock() }
      return currentState
    }

    init(connection: NetworkConnection<TLS>, peerId: String) {
      self.connection = connection
      self.peerId = peerId
      self.id = UUID().uuidString
      super.init()

      observeState()
      startReceiveLoop()
    }

    // MARK: - Lifecycle

    private func observeState() {
      connection.onStateUpdate { [weak self] _, state in
        guard let self else { return }

        let mapped: ConnectionState
        switch state {
        case .setup, .preparing: mapped = .connecting
        case .ready: mapped = .ready
        case .waiting: mapped = .waiting
        case .failed: mapped = .failed
        case .cancelled: mapped = .closed
        @unknown default: mapped = .connecting
        }

        if case .failed(let error) = state {
          self.errorListeners.emit(classifyError(error, fallback: .connectionFailed))
        }
        if case .waiting(let error) = state {
          self.errorListeners.emit(classifyError(error, fallback: .noRadioResources))
        }

        self.setState(mapped)

        if mapped == .closed || mapped == .failed {
          self.finishClose()
        }
      }
    }

    private func setState(_ next: ConnectionState) {
      lock.lock()
      let changed = currentState != next
      if changed { currentState = next }
      lock.unlock()

      if changed { stateListeners.emit(next) }
    }

    /// Suspends until this connection closes.
    ///
    /// Used by the publishing side to hold a listener's `run` scope open: returning from that scope
    /// tears down the connection, so it must not return while JS is still using it.
    func waitUntilClosed() async {
      await withCheckedContinuation { continuation in
        lock.lock()
        if isClosed {
          lock.unlock()
          continuation.resume()
          return
        }
        closedContinuations.append(continuation)
        lock.unlock()
      }
    }

    /// Suspends until the data path is usable, or fails.
    ///
    /// A connection is handed to JS only once it is genuinely ready, so callers never have to poll
    /// a nullable state before their first `send()`.
    func waitUntilReady(timeoutMs: Double?) async throws {
      let deadline: ContinuousClock.Instant? = timeoutMs.map {
        .now + .milliseconds($0)
      }

      // The state listener fires on every transition; polling the cached value with a short sleep
      // avoids racing registration against a transition that already happened.
      while true {
        switch state {
        case .ready:
          return
        case .failed:
          throw WifiAwareFailure.error(
            .connectionFailed, "The data path failed before it became usable.")
        case .closed:
          throw WifiAwareFailure.error(
            .connectionClosed, "The data path closed before it became usable.")
        case .connecting, .waiting:
          break
        }

        if let deadline, .now >= deadline {
          throw WifiAwareFailure.error(
            .connectionFailed,
            "The data path did not become usable within the requested timeout."
          )
        }

        try await Task.sleep(for: .milliseconds(25))
      }
    }

    private func finishClose() {
      lock.lock()
      if isClosed {
        lock.unlock()
        return
      }
      isClosed = true
      let waiting = closedContinuations
      closedContinuations = []
      let task = receiveTask
      receiveTask = nil
      currentState = .closed
      lock.unlock()

      task?.cancel()
      for continuation in waiting { continuation.resume() }
    }

    // MARK: - Receiving

    private func startReceiveLoop() {
      let task = Task<Void, Never> { [weak self] in
        guard let self else { return }
        do {
          while !Task.isCancelled {
            let header = try await self.connection.receive(exactly: MessageFraming.headerSize)
            let length = MessageFraming.payloadLength(from: Data(header.content))

            guard length >= 0, length <= MessageFraming.maximumPayloadSize else {
              throw WifiAwareFailure.error(
                .connectionTerminated,
                "The peer sent a message header declaring an unusable payload size."
              )
            }

            // A zero-length message is legal and carries no payload of its own.
            let payload =
              length == 0
              ? Data() : Data(try await self.connection.receive(exactly: length).content)

            if self.messageListeners.isEmpty { continue }
            if let buffer = try? ArrayBuffer.copy(data: payload) {
              self.messageListeners.emit(buffer)
            }
          }
        } catch {
          if !Task.isCancelled {
            self.errorListeners.emit(classifyError(error, fallback: .connectionTerminated))
          }
          self.finishClose()
        }
      }

      lock.lock()
      receiveTask = task
      lock.unlock()
    }

    // MARK: - HybridConnectionSpec

    func send(data: ArrayBuffer) throws -> Promise<Void> {
      lock.lock()
      let closed = isClosed
      lock.unlock()

      guard !closed else {
        throw WifiAwareFailure.error(.connectionClosed, "This connection is already closed.")
      }

      // Copy synchronously: the buffer JS handed us is only valid for this call.
      let payload = MessageFraming.frame(data.toData(copyIfNeeded: true))

      return Promise.async { [connection] in
        do {
          try await connection.send(payload)
        } catch {
          throw throwingClassified(error, fallback: .connectionTerminated)
        }
      }
    }

    func addOnMessageListener(listener: @escaping (ArrayBuffer) -> Void) throws
      -> ListenerSubscription
    {
      return messageListeners.add(listener)
    }

    func addOnStateChangedListener(listener: @escaping (ConnectionState) -> Void) throws
      -> ListenerSubscription
    {
      return stateListeners.add(listener)
    }

    func addOnErrorListener(listener: @escaping (WifiAwareErrorInfo) -> Void) throws
      -> ListenerSubscription
    {
      return errorListeners.add(listener)
    }

    func getPerformance() throws -> Promise<PerformanceReport?> {
      return Promise.async { [connection] in
        guard let path = connection.currentPath else { return nil }
        do {
          return try await path.wifiAware?.toPerformanceReport()
        } catch {
          // No report available is a normal condition, not a failure worth propagating.
          return nil
        }
      }
    }

    func close() throws -> Promise<Void> {
      return Promise.async { [weak self] in
        self?.finishClose()
      }
    }
  }

#endif
