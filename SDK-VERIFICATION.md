# SDK verification report

Everything below was read out of the **installed SDKs on this machine**, not from docs or memory.

| Source | Version |
|---|---|
| Xcode | 26.5 (17F42) |
| iOS SDK | 26.5 (`iphoneos26.5`) |
| Swift | 6.3.2 |
| Android SDK platform | android-36 (highest installed) |

Method: Apple ships full `.swiftinterface` files for both frameworks, which are the authoritative
public API surface. Android was read with `javap` against `android-36/android.jar`.

```
$IOS_SDK/System/Library/Frameworks/WiFiAware.framework/Modules/WiFiAware.swiftmodule/arm64e-apple-ios.swiftinterface
$IOS_SDK/System/Library/Frameworks/DeviceDiscoveryUI.framework/Modules/DeviceDiscoveryUI.swiftmodule/arm64e-apple-ios.swiftinterface
$IOS_SDK/System/Library/Frameworks/Network.framework/Modules/Network.swiftmodule/arm64e-apple-ios.swiftinterface
```

---

## The four questions the brief asked me to answer

### 1. Does `DDDevicePickerViewController` accept a `.wifiAware(...)` browser provider?

**No — and it does not need to.** The picker takes a *classic* `NWBrowser.Descriptor`, not a `BrowserProvider`:

```swift
@available(tvOS 16.0, iOS 26.0, *)
extension DDDevicePickerViewController {
  convenience init?(browseDescriptor: NWBrowser.Descriptor, parameters: NWParameters? = nil)

  @available(iOS 26.0, *)   // macOS/tvOS/watchOS/visionOS unavailable
  convenience init?(browseDescriptor: NWBrowser.Descriptor,
                    parameters: NWParameters? = nil,
                    access: DDDevicePairingAccess = .default)

  static func isSupported(_ browseDescriptor: NWBrowser.Descriptor, using: NWParameters? = nil) -> Bool
  var endpoint: NWEndpoint { get async throws }
}
```

The bridge is that **`WASubscriberBrowser` publicly exposes the `BrowserProvider` machinery on the
concrete type**, so it can manufacture exactly the two values the picker wants:

```swift
public struct WASubscriberBrowser: BrowserProvider, Sendable {
  public func makeDescriptor() -> NWBrowser.Descriptor              // ← feeds browseDescriptor:
  public func configureParameters(_ parameters: NWParameters?) -> NWParameters  // ← feeds parameters:
  public func makeEndpoint(from browseResult: NWBrowser.Result) throws -> WAEndpoint?
}
```

So the verified subscriber path is public API, no SwiftUI, **no `UIHostingController` needed**:

```swift
let browser: WASubscriberBrowser = .wifiAware(.connecting(to: .allPairedDevices, from: subSvc))
let picker = DDDevicePickerViewController(
  browseDescriptor: browser.makeDescriptor(),
  parameters:       browser.configureParameters(nil),
  access:           .default
)
let endpoint = try await picker!.endpoint   // NWEndpoint → .wifiAware → WAEndpoint (iOS 26.4+)
```

Note `init?` is **failable** and `isSupported(_:using:)` exists — both must be checked.

> The brief's contingency ("host `DevicePicker` in a `UIHostingController` for the subscriber side
> only") is **not needed**. The UIKit path is fully viable.

### 2. Exact `DDDevicePairingAccess` cases

It is a **struct with two static properties**, not an enum — so it cannot be exhaustively switched
and may gain members without a source break:

```swift
public struct DDDevicePairingAccess {
  public static var `default`: DDDevicePairingAccess { get }
  public static var permanent: DDDevicePairingAccess { get }
}
```

Exactly two today: `.default` and `.permanent`. Surfaced as `PairingAccess = 'default' | 'permanent'`.

### 3. Does any classic `NWListener`/`NWBrowser` Wi-Fi Aware descriptor exist?

**No.** Confirmed exhaustively — `NWBrowser.Descriptor` has three cases and none is Wi-Fi Aware:

