/**
 * How two devices exchange the secret that authenticates a programmatic pairing.
 *
 * Both peers must agree on a method, and each peer supports only some of them — check
 * {@linkcode ProgrammaticPairing.supportedBootstrappingMethods} locally and
 * {@linkcode ProgrammaticPairing.getSupportedMethods} for the peer. Display/keypad methods pair naturally:
 * one device shows a value and the other accepts input.
 *
 * @see {@linkcode ProgrammaticPairing.requestBootstrapping}
 */
export type BootstrappingMethod =
  /**
   * No user verification. Convenient and **unauthenticated** — it cannot defend against an active
   * attacker in radio range. Use it only when the data path carries nothing sensitive.
   */
  | 'opportunistic'
  /** This device displays a PIN for the user to read out. */
  | 'pin-code-display'
  /** This device accepts a PIN the user read from the peer. */
  | 'pin-code-keypad'
  /** This device displays a passphrase for the user to read out. */
  | 'passphrase-display'
  /** This device accepts a passphrase the user read from the peer. */
  | 'passphrase-keypad'
  /** This device displays a QR code for the peer to scan. */
  | 'qr-display'
  /** This device scans a QR code displayed by the peer. */
  | 'qr-scan'
  /** This device acts as an NFC tag for the peer to read. */
  | 'nfc-tag'
  /** This device reads an NFC tag presented by the peer. */
  | 'nfc-reader';
