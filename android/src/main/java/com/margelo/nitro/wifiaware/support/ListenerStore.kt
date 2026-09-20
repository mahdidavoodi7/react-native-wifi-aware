package com.margelo.nitro.wifiaware.support

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.wifiaware.ListenerSubscription
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * A thread-safe registry of JS listeners for one event.
 *
 * Nitro callbacks are safe to invoke from any thread, but the registry is written from the Wi-Fi
 * Aware and connectivity callback threads while being read during emission, so it is backed by a
 * concurrent map. `remove()` is idempotent, matching the documented `ListenerSubscription`
 * contract.
 */
@Keep
@DoNotStrip
class ListenerStore<Payload> {
  private val listeners = ConcurrentHashMap<Long, (Payload) -> Unit>()
  private val nextToken = AtomicLong(0)

  /** Registers a listener and returns the handle JS uses to unregister it. */
  fun add(listener: (Payload) -> Unit): ListenerSubscription {
    val token = nextToken.getAndIncrement()
    listeners[token] = listener
    return ListenerSubscription(remove = { listeners.remove(token) })
  }

  /** Invokes every registered listener with [payload]. */
  fun emit(payload: Payload) {
    for (listener in listeners.values) {
      listener(payload)
    }
  }

  /** Whether anything is listening. Lets callers skip building an expensive payload. */
  val isEmpty: Boolean
    get() = listeners.isEmpty()

  /** Drops every listener, used when the owning object is torn down. */
  fun removeAll() {
    listeners.clear()
  }
}
