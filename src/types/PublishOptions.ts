import type { DeviceSelector } from './DeviceSelector';
import type { PerformanceMode } from './PerformanceMode';
import type { SessionPairingOptions } from './SessionPairingOptions';

/**
 * Configuration for advertising a service to nearby devices.
 *
 * @see {@linkcode WifiAware.publish}
 */
export interface PublishOptions {
  /**
   * The service to advertise, in DNS-SD form such as `_chat._tcp`.
   *
   * Must be declared in the app's configuration ahead of time and must satisfy the naming rules —
   * see {@linkcode validateServiceName}. A given service may be published only once per device.
   *
   * @throws A `'service-not-declared'` error if the name is absent from the app's configuration.
   * @throws A `'service-already-publishing'` error if this device is already advertising it.
   */
  readonly serviceName: string;

  /**
   * Which paired devices may connect to this service.
   *
   * Narrow this as soon as you know the intended peer: broad selectors keep the radio working
   * harder and advertise interest in more devices than necessary.
   *
   * @default { kind: 'all-paired' }
   */
  readonly devices?: DeviceSelector;

  /**
   * Throughput/latency trade-off for data paths accepted by this session.
   *
   * **Must match the value the connecting peer uses.** Mismatched modes are undefined behaviour at
   * the platform level, not a negotiated fallback.
   *
   * @default 'bulk'
   */
  readonly performanceMode?: PerformanceMode;

  /**
   * How long to keep advertising before the session stops on its own, in milliseconds.
   *
   * Omit to advertise until you call {@linkcode PublishSession.stop}. Bounding this is good
   * practice — an advertisement left running costs power and keeps the device discoverable.
   */
  readonly activeDurationMs?: number;

  /**
   * Small opaque payload to attach to the advertisement so subscribers can tell instances apart.
   *
   * Discovery frames are unencrypted and severely size-limited; check
   * {@linkcode Capabilities.maxServiceSpecificInfoLength}. Never put application data or anything
   * sensitive here.
   */
  readonly serviceSpecificInfo?: ArrayBuffer;

  /**
   * Shared secret used to encrypt data paths accepted by this session, where the platform requires
   * the app to supply one.
   *
   * The connecting peer must supply the identical value in
   * {@linkcode ConnectionOptions.passphrase}. Deliver it through a channel you already trust — do
   * not send it over the discovery channel, which is unencrypted.
   *
   * Where the platform derives data-path keys from the pairing itself, this is not needed and is
   * ignored.
   *
   * @throws An `'invalid-argument'` error if the platform requires a secret and none is given.
   */
  readonly passphrase?: string;

  /**
   * Whether and how peers may pair against this session.
   *
   * Ignored where pairing is driven by system UI.
   */
  readonly pairing?: SessionPairingOptions;
}