```swift
public enum Descriptor: Sendable {
  case bonjour(type: String, domain: String?)
  case bonjourWithTXTRecord(type: String, domain: String?)
  @available(macOS 13.0, iOS 16.0, watchOS 9.0, tvOS 16.0, *)
  case applicationService(name: String)
}
```

`grep -r wifiAware` across the whole Network framework returns only `NWError.wifiAware(Int32)` — no
descriptor, no listener factory. The brief's finding is correct: **the iOS 26 Swift-native
`NetworkListener` / `NetworkBrowser` / `NetworkConnection` types are the only path.**

`WASubscriberBrowser.makeDescriptor()` therefore necessarily returns one of those three cases
(`.applicationService`, given `WAPublisherListener.isApplicationService: Bool` exists). Wi-Fi Aware
projects itself into the application-service descriptor form internally — which is exactly why the
documented `DDDevicePickerViewController` example uses `.applicationService`.

### 4. Does the framework function with Wi-Fi toggled off?

**Not statically answerable** — this is runtime radio behaviour and nothing in the SDK metadata
states it. The only honest answer comes from hardware. The runtime signals are
`WAError.wifiAwareUnsupported` and `.noRadioResources`, both of which this library maps to distinct
JS error codes so the app can tell them apart. **Documented as unverified; no claim in the README.**

---

## Corrections to the brief

These are places where the shipped SDK disagrees with the brief. Each one changes the design.

### iOS

1. **`macCatalyst` is `unavailable`, not supported.** Every single WiFiAware declaration carries
   `@available(macCatalyst, unavailable)`. The brief said "macCatalyst appears in symbol metadata" —
   it does, but as an *exclusion*. iOS/iPadOS only.

2. **Every `WAPerformanceReport` metric is optional**, including on iOS:
   ```swift
   public let throughputCeiling: Double?
   public let throughputCapacity: Double?
   public var throughputCapacityRatio: Double? { get }
   public let signalStrength: Double?
   public struct TransmitLatencyMetrics { public let average: Duration? }
   ```
   The brief assumed "iOS gives all of them; Android gives less". Wrong — iOS can return `nil` for
   all of them. `PerformanceReport` is all-optional on both platforms, and the library never
   fabricates a zero.

3. **`throughputCeiling` is in Mbps.** From the shipped `.swiftdoc`, verbatim: *"The highest
   throughput the connection is capable of under ideal conditions... The result is in `Mbps` and can
   be `nil` if the system can't calculate it."* Named `throughputCeilingMbps` in JS.
   `throughputCapacityRatio` is documented as `0.0`–`1.0`.

4. **`.userSpecifiedDevices` is pairing-UI-only and throws otherwise.** From the `.swiftdoc`,
   verbatim: *"Only applicable to use with the `DevicePairingView()` API. **Will throw an error if
   used with a `NetworkListener`.**"* This is a live footgun the brief did not mention, so
   `'user-specified'` is deliberately **absent** from the public `DeviceSelector` union used by
   `publish()`/`subscribe()`; the library only uses it internally for `presentPairingUI()`.

5. **`WAPublisherListener.Action.connecting` takes a third datapath argument** the brief omitted, and
   both provider factories take an optional active-duration:
   ```swift
   static func connecting(to: WAPublishableService, from: Devices,
                          datapath: DatapathParameters? = nil) -> Action   // .defaults / .realtime
   static func wifiAware(_ action: Action, active requestedDuration: Duration? = nil) -> Self
   ```
   Surfaced as `ConnectionOptions.performanceMode` and `SessionOptions.activeDurationMs`.

6. **`WAEndpoint.publishedService` / `.subscribedService` are optional** (`WAPublishableService?`),
   not the non-optional fields the brief showed. Only `.device` is guaranteed.

7. **`WASharedSecret` shape differs.** The brief listed "`.tlsPSK`, `.kdfHash256`" as if peers.
   They are different nested types, and there is a third protocol name and a context parameter:
   ```swift
   ProtocolName:      .tlsPSK, .ipsecPSK          // + init?(String) / init?(Data)
   DerivationMethod:  .kdfHash256
   Context:           .bundleID  (default)
   ```

