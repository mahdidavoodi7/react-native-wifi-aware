import {
  AndroidConfig,
  type ConfigPlugin,
  createRunOncePlugin,
  withAndroidManifest,
  withEntitlementsPlist,
  withInfoPlist,
} from '@expo/config-plugins';

import { validateServiceName } from '../../src/serviceName';

/**
 * How a single Wi-Fi Aware service is declared to the operating system.
 *
 * A service must be declared for each role it is used in. Declaring only what the app actually does
 * keeps its advertised surface minimal.
 */
export interface ServiceDeclaration {
  /** The service name, in DNS-SD form such as `_chat._tcp`. */
  name: string;
  /**
   * Whether the app may advertise this service.
   *
   * @default true
   */
  publishable?: boolean;
  /**
   * Whether the app may search for this service.
   *
   * @default true
   */
  subscribable?: boolean;
}

/**
 * Options accepted by the `react-native-wifi-aware` config plugin.
 */
export interface WifiAwarePluginOptions {
  /**
   * The services this app uses.
   *
   * A bare string declares the service for both roles; use a {@link ServiceDeclaration} to narrow
   * it. At least one service is required — an app that declares none cannot use Wi-Fi Aware, and
   * on Apple platforms a missing declaration crashes the app at launch.
   */
  services: Array<string | ServiceDeclaration>;
}

const PACKAGE_NAME = 'react-native-wifi-aware';

/** Prefix for every error this plugin raises, so the source is obvious in build output. */
const ERROR_PREFIX = `[${PACKAGE_NAME}]`;

/**
 * Android permissions this library needs, with the attributes that keep the request minimal.
 */
const ANDROID_PERMISSIONS: Array<{
  name: string;
  maxSdkVersion?: string;
  usesPermissionFlags?: string;
}> = [
  { name: 'android.permission.ACCESS_WIFI_STATE' },
  { name: 'android.permission.CHANGE_WIFI_STATE' },
  { name: 'android.permission.CHANGE_NETWORK_STATE' },
  { name: 'android.permission.INTERNET' },
  {
    // neverForLocation is what lets the app use Wi-Fi Aware without requesting location.
    name: 'android.permission.NEARBY_WIFI_DEVICES',
    usesPermissionFlags: 'neverForLocation',
  },
  {
    // Only needed on the API levels that predate NEARBY_WIFI_DEVICES.
    name: 'android.permission.ACCESS_FINE_LOCATION',
    maxSdkVersion: '32',
  },
];

/**
 * Normalises the plugin's `services` option, validating every name.
 *
 * Validation happens here, at prebuild, because the alternative is a crash on a real device: the
 * operating system terminates an app whose declared service names are malformed. Failing the build
 * with the specific rule that was broken is strictly better than shipping that crash.
 *
 * @throws If `services` is missing, empty, or contains a name that breaks a naming rule.
 */
export function resolveServices(
  options: WifiAwarePluginOptions | undefined
): Required<ServiceDeclaration>[] {
  const services = options?.services;

  if (!Array.isArray(services) || services.length === 0) {
    throw new Error(
      `${ERROR_PREFIX} The "services" option is required and must list at least one service. ` +
        `Example: ["plugins": [["${PACKAGE_NAME}", { "services": ["_chat._tcp"] }]]].`
    );
  }

  const resolved = services.map((service) => {
    const declaration: ServiceDeclaration =
      typeof service === 'string' ? { name: service } : service;

    if (typeof declaration?.name !== 'string') {
      throw new Error(
        `${ERROR_PREFIX} Every entry in "services" must be a service name or an object with a ` +
          `"name" property. Received: ${JSON.stringify(service)}.`
      );
    }

    const result = validateServiceName(declaration.name);
    if (!result.isValid) {
      throw new Error(
        `${ERROR_PREFIX} Invalid service name in the "services" option.\n\n` +
          `  ${result.message}\n\n` +
          `  Rule violated: ${result.rule}\n\n` +
          `  A service name must look like "_name._tcp" or "_name._udp", where the name is at ` +
          `most 15 characters, uses only a-z, A-Z, 0-9 and "-", contains at least one letter, ` +
          `and neither starts nor ends with a hyphen.\n\n` +
          `  This is validated here because a malformed service name crashes the app at launch ` +
          `on iOS rather than surfacing as a catchable error.`
      );
    }

    const publishable = declaration.publishable ?? true;
    const subscribable = declaration.subscribable ?? true;

    if (!publishable && !subscribable) {
      throw new Error(
        `${ERROR_PREFIX} Service "${declaration.name}" is declared neither publishable nor ` +
          `subscribable. A service with neither role is unusable, and iOS terminates an app whose ` +
          `service declaration has no role.`
      );
    }

    return { name: declaration.name, publishable, subscribable };
  });

  const duplicates = resolved
    .map((service) => service.name)
    .filter((name, index, all) => all.indexOf(name) !== index);

  if (duplicates.length > 0) {
    throw new Error(
      `${ERROR_PREFIX} Duplicate service name(s) in the "services" option: ` +
        `${[...new Set(duplicates)].join(', ')}. Declare each service once.`
    );
  }

  return resolved;
}

