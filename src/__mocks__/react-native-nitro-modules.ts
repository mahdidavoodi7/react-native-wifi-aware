/**
 * Stand-in for the Nitro runtime in Node-based tests.
 *
 * The package has no native binary under Jest, so anything that would reach across the bridge
 * throws with a message pointing at the fix rather than failing somewhere deeper.
 */
export const NitroModules = {
  createHybridObject(): never {
    throw new Error(
      'NitroModules.createHybridObject was called in a test. Mock the `wifiAware` export instead ' +
        'of exercising the native bridge.'
    );
  },
};