8. **`NWEndpoint.wifiAware` is iOS 26.4+**, same gate as `WAConnection`. The brief only gated
   `WAConnection`/`WASharedSecret`. This matters: converting the picker's `NWEndpoint` into a
   `WAEndpoint` needs the 26.4 gate, so on 26.0–26.3 the picker result is opaque and the library
   must resolve the paired device via `WAPairedDevice.allDevices` instead.

9. **`WAPublisherListener.Action.addingConnections(from:)`** exists (iOS 26.4+) and is absent from
   the brief — lets a publisher add peers to a live listener without restarting it.

10. **Error details structs are opaque but `Codable`.** Every `WAError` payload
    (`ConnectionFailedDetails` etc.) exposes *no* public stored properties — only `init(from:)` /
    `encode(to:)`. The only way to extract details is to JSON-encode the error. That is exactly how
    this library populates `WifiAwareErrorInfo.nativeDetails`.

11. All 15 `WAError` cases in the brief are confirmed present and correctly spelled.

### Android

12. **`acceptPairingRequest` / `rejectPairingRequest` take a leading `int requestId`** that the brief
    omitted. The id arrives on the callback, and must be threaded through:
    ```java
    void onPairingSetupRequestReceived(PeerHandle peer, int requestId)
    void acceptPairingRequest(int requestId, PeerHandle peer, String alias, int cipherSuite, String password)
    void rejectPairingRequest(int requestId, PeerHandle peer)
    void initiatePairingRequest(PeerHandle peer, String alias, int cipherSuite, String password)
    ```

13. **Bootstrapping constants are prefixed `PAIRING_BOOTSTRAPPING_*` and there are nine, not six.**
    They are a bitmask (`getBootstrappingMethods()` returns the OR):
    `OPPORTUNISTIC=1`, `PIN_CODE_DISPLAY=2`, `PASSPHRASE_DISPLAY=4`, `QR_DISPLAY=8`, `NFC_TAG=16`,
    `PIN_CODE_KEYPAD=32`, `PASSPHRASE_KEYPAD=64`, `QR_SCAN=128`, `NFC_READER=256`.
    The brief missed the two `PASSPHRASE_*` methods.

14. **`onPairingVerificationSucceed` — Google's typo is real and present in API 36.** Matched verbatim.
    `onPairingVerificationFailed` (correctly spelled) also exists and the brief omitted it.

15. **`setFrameworkOffloadedPairingEnabled` is confirmed absent from API 36**, consistent with the
    brief placing it at API 37. It cannot be compiled against today with the installed SDK — it will
    be reflection-gated so the library still builds on `compileSdk 36`.

16. **`ServiceDiscoveryInfo.getPairedAlias()`** exists and the brief omitted it — it reports whether
    a discovered peer is *already paired*, which is what lets `DiscoveredPeer.pairedDeviceId` be
    populated without a round trip.

17. **`WifiAwareManager` has `isOpportunisticModeEnabled` / `setOpportunisticModeEnabled`** (not in
    the brief). Relevant to interop, since opportunistic bootstrapping is one of the nine methods.

18. `Characteristics` exposes `getSupportedPairingCipherSuites()` plus the
    `WIFI_AWARE_CIPHER_SUITE_NCS_PK_PASN_128/256` pairing suites — the correct thing to check before
    calling `initiatePairingRequest`, rather than `getSupportedCipherSuites()`.

---

## Nitro constraint that shapes the error API

`react-native-nitro-modules@0.37.1` (verified as the current latest) throws through a single
message-only channel:

```swift
public enum RuntimeError: Error, CustomStringConvertible {
  case error(withMessage: String)
}
```

There is **no way to attach a structured payload to a thrown/rejected error from native.** The brief
asks for "a discriminated union with a distinct code per `WAError` case and per Android failure, plus
the raw native error every time". That is achievable for *event* paths (structs can carry anything)
but not for *throws*. The design therefore:

