package com.margelo.nitro.wifiaware

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise
import com.margelo.nitro.wifiaware.support.ListenerStore
import com.margelo.nitro.wifiaware.support.MessageFraming
import com.margelo.nitro.wifiaware.support.WifiAwareFailure
import java.io.DataInputStream
import java.io.IOException
import java.net.Socket
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * A live data path to one peer, backed by a socket over the Wi-Fi Aware network.
 *
 * Adapts the byte stream to the message-oriented JS API by applying [MessageFraming] in both
 * directions, so one `send()` arrives as exactly one `onMessage`.
 *
 * @param socket the connected socket carrying this data path.
 * @param peerId the identifier JS uses for the peer at the far end.
 * @param onClosed invoked once when the connection closes, so the owner can release the network
 *   request that keeps the data path alive.
 */
@Keep
@DoNotStrip
class WifiAwareConnection(
  private val socket: Socket,
  override val peerId: String,
  private val onClosed: () -> Unit,
) : HybridConnectionSpec() {
  override val id: String = UUID.randomUUID().toString()

  private val closed = AtomicBoolean(false)
  private val sendLock = Any()

  private val messageListeners = ListenerStore<ArrayBuffer>()
  private val stateListeners = ListenerStore<ConnectionState>()
  private val errorListeners = ListenerStore<WifiAwareErrorInfo>()

  @Volatile private var currentState: ConnectionState = ConnectionState.READY

  override val state: ConnectionState
    get() = currentState

  private val receiveThread =
    thread(start = true, isDaemon = true, name = "wifi-aware-rx-$id") { receiveLoop() }

  // MARK: - Receiving

  private fun receiveLoop() {
    try {
      val input = DataInputStream(socket.getInputStream())
      val header = ByteArray(MessageFraming.HEADER_SIZE)

      while (!closed.get()) {
        input.readFully(header)
        val length = MessageFraming.payloadLength(header)

        if (length < 0 || length > MessageFraming.MAXIMUM_PAYLOAD_SIZE) {
          throw IOException("Peer declared an unusable payload size of $length bytes.")
        }

        // A zero-length message is legal and carries no payload of its own.
        val payload = ByteArray(length)
        if (length > 0) input.readFully(payload)

        if (messageListeners.isEmpty) continue
        messageListeners.emit(ArrayBuffer.copy(payload))
      }
    } catch (throwable: Throwable) {
      if (!closed.get()) {
        errorListeners.emit(
          WifiAwareFailure.classify(throwable, WifiAwareErrorCode.CONNECTION_TERMINATED)
        )
      }
    } finally {
      finishClose()
    }
  }

  private fun setState(next: ConnectionState) {
    if (currentState == next) return
    currentState = next
    stateListeners.emit(next)
  }

  private fun finishClose() {
    if (!closed.compareAndSet(false, true)) return

    runCatching { socket.close() }
    setState(ConnectionState.CLOSED)
    onClosed()
  }

  // MARK: - HybridConnectionSpec

  override fun send(data: ArrayBuffer): Promise<Unit> {
    if (closed.get()) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.CONNECTION_CLOSED,
        "This connection is already closed.",
      )
    }

    // Copy synchronously: the buffer JS handed us is only valid for the duration of this call,
    // and the write happens on another thread. `toByteArray()` may hand back the underlying array
    // without copying, so `copyOf()` is what actually guarantees we own these bytes.
    val payload = data.toByteArray().copyOf()

    return Promise.parallel {
      try {
        // One writer at a time, so concurrent sends cannot interleave their frames.
        synchronized(sendLock) {
          val output = socket.getOutputStream()
          output.write(MessageFraming.header(payload.size))
          output.write(payload)
          output.flush()
        }
      } catch (throwable: Throwable) {
        finishClose()
        throw WifiAwareFailure.error(
          WifiAwareErrorCode.CONNECTION_TERMINATED,
          throwable.message ?: "The connection was terminated while sending.",
        )
      }
    }
  }

  override fun addOnMessageListener(listener: (data: ArrayBuffer) -> Unit): ListenerSubscription =
    messageListeners.add(listener)

  override fun addOnStateChangedListener(
    listener: (state: ConnectionState) -> Unit
  ): ListenerSubscription = stateListeners.add(listener)

  override fun addOnErrorListener(
    listener: (error: WifiAwareErrorInfo) -> Unit
  ): ListenerSubscription = errorListeners.add(listener)

  override fun getPerformance(): Promise<PerformanceReport?> =
    Promise.async {
      // The platform exposes no link-quality reporting for a Wi-Fi Aware data path, and inventing
      // figures would be worse than reporting none.
      null
    }

  override fun close(): Promise<Unit> =
    Promise.parallel {
      finishClose()
      // Unblocks readFully() so the receive thread can exit promptly.
      receiveThread.interrupt()
    }
}
