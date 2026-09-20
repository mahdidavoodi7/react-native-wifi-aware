/**
 * Which side of a pairing exchange this device takes.
 *
 * The two devices must take **opposite** roles, and each role must match the way the service was
 * declared in the app's configuration — publishing and subscribing are declared separately.
 *
 * @see {@linkcode PairingUIOptions.role}
 */
export type PairingRole =
  /** This device presents itself to be paired with, and displays the PIN. */
  | 'publisher'
  /** This device presents a picker of nearby devices for the user to choose from. */
  | 'subscriber';
