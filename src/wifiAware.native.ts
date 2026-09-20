import { NitroModules } from 'react-native-nitro-modules';
import type { WifiAware } from './specs/WifiAware.nitro';

/**
 * The Wi-Fi Aware API for this device.
 *
 * A single shared instance; there is no separate setup step. Start with
 * {@linkcode WifiAware.getCapabilities}, which tells you whether anything else will work.
 *
 * @see {@linkcode WifiAware}
 */
export const wifiAware =
  NitroModules.createHybridObject<WifiAware>('WifiAware');
