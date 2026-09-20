/**
 * The Wi-Fi quality-of-service category a data flow is placed in.
 *
 * Wi-Fi is a shared medium: every nearby device, network and connection competes for the same
 * capacity. Choosing the *lowest* category that still meets your needs improves throughput for your
 * own flows and for everything else in range.
 *
 * @see {@linkcode ConnectionOptions.accessCategory}
 * @see {@linkcode TransmitLatencyMetric.accessCategory}
 */
export type AccessCategory =
  /** High throughput for data transfers of any size. The default. */
  | 'best-effort'
  /** High throughput for delay-tolerant, non-interactive transfers. */
  | 'background'
  /** Low latency for moderate-throughput flows. Does not support high throughput. */
  | 'interactive-video'
  /** Very low latency for low-throughput flows. Does not support high throughput. */
  | 'interactive-voice';
