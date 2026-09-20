import type { WifiAwareErrorCode } from './WifiAwareErrorCode';

/**
 * A failure delivered asynchronously, outside of any single method call.
 *
 * Sessions and connections can fail at any time — the peer walks away, the user disables Wi-Fi, the
 * system reclaims the radio. Those failures arrive through error listeners as this struct, which
 * always carries both a stable {@linkcode WifiAwareErrorInfo.code} to branch on and the untouched
 * platform error for logs and bug reports.
 *
 * Failures caused *by* a call are thrown or rejected from that call instead; use
 * {@linkcode getWifiAwareErrorCode} to classify those.
 *
 * @see {@linkcode Connection.addOnErrorListener}
 * @see {@linkcode PublishSession.addOnErrorListener}
 * @see {@linkcode SubscribeSession.addOnErrorListener}
 */
export interface WifiAwareErrorInfo {
  /** Stable classification to branch on. */
  readonly code: WifiAwareErrorCode;

  /** Human-readable description, suitable for logs. Not for parsing, and not localised. */
  readonly message: string;

  /**
   * Which native error space {@linkcode WifiAwareErrorInfo.nativeCode} belongs to, when the
   * platform supplied a numeric code.
   */
  readonly nativeDomain: string | undefined;

  /** The raw numeric error code from the platform, when it supplied one. */
  readonly nativeCode: number | undefined;

  /** The platform's own description of the error, verbatim and unparsed. */
  readonly nativeDescription: string | undefined;

  /**
   * Additional structured detail the platform attached to the error, as JSON.
   *
   * Contents are platform-defined and unstable between OS releases — include it in diagnostics, but
   * never branch on it. Branch on {@linkcode WifiAwareErrorInfo.code}.
   */
  readonly nativeDetails: string | undefined;
}
