import type { BootstrappingMethod } from './BootstrappingMethod';

/**
 * One bootstrapping method a session offers to peers.
 *
 * @remarks
 * This wraps a single {@linkcode BootstrappingMethod} because the native bridge cannot currently
 * carry an array of union values from JavaScript into native code — only in the other direction.
 * The wrapper keeps the value type-checked rather than degrading the option to plain strings, and
 * can be flattened back to `BootstrappingMethod[]` once that limitation is lifted.
 *
 * @see {@linkcode SessionPairingOptions.bootstrappingMethods}
 */
export interface OfferedBootstrappingMethod {
  /** The method to advertise. */
  readonly method: BootstrappingMethod;
}
