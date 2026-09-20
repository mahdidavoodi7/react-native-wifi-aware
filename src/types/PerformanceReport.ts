import type { AccessCategory } from './AccessCategory';

/**
 * A point-in-time snapshot of link quality for an established data path.
 *
 * **Every metric is optional on every platform.** The system reports a field only when it can
 * actually calculate it, and platforms differ in how much they expose. A missing field means "not
 * measured", which is different from zero — render it as unknown rather than substituting a value.
 *
 * @see {@linkcode Connection.getPerformance}
 */
export interface PerformanceReport {
  /** When the underlying measurement was taken, in milliseconds since the Unix epoch. */
  readonly timestampMs: number;

  /**
   * Signal strength of the remote device, normalised to `0.0`–`1.0`.
   *
   * This is a relative indicator, not a calibrated dBm reading.
   */
  readonly signalStrength: number | undefined;

  /**
   * Highest throughput this connection could reach under ideal conditions, in **megabits per
   * second**, given the hardware of both peers.
   *
   * A ceiling, not a measurement of current transfer rate.
   */
  readonly throughputCeilingMbps: number | undefined;

  /**
   * Estimated average throughput currently achievable in **megabits per second**, given present
   * radio conditions and competing Wi-Fi use.
   */
  readonly throughputCapacityMbps: number | undefined;

  /**
   * {@linkcode PerformanceReport.throughputCapacityMbps} as a fraction of
   * {@linkcode PerformanceReport.throughputCeilingMbps}, from `0.0` to `1.0`.
   *
   * Because it is normalised against the hardware's own ceiling, this is the most useful single
   * number for comparing data-path health across differing devices.
   */
  readonly throughputCapacityRatio: number | undefined;

  /**
   * Average transmit latency per quality-of-service category.
   *
   * Contains an entry only for categories the system reported. An empty array means no latency
   * information was available.
   */
  readonly transmitLatency: TransmitLatencyMetric[];

  /** Cumulative time this data path has been connected, in milliseconds. */
  readonly activeDurationMs: number | undefined;
}

/**
 * Average transmit latency for one quality-of-service category.
 *
 * @see {@linkcode PerformanceReport.transmitLatency}
 */
export interface TransmitLatencyMetric {
  /** The category these figures describe. */
  readonly accessCategory: AccessCategory;
  /** Average transmit latency in milliseconds, when the system could measure it. */
  readonly averageLatencyMs: number | undefined;
}
