import type { BootstrappingMethod } from './BootstrappingMethod';

/**
 * Details for starting or accepting a programmatic pairing.
 *
 * @see {@linkcode ProgrammaticPairing.initiatePairing}
 * @see {@linkcode ProgrammaticPairing.acceptPairingRequest}
 */
export interface InitiatePairingOptions {
  /** The peer to pair with, as a {@linkcode DiscoveredPeer.id}. */
  readonly peerId: string;

  /**
   * A name to store this pairing under, chosen by your app.
   *
   * It identifies the pairing in later sessions, so keep it stable for the same logical peer.
   */
  readonly alias: string;

  /**
   * The bootstrapping method both devices agreed on.
   *
   * Must be present in {@linkcode ProgrammaticPairing.supportedBootstrappingMethods} and in the peer's
   * advertised methods.
   */
  readonly method: BootstrappingMethod;

  /**
   * The secret exchanged out of band — the PIN the user read out, the passphrase they typed, or the
   * payload decoded from a QR code.
   *
   * Omit only for `'opportunistic'`, which has no secret and therefore no protection against an
   * active attacker in range.
   */
  readonly password?: string;
}
