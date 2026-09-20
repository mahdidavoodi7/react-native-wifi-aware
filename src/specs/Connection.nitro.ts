import type { HybridObject } from 'react-native-nitro-modules';
import type { ConnectionState } from '../types/ConnectionState';
import type { ListenerSubscription } from '../types/ListenerSubscription';
import type { PerformanceReport } from '../types/PerformanceReport';
import type { WifiAwareErrorInfo } from '../types/WifiAwareErrorInfo';

/**
 * An established, authenticated and encrypted data path to a single peer.
 *
 * This is the high-bandwidth channel Wi-Fi Aware exists to provide: it carries arbitrary binary
 * payloads directly between two devices with no access point and no internet. It is obtained from
 * {@linkcode SubscribeSession.connect} on the subscribing side, and delivered to
 * {@linkcode PublishSession.addOnConnectionListener} on the publishing side.
 *
 * A connection owns native radio resources. Call {@linkcode Connection.close} when you are done —
 * the system will otherwise hold the data path open until it times out, costing the user battery.
 *
 * @see {@linkcode WifiAware}
 */
export interface Connection extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /** Identifier for this connection, unique within the process. */
  readonly id: string;

  /**
   * The peer at the far end, as a {@linkcode DiscoveredPeer.id} for connections you initiated or a
   * session-scoped identifier for inbound ones.
   */
  readonly peerId: string;

  /**
   * Current lifecycle state.
   *
   * Reads the last known state without touching the radio. To react to changes, use
   * {@linkcode Connection.addOnStateChangedListener} rather than polling.
   */
  readonly state: ConnectionState;

  /**
   * Sends a binary payload to the peer.
   *
   * The buffer is read synchronously and may be reused or detached as soon as the call returns, so
   * there is no need to keep it alive until the promise settles.
   *
   * Delivery is ordered and reliable for as long as the connection stays in
   * {@linkcode ConnectionState | 'ready'}. Large payloads are streamed rather than buffered whole,
   * but back-pressure is real: await each send instead of firing many concurrently.
   *
   * @throws A `'connection-closed'` error if the connection is no longer open.
   * @throws A `'connection-terminated'` error if the peer or system dropped the path mid-send.
   */
  send(data: ArrayBuffer): Promise<void>;

  /**
   * Registers a listener for payloads arriving from the peer.
   *
   * The buffer passed to the callback is **only valid for the duration of the call**. If you need
   * to keep the bytes, copy them synchronously — for example with `data.slice(0)` — before
   * returning or awaiting anything.
   *
   * @returns A subscription; call {@linkcode ListenerSubscription.remove} to stop receiving.
   */
  addOnMessageListener(
    listener: (data: ArrayBuffer) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for lifecycle changes.
   *
   * Subscribe before the connection is used if a transition to
   * {@linkcode ConnectionState | 'failed'} would be observable, since states can change immediately.
   */
  addOnStateChangedListener(
    listener: (state: ConnectionState) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for failures that occur outside of a specific call — the peer leaving,
   * the radio being reclaimed, an idle timeout.
   *
   * Failures caused by a call are thrown from that call instead.
   */
  addOnErrorListener(
    listener: (error: WifiAwareErrorInfo) => void
  ): ListenerSubscription;

  /**
   * Reads current link quality for this data path.
   *
   * Resolves to `undefined` when the platform has no report available — commonly right after the
   * connection opens, before the radio has measured anything. Individual metrics are independently
   * optional even when a report exists.
   *
   * Cheap enough to poll for a live signal display, but this does cross into the radio subsystem;
   * a refresh every second or two is plenty.
   *
   * @see {@linkcode PerformanceReport}
   */
  getPerformance(): Promise<PerformanceReport | undefined>;

  /**
   * Closes the data path and releases its radio resources.
   *
   * Idempotent. In-flight sends are abandoned. After this resolves the connection is permanently in
   * {@linkcode ConnectionState | 'closed'} and cannot be reopened — establish a new one through
   * {@linkcode SubscribeSession.connect}.
   */
  close(): Promise<void>;
}
