/**
 * Which service-name rule a name failed.
 *
 * @see {@linkcode validateServiceName}
 */
export type ServiceNameRule =
  /** The name is not in `_label._tcp` or `_label._udp` form. */
  | 'format'
  /** The label between the underscores exceeds the maximum length. */
  | 'label-length'
  /** The label contains a character outside `a`–`z`, `A`–`Z`, `0`–`9` and `-`. */
  | 'label-characters'
  /** The label contains no letter. */
  | 'label-letter-required'
  /** The label starts or ends with a hyphen. */
  | 'label-hyphen-position';

/**
 * The outcome of checking a service name.
 *
 * @see {@linkcode validateServiceName}
 */
export type ServiceNameValidation = ValidServiceName | InvalidServiceName;

/**
 * A service name that satisfies every rule.
 *
 * @see {@linkcode ServiceNameValidation}
 */
export interface ValidServiceName {
  readonly isValid: true;
}

/**
 * A service name that broke a specific rule.
 *
 * @see {@linkcode ServiceNameValidation}
 */
export interface InvalidServiceName {
  readonly isValid: false;
  /** Which rule was broken, for programmatic handling. */
  readonly rule: ServiceNameRule;
  /** A message naming the rule and the offending value, suitable for showing a developer. */
  readonly message: string;
}

/** Maximum length of the label between the underscores in a service name. */
const MAX_LABEL_LENGTH = 15;

/**
 * Checks a Wi-Fi Aware service name against the platform's naming rules.
 *
 * Getting this wrong is not a recoverable runtime error: a name that does not satisfy these rules,
 * declared in an app's configuration, **crashes the app on launch**. This function exists so that
 * the failure can be caught at build time and at call time instead.
 *
 * A valid name is a DNS-SD service type — an underscore-prefixed label, then `._tcp` or `._udp`:
 *
 * - the label is at most 15 characters;
 * - it uses only `a`–`z`, `A`–`Z`, `0`–`9` and `-`;
 * - it contains at least one letter;
 * - it neither starts nor ends with a hyphen.
 *
 * @example
 * ```ts
 * validateServiceName('_chat._tcp')   // { isValid: true }
 * validateServiceName('_chat')        // { isValid: false, rule: 'format', … }
 * validateServiceName('_-chat._tcp')  // { isValid: false, rule: 'label-hyphen-position', … }
 * ```
 *
 * @see {@linkcode assertValidServiceName} to throw instead of returning a result.
 */
export function validateServiceName(
  serviceName: string
): ServiceNameValidation {
  const match = /^_([^.]*)\.(_tcp|_udp)$/.exec(serviceName);
  if (match == null) {
    return {
      isValid: false,
      rule: 'format',
      message: `Service name "${serviceName}" must look like "_name._tcp" or "_name._udp".`,
    };
  }

  const label = match[1] ?? '';

  if (label.length === 0 || label.length > MAX_LABEL_LENGTH) {
    return {
      isValid: false,
      rule: 'label-length',
      message:
        `Service name "${serviceName}" has a ${label.length}-character name component ` +
        `("${label}"), but it must be between 1 and ${MAX_LABEL_LENGTH} characters.`,
    };
  }

  if (!/^[A-Za-z0-9-]+$/.test(label)) {
    return {
      isValid: false,
      rule: 'label-characters',
      message:
        `Service name "${serviceName}" has a name component ("${label}") containing characters ` +
        `outside a-z, A-Z, 0-9 and "-".`,
    };
  }

  if (!/[A-Za-z]/.test(label)) {
    return {
      isValid: false,
      rule: 'label-letter-required',
      message:
        `Service name "${serviceName}" has a name component ("${label}") with no letter in it; ` +
        `at least one a-z or A-Z character is required.`,
    };
  }

  if (label.startsWith('-') || label.endsWith('-')) {
    return {
      isValid: false,
      rule: 'label-hyphen-position',
      message:
        `Service name "${serviceName}" has a name component ("${label}") that starts or ends ` +
        `with a hyphen, which is not allowed.`,
    };
  }

  return { isValid: true };
}

/**
 * Checks a service name and throws if it is invalid.
 *
 * The thrown message names the specific rule that was broken.
 *
 * @throws An `Error` when {@linkcode validateServiceName} rejects the name.
 * @see {@linkcode validateServiceName} to inspect the failure instead of throwing.
 */
export function assertValidServiceName(serviceName: string): void {
  const result = validateServiceName(serviceName);
  if (!result.isValid) {
    throw new Error(result.message);
  }
}
