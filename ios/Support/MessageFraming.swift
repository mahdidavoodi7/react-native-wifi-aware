import Foundation

/// Message framing for the Wi-Fi Aware data path.
///
/// The platform data path is a byte stream, but the JS API is message-oriented: one `send()` must
/// arrive as exactly one `onMessage`. Each payload is therefore prefixed with its length as a
/// 4-byte big-endian unsigned integer.
///
/// **This format is part of the wire contract and is identical on iOS and Android.** Changing it on
/// one platform breaks interoperability between two devices running this library.
enum MessageFraming {
  /// Size of the length prefix in bytes.
  static let headerSize = 4

  /// Largest payload that may be framed, in bytes.
  ///
  /// Bounds the allocation made when a length prefix is read, so a corrupt or hostile prefix cannot
  /// make the receiver reserve an arbitrary amount of memory.
  static let maximumPayloadSize = 64 * 1024 * 1024

  /// Prefixes `payload` with its big-endian length.
  static func frame(_ payload: Data) -> Data {
    var framed = Data(capacity: headerSize + payload.count)
    var length = UInt32(payload.count).bigEndian
    withUnsafeBytes(of: &length) { framed.append(contentsOf: $0) }
    framed.append(payload)
    return framed
  }

  /// Reads a length prefix.
  static func payloadLength(from header: Data) -> Int {
    let value = header.withUnsafeBytes { raw -> UInt32 in
      raw.loadUnaligned(as: UInt32.self)
    }
    return Int(UInt32(bigEndian: value))
  }
}
