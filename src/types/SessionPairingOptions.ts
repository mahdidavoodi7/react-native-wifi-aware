import type { OfferedBootstrappingMethod } from './OfferedBootstrappingMethod';

/**
 * How a discovery session participates in programmatic pairing.
 *
 * Only meaningful where {@linkcode Capabilities.isProgrammaticPairingSupported} is `true`. On
 * platforms that pair through system UI these fields are ignored, because the system owns the
 * pairing flow — that is not an error, and discovery still works normally.
 *
 * @see {@linkcode PublishOptions.pairing}
 * @see {@linkcode SubscribeOptions.pairing}
 */
export interface SessionPairingOptions {
  /**
   * Allow peers to start a new pairing against this session.
   *
   * @default false
   */
  readonly enableSetup?: boolean;

  /**
   * Allow peers that are already paired to re-verify that pairing.
   *
   * @default false
   */
  readonly enableVerification?: boolean;

  /**
   * Let the system cache the pairing so a later session can reuse it without a fresh bootstrap.
   *
   * @default false
   */
  readonly enableCache?: boolean;

  /**
   * Bootstrapping methods to advertise to peers, in the order you prefer them.
   *
   * Written as `[{ method: 'pin-code-display' }]` — see {@linkcode OfferedBootstrappingMethod}.
   *
   * Advertise only methods your UI can actually drive: offering `'qr-scan'` without a scanner leaves
   * the peer waiting. Methods this device does not support are dropped — check the result against
   * {@linkcode ProgrammaticPairing.supportedBootstrappingMethods}.
   *
   * @default [] — no methods advertised, so peers cannot bootstrap against this session
   */
  readonly bootstrappingMethods?: OfferedBootstrappingMethod[];
}
