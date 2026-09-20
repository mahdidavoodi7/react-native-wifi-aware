import type { DeviceSelector } from './DeviceSelector';
import type { SessionPairingOptions } from './SessionPairingOptions';

/**
 * Configuration for discovering nearby devices advertising a service.
 *
 * @see {@linkcode WifiAware.subscribe}
 */
export interface SubscribeOptions {
  /**
   * The service to look for, in DNS-SD form such as `_chat._tcp`.
   *
   * Must be declared in the app's configuration ahead of time and must satisfy the naming rules —
   * see {@linkcode validateServiceName}.
   *
   * @throws A `'service-not-declared'` error if the name is absent from the app's configuration.
   * @throws A `'service-already-subscribing'` error if this device is already subscribed to it.
   */
  readonly serviceName: string;

  /**
   * Which paired devices this session is willing to discover.
   *
   * @default { kind: 'all-paired' }
   */
  readonly devices?: DeviceSelector;

  /**
   * How long to keep searching before the session stops on its own, in milliseconds.
   *
   * Omit to search until you call {@linkcode SubscribeSession.stop}. Apple recommends stopping
   * discovery once you have connected, since searching costs power.
   */
  readonly activeDurationMs?: number;

  /**
   * Small opaque payload to attach to the subscription so publishers can tell subscribers apart.
   *
   * Subject to the same size limit and the same lack of encryption as
   * {@linkcode PublishOptions.serviceSpecificInfo}.
   */
  readonly serviceSpecificInfo?: ArrayBuffer;

  /**
   * Whether and how this session may pair with discovered peers.
   *
   * Ignored where pairing is driven by system UI.
   */
  readonly pairing?: SessionPairingOptions;
}