/**
 * Writes the Wi-Fi Aware entitlement, requesting only the roles the app actually declared.
 */
const withWifiAwareEntitlement: ConfigPlugin<WifiAwarePluginOptions> = (
  config,
  options
) =>
  withEntitlementsPlist(config, (mod) => {
    const services = resolveServices(options);
    const roles: string[] = [];

    if (services.some((service) => service.publishable)) roles.push('Publish');
    if (services.some((service) => service.subscribable))
      roles.push('Subscribe');

    mod.modResults['com.apple.developer.wifi-aware'] = roles;
    return mod;
  });

/**
 * Writes the `WiFiAwareServices` dictionary the framework reads at launch.
 */
const withWifiAwareServices: ConfigPlugin<WifiAwarePluginOptions> = (
  config,
  options
) =>
  withInfoPlist(config, (mod) => {
    const services = resolveServices(options);

    const declarations = services.reduce<
      Record<string, Record<string, object>>
    >((declared, service) => {
      const roles: Record<string, object> = {};
      // Each role is an empty dictionary; its presence is what grants the role.
      if (service.publishable) roles.Publishable = {};
      if (service.subscribable) roles.Subscribable = {};
      declared[service.name] = roles;
      return declared;
    }, {});

    // The Info.plist type models values as JSON, which has no notion of the nested empty
    // dictionaries this key requires; the shape above is exactly what the framework reads.
    mod.modResults.WiFiAwareServices = declarations as unknown as Record<
      string,
      never
    >;

    return mod;
  });

/**
 * Adds the Android permissions, with the attributes that keep the request as narrow as possible.
 *
 * Written directly into the manifest rather than through the permissions helper, because the
 * helper cannot express `maxSdkVersion` or `usesPermissionFlags`.
 */
const withWifiAwarePermissions: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const existing = manifest['uses-permission'] ?? [];

    const kept = existing.filter((permission) => {
      const name = permission.$?.['android:name'];
      return !ANDROID_PERMISSIONS.some((wanted) => wanted.name === name);
    });

    const added = ANDROID_PERMISSIONS.map((permission) => {
      const attributes: Record<string, string> = {
        'android:name': permission.name,
      };
      if (permission.maxSdkVersion != null) {
        attributes['android:maxSdkVersion'] = permission.maxSdkVersion;
      }
      if (permission.usesPermissionFlags != null) {
        attributes['android:usesPermissionFlags'] =
          permission.usesPermissionFlags;
      }
      return { $: attributes };
    });

    manifest['uses-permission'] = [
      ...kept,
      ...(added as unknown as AndroidConfig.Manifest.ManifestUsesPermission[]),
    ];

    return mod;
  });

/**
 * Configures an Expo app to use Wi-Fi Aware.
 *
 * Writes the iOS entitlement and service declarations, and the Android permissions — and validates
 * every service name at prebuild so a malformed name fails the build instead of crashing the app.
 *
 * This library requires a native build. It never works in Expo Go.
 *
 * @example
 * ```json
 * {
 *   "expo": {
 *     "plugins": [["react-native-wifi-aware", { "services": ["_chat._tcp"] }]]
 *   }
 * }
 * ```
 */
const withWifiAware: ConfigPlugin<WifiAwarePluginOptions> = (
  config,
  options
) => {
  // Validate before touching any file, so a bad configuration fails fast and identically
  // regardless of which platform is being prebuilt.
  resolveServices(options);

  config = withWifiAwareEntitlement(config, options);
  config = withWifiAwareServices(config, options);
  config = withWifiAwarePermissions(config);
  return config;
};

export default createRunOncePlugin(withWifiAware, PACKAGE_NAME);
