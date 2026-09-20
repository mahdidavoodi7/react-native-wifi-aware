/**
 * How a Wi-Fi Aware data path trades throughput against latency.
 *
 * Both peers of a connection **must** select the same mode. Apple documents that mismatched
 * performance modes lead to undefined behaviour, so this value is part of the connection contract
 * rather than a local preference — agree on it out of band, or exchange it during your own
 * handshake before connecting.
 *
 * @see {@linkcode ConnectionOptions.performanceMode}
 * @see {@linkcode PublishOptions.performanceMode}
 */
export type PerformanceMode =
  /**
   * Prioritises sustained throughput, power consumption, and coexistence with other nearby Wi-Fi
   * devices. The default, and the right choice for file transfer and bulk sync.
   */
  | 'bulk'
  /**
   * Prioritises latency at the expense of throughput, power, and other concurrent Wi-Fi use.
   *
   * Apple warns this mode can drain a device's battery. Use it only for interactive workloads that
   * genuinely need it, and prefer {@linkcode PerformanceMode | 'bulk'} otherwise.
   */
  | 'realtime';
