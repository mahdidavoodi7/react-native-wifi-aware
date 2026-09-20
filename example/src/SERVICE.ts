/**
 * The service this demo advertises and looks for.
 *
 * Must match the name declared for the config plugin in `app.json`; the plugin validates it at
 * prebuild so a malformed name fails the build instead of crashing the app at launch.
 */
export const SERVICE_NAME = '_wa-demo._tcp';

/**
 * The data-path secret both devices use.
 *
 * Hardcoded here because it is a demo. A real app must deliver this through a channel it already
 * trusts — derived from the pairing, entered by the user, or fetched from a backend — and never
 * over the unencrypted discovery channel.
 */
export const DEMO_PASSPHRASE = 'wifi-aware-example-passphrase';

/**
 * Performance mode for both sides.
 *
 * The publisher and the subscriber must agree: the platforms do not negotiate this and do not
 * report a mismatch.
 */
export const PERFORMANCE_MODE = 'bulk' as const;
