package com.margelo.nitro.wifiaware.support

/**
 * Message framing for the Wi-Fi Aware data path.
 *
 * The data path is a byte stream, but the JS API is message-oriented: one `send()` must arrive as
 * exactly one `onMessage`. Each payload is prefixed with its length as a 4-byte big-endian
 * unsigned integer.
 *
 * **This format is part of the wire contract and is identical on iOS and Android.** Changing it on
 * one platform breaks interoperability between two devices running this library.
 */
object MessageFraming {
  /** Size of the length prefix in bytes. */
  const val HEADER_SIZE = 4

  /**
   * Largest payload that may be framed, in bytes.
   *
   * Bounds the allocation made when a length prefix is read, so a corrupt or hostile prefix cannot
   * make the receiver reserve an arbitrary amount of memory.
   */
  const val MAXIMUM_PAYLOAD_SIZE = 64 * 1024 * 1024

  /** Writes a big-endian length prefix into a 4-byte array. */
  fun header(length: Int): ByteArray =
    byteArrayOf(
      (length ushr 24).toByte(),
      (length ushr 16).toByte(),
      (length ushr 8).toByte(),
      length.toByte(),
    )

  /** Reads a big-endian length prefix. */
  fun payloadLength(header: ByteArray): Int =
    ((header[0].toInt() and 0xFF) shl 24) or
      ((header[1].toInt() and 0xFF) shl 16) or
      ((header[2].toInt() and 0xFF) shl 8) or
      (header[3].toInt() and 0xFF)
}
