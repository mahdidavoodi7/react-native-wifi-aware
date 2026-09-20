/**
 * Whether Wi-Fi Aware can be used *right now*, and how much capacity is left.
 *
 * Distinct from {@linkcode Capabilities}, which describes fixed hardware support. Availability
 * changes while the app runs: turning Wi-Fi off, or another app taking over the radio for Wi-Fi
 * Direct, tethering or a hotspot, can all make a supported device temporarily unavailable.
 *
 * @see {@linkcode WifiAware.getAvailability}
 * @see {@linkcode WifiAware.addOnAvailabilityChangedListener}
 */
export interface Availability {
  /**
   * Whether a session can be started at this moment.
   *
   * `false` while the radio is unavailable. This is worth re-checking rather than caching, and
   * worth surfacing to the user, since the usual fix is "turn Wi-Fi back on".
   */
  readonly isAvailable: boolean;

  /**
   * Data paths still free for this device to establish, when the platform reports live resource
   * accounting.
   *
   * `undefined` means the platform does not expose running counts — not that none are free.
   */
  readonly availableDataPaths: number | undefined;

  /** Publish sessions still free, when the platform reports live resource accounting. */
  readonly availablePublishSessions: number | undefined;

  /** Subscribe sessions still free, when the platform reports live resource accounting. */
  readonly availableSubscribeSessions: number | undefined;
}
