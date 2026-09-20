/**
 * Stable, machine-readable classification of a Wi-Fi Aware failure.
 *
 * Every platform failure maps to exactly one code, so app logic can branch on the code rather than
 * on message text. The originating platform error is always preserved alongside it in
 * {@linkcode WifiAwareErrorInfo}.
 *
 * @see {@linkcode WifiAwareErrorInfo.code}
 * @see {@linkcode getWifiAwareErrorCode}
 */
export type WifiAwareErrorCode =
  // ── Support and configuration ──────────────────────────────────────────────
  /** This device cannot do Wi-Fi Aware: unsupported hardware, OS, or the iOS Simulator. */
  | 'unsupported'
  /**
   * Supported, but not usable right now — typically Wi-Fi is off, or another feature such as Wi-Fi
   * Direct, tethering or a hotspot has taken the radio.
   */
  | 'unavailable'
  /** The app is missing a permission or entitlement required for this operation. */
  | 'permission-denied'
  /**
   * The app binary is missing the Wi-Fi Aware entitlement.
   *
   * This is a build-configuration failure, not a runtime condition — the entitlement is a managed
   * capability that must be granted before it can be embedded.
   */
  | 'entitlement-missing'
  /**
   * The service name was not declared in the app's configuration, so the system refuses to publish
   * or subscribe to it.
   */
  | 'service-not-declared'
  /** The service name does not satisfy the naming rules checked by {@linkcode validateServiceName}. */
  | 'invalid-service-name'
  /** The operation does not exist on this platform. The message names the API to use instead. */
  | 'unsupported-operation'
  /** An argument was outside the range or shape the platform accepts. */
  | 'invalid-argument'

  // ── Radio and session resources ────────────────────────────────────────────
  /** The radio had no capacity left for this session or data path. */
  | 'no-radio-resources'
  /** This app is already publishing that service. A service may be published only once per device. */
  | 'service-already-publishing'
  /** This app is already subscribing to that service. */
  | 'service-already-subscribing'
  /** Attaching to the Wi-Fi Aware subsystem failed. */
  | 'attach-failed'
  /** The system rejected the session configuration. */
  | 'session-config-failed'
  /** The discovery session ended, by request or because the system terminated it. */
  | 'session-terminated'
  /** The publisher stopped before a peer connected. */
  | 'publisher-timeout'
  /** The subscriber stopped before it found a peer. */
  | 'subscriber-timeout'

  // ── Peers and pairing ──────────────────────────────────────────────────────
  /** No paired devices are available to this app, so there is nothing to connect to. */
  | 'no-paired-devices'
  /** The referenced device is not one this app may use. */
  | 'device-invalid'
  /** The peer was known but has gone out of range or stopped advertising. */
  | 'device-no-longer-available'
  /** The user dismissed the pairing UI without completing pairing. */
  | 'pairing-cancelled'
  /** Pairing setup failed before a pairing was established. */
  | 'pairing-failed'
  /** Verification of an existing pairing failed. */
  | 'pairing-verification-failed'
  /** The bootstrapping exchange that carries the pairing secret failed. */
  | 'bootstrapping-failed'
  /** This device cannot pair programmatically, per {@linkcode Capabilities.isProgrammaticPairingSupported}. */
  | 'programmatic-pairing-unsupported'

  // ── Data path ──────────────────────────────────────────────────────────────
  /** The data path could not be established. */
  | 'connection-failed'
  /** The system closed the data path after it sat idle. */
  | 'connection-idle-timeout'
  /** The data path was terminated by the peer or the system. */
  | 'connection-terminated'
  /** The operation targeted a connection that is already closed. */
  | 'connection-closed'
  /** The system did not provide a usable address for the peer, so no socket could be opened. */
  | 'peer-address-unavailable'
  /** A best-effort message sent via {@linkcode PublishSession.sendDiscoveryMessage} was not delivered. */
  | 'message-send-failed'

  /** The platform reported a failure that does not map to any more specific code. */
  | 'unknown';
