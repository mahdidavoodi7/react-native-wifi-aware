/**
 * A device this app has completed one-time pairing with.
 *
 * Pairing is mandatory before any data path can be established, and it is performed by the user
 * through system UI — never programmatically by this library on iOS. Devices appear here once
 * pairing succeeds and disappear when the user removes them.
 *
 * @see {@linkcode WifiAware.getPairedDevices}
 * @see {@linkcode WifiAware.addOnPairedDevicesChangedListener}
 * @see {@linkcode WifiAware.presentPairingUI}
 */
export interface PairedDevice {
  /**
   * Stable identifier for this pairing, used to address the device in
   * {@linkcode SelectedDevices.deviceIds} and {@linkcode WifiAware.removePairedDevice}.
   *
   * The identifier is scoped to this app and this device — it is not a hardware address and cannot
   * be used to correlate the peer across apps.
   */
  readonly id: string;

  /** A human-readable name for the device, when the system supplies one. */
  readonly displayName: string | undefined;

  /**
   * Unauthenticated details the peer advertised *before* pairing completed.
   *
   * Only ever populated during initial pairing, and only to help a person recognise the device they
   * are pairing with. See {@linkcode PairingInfo} for why it must not be trusted.
   */
  readonly pairingInfo: PairingInfo | undefined;
}

/**
 * Unauthenticated identifying details a peer advertises before it has been paired.
 *
 * These values are transmitted over an insecure, unauthenticated and unencrypted channel, so they
 * may have been intercepted or altered. **Use them only to help a person pick the right device in a
 * pairing UI.** If your app needs trustworthy information about the peer, exchange it over the
 * encrypted data path after pairing completes instead.
 *
 * Once initial pairing is complete the system stops broadcasting these values, so that a device
 * cannot be tracked by them.
 *
 * @see {@linkcode PairedDevice.pairingInfo}
 */
export interface PairingInfo {
  /** The name the peer offers for display during pairing. */
  readonly pairingName: string;
  /** The vendor the peer claims. Unverified. */
  readonly vendorName: string;
  /** The model the peer claims. Unverified. */
  readonly modelName: string;
}
