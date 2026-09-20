import type { HybridObject } from 'react-native-nitro-modules';
import type { BootstrappingMethod } from '../types/BootstrappingMethod';
import type { InitiatePairingOptions } from '../types/InitiatePairingOptions';
import type { ListenerSubscription } from '../types/ListenerSubscription';
import type { PairedDevice } from '../types/PairedDevice';
import type { PairingRequest } from '../types/PairingRequest';

/**
 * App-driven pairing, for platforms where the app owns the pairing flow instead of the system.
 *
 * The two pairing models this library spans are genuinely different, and this object is the seam
 * rather than a papered-over abstraction. Where the system owns pairing, your app presents
 * {@linkcode WifiAware.presentPairingUI} and never sees a PIN. Here, your app builds the UI: it
 * chooses a bootstrapping method, shows or collects the secret, and drives the exchange.
 *
 * Obtain it from {@linkcode WifiAware.getProgrammaticPairing}, which fails on platforms and devices
 * that cannot do this — so every method here is guaranteed to be meaningful once you hold one.
 *
 * @see {@linkcode Capabilities.isProgrammaticPairingSupported}
 */
export interface ProgrammaticPairing extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * Bootstrapping methods this device can drive.
   *
   * Intersect with {@linkcode ProgrammaticPairing.getSupportedMethods} for a peer to find a method
   * both sides can use, and advertise only the ones your UI actually implements — offering
   * `'qr-scan'` without a scanner leaves the peer waiting.
   */
  readonly supportedBootstrappingMethods: BootstrappingMethod[];

  /**
   * Reads the bootstrapping methods a discovered peer is willing to use.
   *
   * Useful both when answering an inbound {@linkcode PairingRequest} and before starting one of
   * your own, since a method the peer cannot drive will simply never complete.
   *
   * Synchronous: the peer advertises these in the discovery frame, so the answer is already known
   * locally and no radio work is involved.
   *
   * @returns An empty array if the peer is no longer visible, or advertised no methods.
   */
  getSupportedMethods(peerId: string): BootstrappingMethod[];

  /**
   * Asks a peer to begin the bootstrapping exchange using an agreed method.
   *
   * This negotiates *how* the secret will be exchanged; it does not itself pair. Await the result,
   * then run your UI for that method — display the PIN, show the QR code, prompt for input — and
   * call {@linkcode ProgrammaticPairing.initiatePairing} with the secret.
   *
   * @throws An `'invalid-argument'` error if the method is not in
   *         {@linkcode ProgrammaticPairing.supportedBootstrappingMethods}.
   * @throws A `'bootstrapping-failed'` error if the peer declined or the exchange failed.
   */
  requestBootstrapping(
    peerId: string,
    bootstrappingMethod: BootstrappingMethod
  ): Promise<void>;

  /**
   * Starts pairing with a peer, supplying the secret exchanged out of band.
   *
   * Resolves once the pairing is established and usable for data paths.
   *
   * @throws A `'pairing-failed'` error if the peer rejected the request or the secret did not match.
   * @throws A `'device-no-longer-available'` error if the peer left mid-flow.
   */
  initiatePairing(options: InitiatePairingOptions): Promise<PairedDevice>;

  /**
   * Accepts an inbound pairing request from
   * {@linkcode ProgrammaticPairing.addOnPairingRequestListener}.
   *
   * Pass {@linkcode PairingRequest.requestId} through {@linkcode InitiatePairingOptions} together
   * with the secret the user supplied.
   *
   * @throws A `'pairing-failed'` error if the secret did not match or the request expired.
   */
  acceptPairingRequest(
    requestId: number,
    options: InitiatePairingOptions
  ): Promise<PairedDevice>;

  /**
   * Declines an inbound pairing request.
   *
   * Always decline explicitly rather than ignoring a request — it lets the peer's UI fail fast
   * instead of waiting for a timeout.
   */
  rejectPairingRequest(requestId: number, peerId: string): Promise<void>;

  /**
   * Registers a listener for peers asking to pair with this device.
   *
   * Present the request to the user and respond with
   * {@linkcode ProgrammaticPairing.acceptPairingRequest} or
   * {@linkcode ProgrammaticPairing.rejectPairingRequest}. Requests expire if left unanswered.
   */
  addOnPairingRequestListener(
    listener: (request: PairingRequest) => void
  ): ListenerSubscription;

  /**
   * Registers a listener for a peer completing the bootstrapping exchange.
   *
   * Fires on the responding device once a peer's
   * {@linkcode ProgrammaticPairing.requestBootstrapping} succeeds, telling you which method was
   * agreed so you can show the matching UI.
   */
  addOnBootstrappingListener(
    listener: (peerId: string, bootstrappingMethod: BootstrappingMethod) => void
  ): ListenerSubscription;

  /**
   * Attempts to pair with a peer outside this device's own ecosystem.
   *
   * **Experimental and unproven.** Cross-ecosystem Wi-Fi Aware pairing is specified by the Wi-Fi
   * Alliance, and this method drives the standardised exchange, but it is not known to work against
   * Apple peers and has failed in reported testing at several different layers. It is separated from
   * {@linkcode ProgrammaticPairing.initiatePairing} precisely so that no ordinary pairing or
   * connection call can silently end up here.
   *
   * Read the interop section of the README before building anything on this. Treat success on one
   * device pair as evidence about that pair only.
   *
   * @experimental
   * @throws A `'programmatic-pairing-unsupported'` error where
   *         {@linkcode Capabilities.isCrossPlatformPairingSupported} is `false`.
   * @throws A `'pairing-failed'` error, which here is the expected outcome far more often than not.
   */
  initiatePairingWithForeignPeer(
    options: InitiatePairingOptions
  ): Promise<PairedDevice>;
}
