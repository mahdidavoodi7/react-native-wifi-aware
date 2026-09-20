import type { HybridObject } from 'react-native-nitro-modules';
import type { ConnectionOptions } from '../types/ConnectionOptions';
import type { DiscoveredPeer } from '../types/DiscoveredPeer';
import type { ListenerSubscription } from '../types/ListenerSubscription';
import type { WifiAwareErrorInfo } from '../types/WifiAwareErrorInfo';
import type { Connection } from './Connection.nitro';

/**
 * An active search for nearby devices advertising a service.
 *
 * A subscriber discovers peers and decides which to connect to. Peers appear through
 * {@linkcode SubscribeSession.addOnPeerFoundListener}; opening a data path to one is
 * {@linkcode SubscribeSession.connect}.
 *
 * Searching costs power, so stop the session once you have connected.
 *
 * @see {@linkcode WifiAware.subscribe}
 */
export interface SubscribeSession extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /** The service being searched for, as passed to {@linkcode WifiAware.subscribe}. */
  readonly serviceName: string;

  /**
   * Whether the session is still searching.
   *
   * Becomes `false` after {@linkcode SubscribeSession.stop}, after the configured active duration
   * elapses, or if the system terminates the session.
   */
  readonly isActive: boolean;

  /**
   * Registers a listener for peers found advertising this service.
   *
   * May fire repeatedly for the same peer as its advertisement is refreshed; key any UI on
   * {@linkcode DiscoveredPeer.id} rather than appending blindly.
   *
   * A discovered peer is not necessarily connectable — check
   * {@linkcode DiscoveredPeer.pairedDeviceId} to know whether it still needs pairing.
   */
  addOnPeerFoundListener(
    listener: (peer: DiscoveredPeer) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for peers that have gone out of range or stopped advertising.
   *
   * Not every platform reports loss promptly, or at all — treat this as a hint for tidying up UI,
   * not as a reliable signal that a peer is gone.
   */
  addOnPeerLostListener(
    listener: (peerId: string) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for failures that end or degrade the session.
   */
  addOnErrorListener(
    listener: (error: WifiAwareErrorInfo) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for the session ending, whether through
   * {@linkcode SubscribeSession.stop}, the active duration elapsing, or system termination.
   */
  addOnStoppedListener(listener: () => void): ListenerSubscription;

  /**
   * Registers a listener for short messages sent by peers over the discovery channel.
   *
   * @see {@linkcode SubscribeSession.sendDiscoveryMessage}
   */
  addOnDiscoveryMessageListener(
    listener: (peerId: string, data: ArrayBuffer) => void
  ): ListenerSubscription;

  /**
   * Sends a very small, best-effort message to a peer over the **discovery** channel.
   *
   * Subject to the same limits as {@linkcode PublishSession.sendDiscoveryMessage}: tiny, unreliable,
   * unordered, and not available on every platform. Not a transport.
   *
   * @throws An `'unsupported-operation'` error where the platform has no discovery message channel.
   * @throws A `'message-send-failed'` error if the system could not transmit the message.
   */
  sendDiscoveryMessage(peerId: string, data: ArrayBuffer): Promise<void>;

  /**
   * Opens a data path to a discovered peer.
   *
   * The peer must already be paired with this app. Resolves once the path is usable, so the
   * returned {@linkcode Connection} is ready to {@linkcode Connection.send} immediately — there is
   * no separate readiness step to wait for.
   *
   * You own the returned connection: close it when finished.
   *
   * @throws A `'device-no-longer-available'` error if the peer left before the path was established.
   * @throws A `'no-paired-devices'` error if the peer has not been paired with this app.
   * @throws A `'connection-failed'` error if the data path could not be established, including when
   *         {@linkcode ConnectionOptions.timeoutMs} elapses.
   */
  connect(peerId: string, options?: ConnectionOptions): Promise<Connection>;

  /**
   * Stops searching and releases the session's radio resources.
   *
   * Idempotent. Connections already established stay open and must be closed separately.
   */
  stop(): Promise<void>;
}
