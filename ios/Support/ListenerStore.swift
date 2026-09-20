import Foundation
import NitroModules

/// A thread-safe registry of JS listeners for one event.
///
/// Nitro callbacks are safe to invoke from any thread, but the registry itself is mutated from the
/// networking queues and read while emitting, so every access is serialised behind a lock.
///
/// `remove()` is idempotent, and a listener removed while an emission is already in flight may
/// still receive that one event — the contract documented on `ListenerSubscription`.
final class ListenerStore<Payload>: @unchecked Sendable {
  private let lock = NSLock()
  private var listeners: [Int64: (Payload) -> Void] = [:]
  private var nextToken: Int64 = 0

  /// Registers a listener and returns the handle JS uses to unregister it.
  func add(_ listener: @escaping (Payload) -> Void) -> ListenerSubscription {
    lock.lock()
    let token = nextToken
    nextToken += 1
    listeners[token] = listener
    lock.unlock()

    return ListenerSubscription(remove: { [weak self] in
      guard let self else { return }
      self.lock.lock()
      self.listeners.removeValue(forKey: token)
      self.lock.unlock()
    })
  }

  /// Invokes every registered listener with `payload`.
  ///
  /// The snapshot is taken under the lock and the callbacks run outside it, so a listener that
  /// unsubscribes (or subscribes) from inside its own callback cannot deadlock.
  func emit(_ payload: Payload) {
    lock.lock()
    let snapshot = Array(listeners.values)
    lock.unlock()

    for listener in snapshot {
      listener(payload)
    }
  }

  /// Whether anything is currently listening. Lets callers skip building an expensive payload.
  var isEmpty: Bool {
    lock.lock()
    defer { lock.unlock() }
    return listeners.isEmpty
  }

  /// Drops every listener, used when the owning object is torn down.
  func removeAll() {
    lock.lock()
    listeners.removeAll()
    lock.unlock()
  }
}
