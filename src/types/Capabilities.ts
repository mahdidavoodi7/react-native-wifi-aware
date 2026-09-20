/**
 * What this device's hardware and OS are capable of, independent of current radio state.
 *
 * Capabilities are static for the lifetime of the process. For conditions that change while the app
 * runs — Wi-Fi being switched off, sessions being exhausted — use {@linkcode WifiAware.getAvailability}.
 *
 * Always read {@linkcode Capabilities.isSupported} first: when it is `false`, every numeric field is
 * `undefined` and no other API in this library will succeed.
 *
 * @see {@linkcode WifiAware.getCapabilities}
 */
export interface Capabilities {
  /**
   * Whether this device supports Wi-Fi Aware at all.
   *
   * `false` on unsupported hardware, on OS versions below the minimum, and in the iOS Simulator.
   */
  readonly isSupported: boolean;

  /** Maximum number of peers this app can hold data paths to simultaneously. */
  readonly maxConnectableDevices: number | undefined;

  /** Maximum number of services this app can publish at once. */
  readonly maxPublishableServices: number | undefined;

  /** Maximum number of services this app can subscribe to at once. */
  readonly maxSubscribableServices: number | undefined;

  /**
   * Longest service name the radio accepts, in bytes, when the platform reports a limit.
   *
   * This is a separate constraint from the service-name *syntax* rules enforced by
   * {@linkcode validateServiceName}.
   */
  readonly maxServiceNameLength: number | undefined;

  /**
   * Largest advertisement payload the radio accepts, in bytes, when the platform reports a limit.
   *
   * @see {@linkcode PublishOptions.serviceSpecificInfo}
   */
  readonly maxServiceSpecificInfoLength: number | undefined;

  /**
   * Whether this platform pairs devices through **system UI** driven by
   * {@linkcode WifiAware.presentPairingUI}.
   *
   * Mutually exclusive with {@linkcode Capabilities.isProgrammaticPairingSupported} in practice: a
   * platform exposes one pairing model or the other, and your app must handle whichever it finds.
   */
  readonly isPairingUISupported: boolean;

  /**
   * Whether this device can drive pairing **programmatically**, through
   * {@linkcode WifiAware.getProgrammaticPairing}.
   *
   * This is vendor-gated hardware support, not just an OS version check — two devices on the same
   * OS release can disagree. Never assume it from the platform.
   */
  readonly isProgrammaticPairingSupported: boolean;

  /**
   * Whether this device's radio exposes the standardised NAN pairing needed to *attempt* pairing
   * with a peer from a different vendor's ecosystem.
   *
   * **This reports a radio capability, not a working integration.** It does not mean cross-ecosystem
   * pairing succeeds, and it is not a signal that any particular peer will interoperate. Everything
   * behind it is experimental — see the interop section of the README before building on it.
   *
   * @see {@linkcode ProgrammaticPairing.initiatePairingWithForeignPeer}
   */
  readonly isCrossPlatformPairingSupported: boolean;
}
