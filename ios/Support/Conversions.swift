import Foundation
import NitroModules
import Network

#if canImport(WiFiAware)
  import WiFiAware
#endif

@available(iOS 16.0, *)
extension Duration {
  /// This duration in milliseconds.
  var milliseconds: Double {
    let components = self.components
    return Double(components.seconds) * 1_000
      + Double(components.attoseconds) / 1_000_000_000_000_000
  }
}

#if canImport(WiFiAware)

  @available(iOS 26.0, *)
  extension WAPairedDevice {
    /// The JS-facing identifier for this pairing.
    ///
    /// The framework identifies a pairing with a `UInt64`, which does not survive a round trip
    /// through a JS number, so it is carried as a decimal string.
    var jsIdentifier: String { String(id) }

    /// Converts to the struct handed to JS.
    ///
    /// The generated struct is fully qualified because the framework nests its own `PairingInfo`
    /// inside `WAPairedDevice`, which shadows ours inside this extension.
    func toPairedDevice() -> PairedDevice {
      return PairedDevice(
        id: jsIdentifier,
        displayName: name,
        pairingInfo: pairingInfo.map {
          margelo.nitro.wifiaware.PairingInfo(
            pairingName: $0.pairingName,
            vendorName: $0.vendorName,
            modelName: $0.modelName
          )
        }
      )
    }
  }

  @available(iOS 26.0, *)
  extension WAAccessCategory {
    var accessCategory: AccessCategory {
      switch self {
      case .bestEffort: return .bestEffort
      case .background: return .background
      case .interactiveVideo: return .interactiveVideo
      case .interactiveVoice: return .interactiveVoice
      @unknown default: return .bestEffort
      }
    }
  }

  @available(iOS 26.0, *)
  extension AccessCategory {
    /// The Wi-Fi quality-of-service class this category maps onto.
    ///
    /// `NWParameters.ServiceClass` has two further cases with no Wi-Fi Aware equivalent, so the
    /// mapping is deliberately one-way.
    var serviceClass: NWParameters.ServiceClass {
      switch self {
      case .bestEffort: return .bestEffort
      case .background: return .background
      case .interactiveVideo: return .interactiveVideo
      case .interactiveVoice: return .interactiveVoice
      }
    }
  }

  @available(iOS 26.0, *)
  extension PerformanceMode {
    var waPerformanceMode: WAPerformanceMode {
      switch self {
      case .bulk: return .bulk
      case .realtime: return .realtime
      }
    }
  }

  @available(iOS 26.0, *)
  extension WAPath {
    /// Converts a platform link-quality snapshot into the JS struct.
    ///
    /// Every metric is independently optional at the source, so nothing is defaulted — a metric the
    /// system could not calculate stays absent rather than becoming zero.
    func toPerformanceReport() -> PerformanceReport {
      let report = performance
      let latency = report.transmitLatency.map { category, metrics in
        TransmitLatencyMetric(
          accessCategory: category.accessCategory,
          averageLatencyMs: metrics.average?.milliseconds
        )
      }

      return PerformanceReport(
        timestampMs: report.timestamp.timeIntervalSince1970 * 1_000,
        signalStrength: report.signalStrength,
        throughputCeilingMbps: report.throughputCeiling,
        throughputCapacityMbps: report.throughputCapacity,
        throughputCapacityRatio: report.throughputCapacityRatio,
        transmitLatency: latency,
        activeDurationMs: durationActive.milliseconds
      )
    }
  }

#endif
