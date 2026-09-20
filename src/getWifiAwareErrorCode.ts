import type { WifiAwareErrorCode } from './types/WifiAwareErrorCode';

/**
 * Matches the canonical prefix native errors are tagged with, e.g. `[wifi-aware:connection-failed]`.
 */
const ERROR_CODE_PATTERN = /^\[wifi-aware:([a-z-]+)\]/;

/**
 * Extracts the {@linkcode WifiAwareErrorCode} from an error thrown or rejected by this library.
 *
 * Errors raised by a call carry their classification in the message, tagged as
 * `[wifi-aware:<code>]`, because the native bridge can only carry a string across. This function is
 * the supported way to read that tag — do not match on message text yourself, as the wording after
 * the tag is not stable.
 *
 * Returns `undefined` for anything that is not one of this library's errors, so it is safe to call
 * on any caught value.
 *
 * Failures delivered through listeners are not thrown and do not need this: they already arrive as
 * a fully structured {@linkcode WifiAwareErrorInfo}.
 *
 * @example
 * ```ts
 * try {
 *   await session.connect(peer.id)
 * } catch (error) {
 *   switch (getWifiAwareErrorCode(error)) {
 *     case 'no-paired-devices':
 *       return promptToPair()
 *     case 'device-no-longer-available':
 *       return showPeerLeft()
 *     default:
 *       throw error
 *   }
 * }
 * ```
 *
 * @see {@linkcode WifiAwareErrorInfo} for failures that arrive through listeners.
 */
export function getWifiAwareErrorCode(
  error: unknown
): WifiAwareErrorCode | undefined {
  const message = error instanceof Error ? error.message : undefined;
  if (message == null) {
    return undefined;
  }

  const match = ERROR_CODE_PATTERN.exec(message);
  if (match == null) {
    return undefined;
  }

  return match[1] as WifiAwareErrorCode;
}
