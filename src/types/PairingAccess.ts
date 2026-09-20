/**
 * How long a pairing created through the system pairing UI remains available to this app.
 *
 * Only meaningful where {@linkcode Capabilities.isPairingUISupported} is `true`.
 *
 * @see {@linkcode PairingUIOptions.access}
 */
export type PairingAccess =
  /** The system's default retention policy for a newly paired device. */
  | 'default'
  /** Requests that the pairing persist for this app until the user removes it in Settings. */
  | 'permanent';
