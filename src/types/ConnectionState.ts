/**
 * The lifecycle state of a Wi-Fi Aware data path.
 *
 * @see {@linkcode Connection.state}
 * @see {@linkcode Connection.addOnStateChangedListener}
 */
export type ConnectionState =
  /** The connection is negotiating the data path and is not yet usable. */
  | 'connecting'
  /** The data path is established. {@linkcode Connection.send} will be delivered. */
  | 'ready'
  /**
   * The data path is temporarily unusable — typically because radio resources are unavailable.
   * It may recover to {@linkcode ConnectionState | 'ready'} on its own.
   */
  | 'waiting'
  /** The connection failed and will not recover. Inspect the error listener for the cause. */
  | 'failed'
  /** The connection was closed, by either peer. */
  | 'closed';
