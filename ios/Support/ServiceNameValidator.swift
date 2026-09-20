import Foundation

/// Validates Wi-Fi Aware service names against the platform's naming rules.
///
/// A malformed name declared in `Info.plist` crashes the app at launch, so the rules are enforced at
/// three points: in the Expo config plugin at build time, in JS via `validateServiceName()`, and
/// here before any name reaches the framework. The three implementations must stay in step.
enum ServiceNameValidator {
  /// Longest permitted name component, in characters.
  private static let maximumLabelLength = 15

  /// Throws `invalid-service-name` describing the specific rule broken, if any.
  static func assertValid(_ serviceName: String) throws {
    let parts = serviceName.split(separator: ".", omittingEmptySubsequences: false)

    guard parts.count == 2, parts[0].hasPrefix("_"),
      parts[1] == "_tcp" || parts[1] == "_udp"
    else {
      throw WifiAwareFailure.error(
        .invalidServiceName,
        "Service name \"\(serviceName)\" must look like \"_name._tcp\" or \"_name._udp\"."
      )
    }

    let label = String(parts[0].dropFirst())

    guard !label.isEmpty, label.count <= maximumLabelLength else {
      throw WifiAwareFailure.error(
        .invalidServiceName,
        "Service name \"\(serviceName)\" has a \(label.count)-character name component "
          + "(\"\(label)\"), but it must be between 1 and \(maximumLabelLength) characters."
      )
    }

    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz")
      .union(CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"))
    guard label.unicodeScalars.allSatisfy({ allowed.contains($0) }) else {
      throw WifiAwareFailure.error(
        .invalidServiceName,
        "Service name \"\(serviceName)\" has a name component (\"\(label)\") containing "
          + "characters outside a-z, A-Z, 0-9 and \"-\"."
      )
    }

    guard label.contains(where: { $0.isLetter }) else {
      throw WifiAwareFailure.error(
        .invalidServiceName,
        "Service name \"\(serviceName)\" has a name component (\"\(label)\") with no letter in "
          + "it; at least one a-z or A-Z character is required."
      )
    }

    guard !label.hasPrefix("-"), !label.hasSuffix("-") else {
      throw WifiAwareFailure.error(
        .invalidServiceName,
        "Service name \"\(serviceName)\" has a name component (\"\(label)\") that starts or ends "
          + "with a hyphen, which is not allowed."
      )
    }
  }
}
