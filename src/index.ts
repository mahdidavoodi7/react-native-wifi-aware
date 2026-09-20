export { wifiAware } from './wifiAware';

export type { WifiAware } from './specs/WifiAware.nitro';
export type { PublishSession } from './specs/PublishSession.nitro';
export type { SubscribeSession } from './specs/SubscribeSession.nitro';
export type { Connection } from './specs/Connection.nitro';
export type { ProgrammaticPairing } from './specs/ProgrammaticPairing.nitro';

export type { AccessCategory } from './types/AccessCategory';
export type { Availability } from './types/Availability';
export type { BootstrappingMethod } from './types/BootstrappingMethod';
export type { Capabilities } from './types/Capabilities';
export type { ConnectionOptions } from './types/ConnectionOptions';
export type { ConnectionState } from './types/ConnectionState';
export type {
  DeviceSelector,
  DeviceSelectorKind,
} from './types/DeviceSelector';
export type { DiscoveredPeer } from './types/DiscoveredPeer';
export type { InitiatePairingOptions } from './types/InitiatePairingOptions';
export type { ListenerSubscription } from './types/ListenerSubscription';
export type { OfferedBootstrappingMethod } from './types/OfferedBootstrappingMethod';
export type { PairedDevice, PairingInfo } from './types/PairedDevice';
export type { PairingAccess } from './types/PairingAccess';
export type { PairingRequest } from './types/PairingRequest';
export type { PairingRole } from './types/PairingRole';
export type { PairingUIOptions } from './types/PairingUIOptions';
export type { PerformanceMode } from './types/PerformanceMode';
export type {
  PerformanceReport,
  TransmitLatencyMetric,
} from './types/PerformanceReport';
export type { PublishOptions } from './types/PublishOptions';
export type { SessionPairingOptions } from './types/SessionPairingOptions';
export type { SubscribeOptions } from './types/SubscribeOptions';
export type { WifiAwareErrorCode } from './types/WifiAwareErrorCode';
export type { WifiAwareErrorInfo } from './types/WifiAwareErrorInfo';

export { getWifiAwareErrorCode } from './getWifiAwareErrorCode';
export { assertValidServiceName, validateServiceName } from './serviceName';
export type {
  InvalidServiceName,
  ServiceNameRule,
  ServiceNameValidation,
  ValidServiceName,
} from './serviceName';
