/**
 * A peer found by a {@linkcode SubscribeSession} that is advertising a matching service.
 *
 * A discovered peer is not necessarily connectable: on Apple platforms a data path additionally
 * requires that the peer is already paired, which {@linkcode DiscoveredPeer.pairedDeviceId}
 * reports.
 *
 * @see {@linkcode SubscribeSession.addOnPeerFoundListener}
 * @see {@linkcode SubscribeSession.connect}
 */
export interface DiscoveredPeer {
  /**
   * Identifier for this peer *within the session that discovered it*.
   *
   * It is not stable across sessions or app launches, and it is not the same value space as
   * {@linkcode PairedDevice.id}. Pass it to {@linkcode SubscribeSession.connect}; do not persist it.
   */
  readonly id: string;

  /** A human-readable name for the peer, when one is advertised. */
  readonly displayName: string | undefined;

  /**
   * The {@linkcode PairedDevice.id} of this peer when it is already paired with this app, otherwise
   * `undefined`.
   *
   * A peer with no value here must be paired before {@linkcode SubscribeSession.connect} can
   * succeed.
   */
  readonly pairedDeviceId: string | undefined;

  /**
   * Small opaque payload the peer attached to its service advertisement, when it published one.
   *
   * Advertisement payloads are tiny and travel unencrypted in discovery frames. Use them to
   * disambiguate peers, never for application data or anything sensitive.
   *
   * @see {@linkcode PublishOptions.serviceSpecificInfo}
   */
  readonly serviceSpecificInfo: ArrayBuffer | undefined;
}