- gives every listener-delivered failure a full `WifiAwareErrorInfo` struct, and
- gives every thrown/rejected error a **documented canonical message format** plus a tiny pure
  parser, `getWifiAwareErrorCode(error)`.

This is a real constraint, not a shortcut — flagged so the seam is a deliberate choice.

`ArrayBuffer` is confirmed genuinely zero-copy in both directions
(`ArrayBuffer.wrap(dataWithoutCopy:size:onDelete:)`), so `send()`/message delivery avoid base64.

---

## Nitrogen 0.37.1 limitation: arrays of union types

Discovered while compiling, not from docs. Nitrogen maps a TypeScript string union to a C++ `enum
class`. Swift's C++ interop gives `std::vector<T>` a `Collection` conformance for struct element
types but **not for enum element types**, so any generated code that calls `.map` on a
`std::vector<SomeEnum>` fails to compile:

```
error: value of type 'std.__1.vector<margelo.nitro.wifiaware.BootstrappingMethod, …>'
       has no member 'map'
```

Nitrogen emits `.map` in some directions and a `push_back` loop in others, so whether a union array
compiles depends entirely on where it appears. Verified by probing each position:

| Position of `SomeUnion[]`                | Codegen     | Compiles |
| ---------------------------------------- | ----------- | -------- |
| `readonly` property on a HybridObject     | `push_back` | ✅ |
| Synchronous method **return**             | `push_back` | ✅ |
| Field of a struct (getter)                | `.map`      | ❌ |
| `Promise<T[]>` payload                    | `.map`      | ❌ |
| Callback/listener parameter               | `.map`      | ❌ |
| Method **parameter**                      | `.map`      | ❌ |
| Mutable property setter                   | `.map`      | ❌ |

In short: **a union array is only safe travelling native → JS, as a property or a sync return.**
Arrays of structs, strings and numbers are fine in every position; only unions are affected.

This is why the API places bootstrapping methods where it does:

- `ProgrammaticPairing.supportedBootstrappingMethods` is a **readonly property**, not a field of
  `Capabilities` — which is also the better home, since it is only meaningful once you hold a
  pairing object.
- `ProgrammaticPairing.getSupportedMethods(peerId)` is a **synchronous** method rather than a
  `Promise`. That is honest rather than a workaround: the peer advertises its methods in the
  discovery frame, so the answer is already cached locally and no radio work is involved.
- `SessionPairingOptions.bootstrappingMethods` travels JS → native, so it uses the one-field
  `OfferedBootstrappingMethod` wrapper. This is the single place the limitation is visible in the
  public API; it is documented on the type, and it collapses back to `BootstrappingMethod[]`
  unchanged for callers of everything else once nitrogen emits a `push_back` loop in that position
  too.

## Build verification

Everything below was actually run, not assumed.

| Check | Result |
| --- | --- |
| `nitrogen` codegen | 5/5 HybridObjects |
| iOS device build (`-sdk iphoneos`, Release) | **succeeded**, no warnings from library code |
| iOS simulator build (Debug) | **succeeded** |
| Android `compileDebugKotlin` (compileSdk 36) | **succeeded** |
| `tsc` — library, tests, plugin | clean |
| `tsc` — example app | clean |
| `eslint` | clean |
| Jest | 47 passing |
| `bob build` | `lib/module` + `lib/typescript` emitted |
| `expo prebuild` | entitlement, `WiFiAwareServices`, and Android permissions written correctly |
| Plugin rejection of a bad service name | fails the build naming the exact rule |

`WiFiAware.framework` is present in the **simulator** SDK as well as the device SDK, so the
`#if canImport(WiFiAware)` branches are genuinely type-checked in both configurations rather than
being compiled out.

**Not verified:** anything requiring two physical devices. Discovery, pairing, data paths and
throughput are untested — that needs hardware, and no claim is made about them.
