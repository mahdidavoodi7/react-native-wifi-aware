import type { HybridObject } from 'react-native-nitro-modules';
import type { ListenerSubscription } from '../types/ListenerSubscription';
import type { WifiAwareErrorInfo } from '../types/WifiAwareErrorInfo';
import type { Connection } from './Connection.nitro';

/**
 * An active advertisement of a service, accepting inbound connections from paired peers.
 *
 * A publisher does not search for peers — it makes itself findable and waits. Peers that discover
 * it and open a data path arrive through {@linkcode PublishSession.addOnConnectionListener}.
 *
 * The session holds the radio for as long as it runs. Call {@linkcode PublishSession.stop} once
 * you have the connections you need; Apple explicitly recommends stopping the listener after
 * connecting.
 *
 * @see {@linkcode WifiAware.publish}
 */
export interface PublishSession extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /** The service being advertised, as passed to {@linkcode WifiAware.publish}. */
  readonly serviceName: string;

  /**
   * Whether the session is still advertising.
   *
   * Becomes `false` after {@linkcode PublishSession.stop}, after the configured active duration
   * elapses, or if the system terminates the session.
   */
  readonly isActive: boolean;

  /**
   * Registers a listener for peers that have opened a data path to this service.
   *
   * Each callback delivers a ready-to-use {@linkcode Connection} that **you now own** — keep a
   * reference and call {@linkcode Connection.close} when finished, or it will hold radio resources
   * until it times out.
   *
   * Register this before or immediately after publishing; a peer can connect as soon as the
   * advertisement is live.
   */
  addOnConnectionListener(
    listener: (connection: Connection) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for failures that end or degrade the session, such as the radio being
   * reclaimed or the system terminating the advertisement.
   */
  addOnErrorListener(
    listener: (error: WifiAwareErrorInfo) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for the session ending, whether through
   * {@linkcode PublishSession.stop}, the active duration elapsing, or system termination.
   */
  addOnStoppedListener(listener: () => void): ListenerSubscription;

  /**
   * Registers a listener for short messages sent by peers over the discovery channel.
   *
   * Only fires where the platform provides a discovery-level message channel; on platforms without
   * one it simply never fires. See {@linkcode PublishSession.sendDiscoveryMessage} for the
   * constraints that apply to this channel.
   */
  addOnDiscoveryMessageListener(
    listener: (peerId: string, data: ArrayBuffer) => void
  ): ListenerSubscription;

  /**
   * Sends a very small message to a peer over the **discovery** channel rather than a data path.
   *
   * This is a handshake channel, not a transport. It is:
   * - severely size-limited — see {@linkcode Capabilities.maxServiceSpecificInfoLength};
   * - **not guaranteed to be delivered**, with no retry and no ordering;
   * - not available on every platform.
   *
   * Use it to agree on a rendezvous before opening a data path, and send application payloads
   * through {@linkcode Connection.send} instead.
   *
   * @throws An `'unsupported-operation'` error where the platform has no discovery message channel.
   * @throws A `'message-send-failed'` error if the system could not transmit the message. This does
   *         not mean a successfully sent message was received.
   */
  sendDiscoveryMessage(peerId: string, data: ArrayBuffer): Promise<void>;

  /**
   * Stops advertising and releases the session's radio resources.
   *
   * Idempotent. Connections already established stay open and must be closed separately — stopping
   * the advertisement does not tear down live data paths.
   */
  stop(): Promise<void>;
}
