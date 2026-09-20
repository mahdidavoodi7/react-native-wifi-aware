import type { AccessCategory } from './AccessCategory';
import type { PerformanceMode } from './PerformanceMode';

/**
 * Configuration for establishing a data path to a peer.
 *
 * @see {@linkcode SubscribeSession.connect}
 */
export interface ConnectionOptions {
  /**
   * Throughput/latency trade-off for this data path.
   *
   * **Must match the value the peer used when it published.** The platforms do not negotiate this
   * and do not report a mismatch — a mismatched pair produces undefined behaviour, so agree on the
   * mode out of band or exchange it in your own handshake.
   *
   * @default 'bulk'
   */
  readonly performanceMode?: PerformanceMode;

  /**
   * Quality-of-service category for traffic on this data path.
   *
   * Pick the lowest category that meets your needs; it improves throughput for every device in
   * range, including your own.
   *
   * @default 'best-effort'
   */
  readonly accessCategory?: AccessCategory;

  /**
   * Shared secret used to encrypt the data path, where the platform requires the app to supply one.
   *
   * Both peers must supply the identical value. It must be delivered through a channel you already
   * trust — derived from the pairing, entered by the user, or fetched from your backend. Do not send
   * it over the discovery channel, which is unencrypted.
   *
   * Where the platform derives data-path keys from the pairing itself, this value is not needed and
   * is ignored.
   *
   * @throws An `'invalid-argument'` error if the platform requires a secret and none is available.
   */
  readonly passphrase?: string;

  /**
   * How long to wait for the data path to become usable before giving up, in milliseconds.
   *
   * Omit to wait for the platform's own timeout, whose duration is not published and differs
   * between devices. Setting an explicit budget is recommended for interactive flows.
   *
   * @throws A `'connection-failed'` error when the budget elapses first.
   */
  readonly timeoutMs?: number;
}
