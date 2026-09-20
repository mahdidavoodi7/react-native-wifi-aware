/**
 * How a discovery session decides which paired devices it will talk to.
 *
 * @see {@linkcode DeviceSelector.kind}
 */
export type DeviceSelectorKind =
  /** Accept any device this app has previously paired with. */
  | 'all-paired'
  /** Accept only the devices listed in {@linkcode DeviceSelector.deviceIds}. */
  | 'selected';

/**
 * Which already-paired devices a discovery session is willing to talk to.
 *
 * Keep this as narrow as the feature allows. Broad selectors cost power and, because the device
 * advertises interest in more peers, reduce privacy. Switch to `'selected'` as soon as you know
 * which peer the user actually wants.
 *
 * @example
 * ```ts
 * { kind: 'all-paired' }
 * { kind: 'selected', deviceIds: [device.id] }
 * ```
 *
 * @see {@linkcode PublishOptions.devices}
 * @see {@linkcode SubscribeOptions.devices}
 */
export interface DeviceSelector {
  /** Whether to accept every paired device or only an explicit list. */
  readonly kind: DeviceSelectorKind;

  /**
   * Identifiers of the devices to accept, from {@linkcode PairedDevice.id}.
   *
   * Required when {@linkcode DeviceSelector.kind} is `'selected'`, and ignored otherwise.
   *
   * @throws An `'invalid-argument'` error when `kind` is `'selected'` and this is missing or empty.
   */
  readonly deviceIds?: string[];
}
