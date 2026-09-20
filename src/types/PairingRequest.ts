/**
 * An inbound request from a peer that wants to pair with this device.
 *
 * Respond with {@linkcode ProgrammaticPairing.acceptPairingRequest} or
 * {@linkcode ProgrammaticPairing.rejectPairingRequest}. Requests expire, so prompt the user
 * promptly rather than holding one open.
 *
 * @see {@linkcode ProgrammaticPairing.addOnPairingRequestListener}
 */
export interface PairingRequest {
  /**
   * Identifies this request when responding.
   *
   * Valid only for this request; it is not a device identifier.
   */
  readonly requestId: number;

  /**
   * The requesting peer, as a {@linkcode DiscoveredPeer.id} from the session that found it.
   */
  readonly peerId: string;
}
