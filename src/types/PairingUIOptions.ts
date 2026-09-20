import type { PairingAccess } from './PairingAccess';
import type { PairingRole } from './PairingRole';

/**
 * Configuration for presenting the system pairing UI.
 *
 * @see {@linkcode WifiAware.presentPairingUI}
 */
export interface PairingUIOptions {
  /**
   * Which side of the pairing this device is on.
   *
   * The two devices must take opposite roles, matching the role each one declared for the
   * service. See {@linkcode PairingRole}.
   */
  readonly role: PairingRole;

  /**
   * The service the pairing is for, in DNS-SD form such as `_chat._tcp`.
   *
   * Must be declared in the app's configuration for the {@linkcode PairingUIOptions.role} being
   * used — publishing and subscribing are declared separately.
   */
  readonly serviceName: string;

  /**
   * How long the resulting pairing should remain available to this app.
   *
   * @default 'default'
   */
  readonly access?: PairingAccess;
}
