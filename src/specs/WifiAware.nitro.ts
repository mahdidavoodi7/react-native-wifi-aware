import type { HybridObject } from 'react-native-nitro-modules';
import type { Availability } from '../types/Availability';
import type { Capabilities } from '../types/Capabilities';
import type { ListenerSubscription } from '../types/ListenerSubscription';
import type { PairedDevice } from '../types/PairedDevice';
import type { PairingUIOptions } from '../types/PairingUIOptions';
import type { PublishOptions } from '../types/PublishOptions';
import type { SubscribeOptions } from '../types/SubscribeOptions';
import type { ProgrammaticPairing } from './ProgrammaticPairing.nitro';
import type { PublishSession } from './PublishSession.nitro';
import type { SubscribeSession } from './SubscribeSession.nitro';

/**
 * Peer-to-peer discovery and high-bandwidth data paths over Wi-Fi Aware, with no access point and
 * no internet connection.
 *
 * The root of the library. Typical flow:
 *
 * 1. Check {@linkcode WifiAware.getCapabilities} — nothing else works without it.
 * 2. Make sure the peer is paired, through {@linkcode WifiAware.presentPairingUI} or
 *    {@linkcode WifiAware.getProgrammaticPairing} depending on what the device supports. Pairing is
 *    mandatory and one-time.
 * 3. {@linkcode WifiAware.publish} on one device and {@linkcode WifiAware.subscribe} on the other.
 * 4. Connect from the subscriber, then move bytes over the resulting {@linkcode Connection}.
 *
 * @example
 * ```ts
 * const capabilities = await wifiAware.getCapabilities()
 * if (!capabilities.isSupported) return
 *
 * const session = await wifiAware.subscribe({ serviceName: '_chat._tcp' })
 * const found = session.addOnPeerFoundListener(async (peer) => {
 *   if (peer.pairedDeviceId == null) return
 *   const connection = await session.connect(peer.id, { performanceMode: 'bulk' })
 *   await session.stop()
 *   await connection.send(new TextEncoder().encode('hello').buffer)
 * })
 * // later: found.remove()
 * ```
 */
export interface WifiAware extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * Reads what this device's hardware and OS support.
   *
   * Call this before anything else and branch on
   * {@linkcode Capabilities.isSupported}. Capabilities do not change while the app runs, so the
   * result is safe to cache for the process lifetime.
   */
  getCapabilities(): Promise<Capabilities>;

  /**
   * Reads whether Wi-Fi Aware is usable at this moment.
   *
   * Distinct from {@linkcode WifiAware.getCapabilities}: a fully capable device is unavailable
   * while Wi-Fi is off or another feature holds the radio. Check before starting a session, and
   * prefer {@linkcode WifiAware.addOnAvailabilityChangedListener} over polling.
   */
  getAvailability(): Promise<Availability>;

  /**
   * Registers a listener for availability changing while the app runs.
   *
   * Fires on transitions the platform reports, such as Wi-Fi being switched off or resources being
   * freed. Platforms that do not broadcast these transitions simply never fire it, so treat this as
   * an optimisation over polling rather than a guarantee.
   */
  addOnAvailabilityChangedListener(
    listener: (availability: Availability) => void
  ): ListenerSubscription;

  /**
   * Presents the system's pairing UI and resolves once the user finishes with it.
   *
   * Pairing is mandatory before any data path can be established, and where the system owns it your
   * app cannot pair programmatically — it can only present this UI. Resolves to the newly paired
   * device, or `undefined` if the user dismissed the UI without pairing.
   *
   * Users manage and revoke existing pairings in system settings, not through this library.
   *
   * @throws An `'unsupported-operation'` error where pairing is app-driven instead; use
   *         {@linkcode WifiAware.getProgrammaticPairing} there.
   * @throws An `'entitlement-missing'` or `'service-not-declared'` error if the app is not
   *         configured for this service and role.
   * @see {@linkcode Capabilities.isPairingUISupported}
   */
  presentPairingUI(
    options: PairingUIOptions
  ): Promise<PairedDevice | undefined>;

  /**
   * Returns the app-driven pairing API for platforms where the app owns the pairing flow.
   *
   * Fails rather than returning something inert, so that holding a
   * {@linkcode ProgrammaticPairing} is itself proof that programmatic pairing works on this device.
   * Support is vendor-gated hardware, not an OS version — check
   * {@linkcode Capabilities.isProgrammaticPairingSupported} to decide which pairing UI to build.
   *
   * @throws A `'programmatic-pairing-unsupported'` error where this device cannot pair
   *         programmatically, including every platform that pairs through system UI.
   */
  getProgrammaticPairing(): Promise<ProgrammaticPairing>;

  /**
   * Lists devices this app has already paired with.
   *
   * Only pairings belonging to this app are visible. An empty array means the user must pair before
   * any connection can be made.
   */
  getPairedDevices(): Promise<PairedDevice[]>;

  /**
   * Registers a listener for the set of paired devices changing.
   *
   * Fires when a pairing is added or removed, including when the user removes one in system
   * settings while the app is running. The callback receives the complete current set, not a delta.
   */
  addOnPairedDevicesChangedListener(
    listener: (devices: PairedDevice[]) => void
  ): ListenerSubscription;

  /**
   * Removes a pairing, so the device can no longer be connected to without pairing again.
   *
   * Affects only this app's pairings. Live connections to that device are not torn down — close
   * them separately if that is what you intend.
   *
   * @throws An `'unsupported-operation'` error on platforms where only the user may remove a
   *         pairing, through system settings.
   */
  removePairedDevice(deviceId: string): Promise<void>;

  /**
   * Starts advertising a service so paired peers can discover and connect to it.
   *
   * Resolves once the advertisement is live, so the returned session is immediately usable. A
   * service may be published only once per device.
   *
   * @throws An `'invalid-service-name'` error if the name breaks the naming rules.
   * @throws A `'service-not-declared'` error if the name is absent from the app's configuration.
   * @throws A `'service-already-publishing'` error if it is already being advertised.
   * @throws An `'unavailable'` error if the radio is not currently usable.
   */
  publish(options: PublishOptions): Promise<PublishSession>;

  /**
   * Starts searching for paired peers advertising a service.
   *
   * Resolves once the search is live, so the returned session is immediately usable.
   *
   * @throws An `'invalid-service-name'` error if the name breaks the naming rules.
   * @throws A `'service-not-declared'` error if the name is absent from the app's configuration.
   * @throws A `'service-already-subscribing'` error if it is already being searched for.
   * @throws An `'unavailable'` error if the radio is not currently usable.
   */
  subscribe(options: SubscribeOptions): Promise<SubscribeSession>;
}
