import type { WifiAware } from './specs/WifiAware.nitro';

/**
 * Message shown when the library is used somewhere it has no native implementation.
 */
const UNAVAILABLE_MESSAGE =
  '[wifi-aware:unsupported] react-native-wifi-aware has no implementation on this platform. ' +
  'It requires a native build on iOS or Android, and it never works in Expo Go or in the iOS ' +
  'Simulator. In tests, mock the `wifiAware` export.';

/**
 * The Wi-Fi Aware API for this device.
 *
 * This is the non-native build of the module, used on platforms with no Wi-Fi Aware implementation
 * and in Node-based test runs. Every member throws on access, so an accidental import in the wrong
 * environment fails loudly and immediately rather than silently doing nothing.
 *
 * @see {@linkcode WifiAware}
 */
export const wifiAware: WifiAware = new Proxy({} as WifiAware, {
  get() {
    throw new Error(UNAVAILABLE_MESSAGE);
  },
});
