# react-native-wifi-aware: Wi-Fi Aware (NAN) Peer-to-Peer Networking for React Native

[![npm](https://img.shields.io/npm/v/react-native-wifi-aware.svg)](https://www.npmjs.com/package/react-native-wifi-aware)
[![npm downloads](https://img.shields.io/npm/dm/react-native-wifi-aware.svg)](https://www.npmjs.com/package/react-native-wifi-aware)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![platforms](https://img.shields.io/badge/platforms-iOS%2026%2B%20%7C%20Android-lightgrey.svg)
[![made by motionary.dev](https://img.shields.io/badge/made%20by-motionary.dev-FEEB00.svg)](https://motionary.dev?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware)

Peer-to-peer discovery and high-bandwidth data paths between nearby devices over **Wi-Fi Aware**
(NAN) — no access point, no router, no internet.

One TypeScript API over Apple's **WiFiAware** framework (iOS 26+) and Android's
**`WifiAwareManager`** (API 26+), built on [Nitro Modules](https://nitro.margelo.com) with Swift and
Kotlin implementations and binary `ArrayBuffer` payloads.

![Two devices discover each other, pair once with a PIN, open an encrypted data path, and transfer a file](docs/demo.gif)

<sub>An illustration of the flow, not a device recording — Wi-Fi Aware needs two physical devices, so
the real thing is the [example app](example).</sub>

> [!IMPORTANT]
> **Apple-to-Apple and Android-to-Android are the product.** Connecting an iPhone to an Android
> device is **not** a supported feature of this library. Read [Interoperability](#interoperability)
> before you build anything that depends on it.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [What this is, and what it isn't](#what-this-is-and-what-it-isnt)
- [What you can build](#what-you-can-build)
- [Requirements](#requirements)
- [Interoperability](#interoperability) ← **read first**
- [Pairing](#pairing)
- [Setup](#setup)
- [Usage](#usage)
- [Performance modes](#performance-modes)
- [Errors](#errors)
- [Testing](#testing)
- [Who made this](#who-made-this)
- [FAQ](#faq)
- [Related resources](#related-resources)

---

## Overview

**react-native-wifi-aware** is a React Native and Expo library for **device-to-device networking over
Wi-Fi Aware** — the Wi-Fi Alliance standard also known as **NAN (Neighbor Awareness Networking)**. It
wraps Apple's [WiFiAware framework](https://developer.apple.com/documentation/wifiaware) (iOS 26+) and
Android's [`WifiAwareManager`](https://developer.android.com/reference/android/net/wifi/aware/WifiAwareManager)
(API 26+) behind a single typed API, so two nearby devices can discover each other, pair once, and
then move real payloads at Wi-Fi speeds with no network to join and nothing routed through the
internet.

It is built on [Nitro Modules](https://nitro.margelo.com) with Swift on iOS and Kotlin on Android,
ships an Expo config plugin that validates your service names at prebuild, and is written for the
constraints these APIs actually impose rather than hiding them.

## Features

- 📡 One typed API over Apple's [WiFiAware framework](https://developer.apple.com/documentation/wifiaware) and Android's [`WifiAwareManager`](https://developer.android.com/reference/android/net/wifi/aware/WifiAwareManager)
- 🚀 **High-bandwidth data paths** — real sockets over a link the radio negotiates, not a Bluetooth-speed trickle
- 🔐 Authenticated and encrypted by design; the library **refuses to open an unencrypted data path** rather than silently downgrading
- 🤝 Both pairing models exposed honestly: system-driven [`presentPairingUI()`](#system-driven-pairing-presentpairingui) and app-driven [`getProgrammaticPairing()`](#app-driven-pairing-getprogrammaticpairing) with PIN, passphrase, QR and NFC bootstrapping
- 📦 Binary payloads over `ArrayBuffer`, length-prefix framed so one `send()` arrives as exactly one `onMessage`
- 📶 Live link quality — signal strength, throughput ceiling and capacity, per-category transmit latency
- 🎛️ `'bulk'` and `'realtime'` performance modes, plus per-connection quality-of-service hints
- 🧭 Structured error codes that keep distinct platform failures tellable apart, each carrying the raw native domain and code
- 🧩 Expo config plugin for the iOS entitlement, `WiFiAwareServices` Info.plist and Android permissions — and it **fails your build on an invalid service name** instead of letting the app crash at launch
- 🔥 Powered by [Nitro Modules](https://nitro.margelo.com)

> Wi-Fi Aware is not a general "talk to any nearby device" API. Pairing is mandatory and user-driven,
> hardware support is per-device rather than per-OS-version, and cross-ecosystem iPhone ↔ Android is
> not something this library claims. Those constraints are documented here rather than smoothed over.

| Platform             | Backed by                                                               |
| -------------------- | ----------------------------------------------------------------------- |
| iOS 26+ / iPadOS 26+ | `WiFiAware` framework, with system-driven pairing and Network framework |
| Android (API 26+)    | `WifiAwareManager`; data paths need API 29+, pairing API 34+            |

## What this is, and what it isn't

Wi-Fi Aware gives you an authenticated, encrypted link directly between two devices at Wi-Fi speeds.
It is the right tool for moving large payloads locally — media hand-off, offline sync, device-to-
device transfer, local multiplayer — where Bluetooth is too slow and a shared network is not
guaranteed to exist.

**It is not a transport by itself.** Wi-Fi Aware handles discovery, pairing and the data path; the
bytes travel over a real socket on top. This library owns that whole stack so you get
`connection.send(buffer)`, but it is worth knowing that a "connection" here is a genuine network
connection over a link the radio negotiated.

Some things it deliberately does not do:

- **It does not manage infrastructure Wi-Fi.** It never joins, scans or configures normal Wi-Fi
  networks. If that is what you need, this is the wrong library.
- **It does not pair devices behind the user's back.** Pairing is mandatory, one-time, and driven by
  a person. See [Pairing](#pairing).
- **It does not work in Expo Go**, or in the iOS Simulator. It needs a native build and real
  hardware.
- **It does not promise cross-ecosystem connectivity.** See [Interoperability](#interoperability).

## What you can build

### Capabilities at a glance

| You want to…                                          | API                                                                              | Worth knowing                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Know whether the device can do any of this             | `getCapabilities()`                                                              | Static for the process. Gate on it — support is per-device, not per-OS-version. |
| Know whether the radio is usable *right now*           | `getAvailability()`, `addOnAvailabilityChangedListener()`                        | Drops when Wi-Fi is off or Wi-Fi Direct/hotspot holds the radio.                |
| Pair through the system's own UI                       | `presentPairingUI()`                                                             | Your app never sees the PIN.                                                    |
| Pair through UI you build                              | `getProgrammaticPairing()`                                                       | PIN, passphrase, QR or NFC bootstrapping — you own the screens.                 |
| List, observe and revoke pairings                      | `getPairedDevices()`, `addOnPairedDevicesChangedListener()`, `removePairedDevice()` | Only your app's pairings are visible.                                         |
| Advertise a service                                    | `publish()`                                                                      | Optional `activeDurationMs` auto-stops it so you can't leak the radio.          |
| Discover nearby peers                                  | `subscribe()`, `addOnPeerFoundListener()`, `addOnPeerLostListener()`             | Key your UI on `peer.id`; found fires repeatedly as ads refresh.                |
| Restrict who may connect                               | `devices: { kind: 'selected', deviceIds }`                                       | Narrower selectors cost less power and advertise less.                          |
| Tag an advertisement so instances are tellable apart   | `serviceSpecificInfo`                                                            | Unencrypted and tiny. Never application data.                                   |
| Agree on a rendezvous before connecting                | `sendDiscoveryMessage()`, `addOnDiscoveryMessageListener()`                      | Best-effort, unordered, size-capped. Not a transport.                           |
| Open an encrypted, authenticated data path             | `connect()`                                                                      | Resolves ready to use — no separate readiness step.                             |
| Move arbitrary binary payloads                         | `connection.send(buffer)`, `addOnMessageListener()`                              | Message-framed: one `send()` arrives as exactly one `onMessage`, up to 64 MB.   |
| Choose throughput vs latency                           | `performanceMode: 'bulk' \| 'realtime'`                                          | **Both peers must pick the same value.**                                        |
| Hint quality of service per connection                 | `accessCategory`                                                                 | `background` → `best-effort` → `interactive-video` → `interactive-voice`.       |
| Show a live link-quality readout                       | `connection.getPerformance()`                                                    | Signal strength, throughput ceiling/capacity, per-category transmit latency.    |
| Fail fast on a bad service name                        | `validateServiceName()`, `assertValidServiceName()`                              | Pure JS — unit-testable without a device.                                       |
| Branch on *why* something failed                       | `getWifiAwareErrorCode()`, `addOnErrorListener()`                                | Structured codes plus the untouched native error for your logs.                 |

### Cases this is the right tool for

- **Large local hand-off.** Photo, video, document or archive transfer between two nearby devices at
  Wi-Fi speeds, with no router, no cloud round-trip and no upload bill. `performanceMode: 'bulk'`.
- **Offline sync between a user's own devices.** Phone ↔ tablet database, library or state sync where
  the two devices are paired once and thereafter find each other automatically.
- **Local multiplayer and shared-screen play.** Two devices in the same room exchanging input and
  state with `performanceMode: 'realtime'` and `accessCategory: 'interactive-voice'`.
- **Field and no-infrastructure work.** Crews, events, aircraft, boats, basements — anywhere there is
  no network to join and carrying one is not an option.
- **Device-to-device onboarding or migration.** Moving an account, a keyset or a whole local dataset
  to a new device, where pairing is already a step the user expects.
- **Capture offload.** A camera, wearable or drone app pushing raw captures to a phone far faster
  than Bluetooth and without a hotspot.
- **Proximity-gated actions.** Using discovery alone — without ever connecting — as evidence that a
  known, previously paired device is physically nearby.
- **Talking to standards-compliant non-phone hardware.** Wi-Fi Aware is a Wi-Fi Alliance standard;
  ESP32-class peers implementing NAN Pairing are a real target, unlike the phone-to-phone
  cross-ecosystem case below.

### Cases this is the wrong tool for

- **iPhone ↔ Android.** Not a supported feature. Read [Interoperability](#interoperability) first.
- **Rooms and meshes.** The model is point-to-point between paired devices, bounded by
  `maxConnectableDevices`. There is no broadcast and no routing — build fan-out yourself, if the
  device limit even allows it.
- **Sharing with a stranger, anonymously.** Pairing is mandatory and user-driven. If your flow cannot
  ask a person to pair, this is not the mechanism.
- **Waking on discovery.** Nothing launches your app because a peer appeared. The session needs your
  app to have runtime; schedule it with BackgroundTasks.
- **Ordinary Wi-Fi.** This never joins, scans or configures infrastructure networks.
- **Expo Go, the iOS Simulator, or CI without hardware.** Needs a native build and two physical
  devices.
- **Anything that must work on every device you ship to.** Treat Wi-Fi Aware as an accelerated path
  and keep a fallback — always gate on `getCapabilities()`.

---

## Requirements

|                | Minimum                                                                |
| -------------- | ---------------------------------------------------------------------- |
| React Native   | 0.75+                                                                  |
| iOS            | 26.0+ — iOS and iPadOS only (Mac Catalyst is explicitly unsupported)   |
| Xcode          | 16.4+ to build; **Xcode 26+** required for the iOS 26 SDK              |
| Swift          | 5.9+                                                                   |
| Android        | API 26+ for discovery; **API 29+** for data paths; API 34+ for pairing |
| `compileSdk`   | 34+                                                                    |
| NDK            | 27+                                                                    |

**Apple hardware.** iPhone 12 and later; iPad (10th gen) and later; iPad Air (4th gen) and later;
iPad Pro 11″ (3rd gen) and iPad Pro 12.9″ (5th gen) and later; iPad mini (6th gen) and later.

**There is no Simulator support.** Apple's own sample states this outright. Every test needs two
physical devices.

**Android hardware.** Support is per-device, not per-OS-version — the vendor decides. Always gate on
`getCapabilities()` at runtime rather than on an API level. Availability also drops while Wi-Fi is
off, or while Wi-Fi Direct, a hotspot, or tethering has the radio.

Device and session limits are **not published** by either platform, and they differ per device. Read
them at runtime from `getCapabilities()` and `getAvailability()`; this library never hardcodes them
and neither should your app.

---

## Interoperability

The obvious pitch for Wi-Fi Aware is "an iPhone talks directly to an Android phone." That pitch is
not something this library can currently deliver, and it would be dishonest to imply otherwise.

Here is the actual state of the world.

### What is true

Wi-Fi Aware is a **Wi-Fi Alliance** standard, not an Apple or Google invention. Apple implements the
spec and requires peers to support **Wi-Fi Aware 4.0 with NAN Pairing**. Apple described it at
WWDC25 as "cross-platform, interoperable," and third-party interop is demonstrably real: Espressif
shipped an ESP-IDF component in August 2026 that pairs and exchanges data with iPhones.

So the standard works across vendors, and Apple's implementation is not closed.

### What is not established

**iPhone ↔ Android is not confirmed working.** As of the most recent evidence available (forum
reports through September 2025, with nothing newer in either direction):

- Android's own gate, `Characteristics.isAwarePairingSupported()`, is **vendor-dependent and mostly
  returns `false`**. In reported testing only the Galaxy S25 returned `true`; Pixel 9 and Xiaomi 14
  returned `false`. A device that answers `false` cannot even attempt standards-based pairing.
- On hardware that does return `true`, engineers hit failures at several independent layers: iOS
  dropping Android publish frames over a missing DCEA attribute; Qualcomm firmware rejecting 6-digit
  PINs; pairing failing at the challenge step; pairing reportedly *succeeding* at the Android API
  level while iOS never answered the subsequent data-path request; and the Android peer not
  persisting in the iOS paired-devices list.
- Apple DTS directed reporters to the Accessory Design Guidelines and to silicon vendors. Radar
  feedback IDs **FB19568037**, **FB19570341** and **FB19683706** are on file.
- Android's newer framework-offloaded pairing (API 37) looks aimed squarely at this problem, but
  there is **no evidence** it interoperates with iOS.

None of this proves cross-ecosystem pairing is impossible. It does mean nobody has shown it working,
and that a library promising it would be selling something it cannot deliver.

### How this library is structured because of that

1. **Apple↔Apple and Android↔Android are first-class.** One JS interface, two independently solid
   native implementations. This is the supported product and what the example app demonstrates.

2. **Cross-ecosystem pairing is quarantined behind a name you cannot reach by accident.** There is
   exactly one entry point:

   ```ts
   const pairing = await wifiAware.getProgrammaticPairing()
   await pairing.initiatePairingWithForeignPeer({ ... })   // experimental, expect failure
   ```

   `connect()`, `publish()`, `subscribe()`, `presentPairingUI()` and `initiatePairing()` will
   **never** silently attempt it.

3. **The capability flag reports a radio capability, not a working integration.**
   `capabilities.isCrossPlatformPairingSupported` is `false` on iOS (there is nothing to query) and
   on Android reflects `isAwarePairingSupported()`. Read it as *"this radio exposes standardised NAN
   pairing"* — **not** *"talking to an iPhone will work."*

4. **This library does not claim Android discovers iOS peers.** Not here, not in the package
   description, not in the npm keywords.

If you get it working on a specific pair of devices, that is a genuinely useful data point — please
open an issue with both exact models and OS builds. It will be documented as that pair, and nothing
broader.

---

## Pairing

**Every connection requires that the two devices were paired first.** There is no anonymous or
opportunistic path to a data path on Apple platforms. Apple's Developer Technical Support put it
plainly: *"Is this pairing mandatory? Yes. That's how Wi-Fi Aware works."*

Pairing happens **once** per pair of devices. After that the pairing persists until a user removes
it, and connecting is quick.

### The two platforms pair differently, and this library shows you that

This is the one place where a unified `pair()` would be a lie, so the API does not pretend:

|                       | System-driven pairing                     | App-driven pairing                                 |
| --------------------- | ----------------------------------------- | -------------------------------------------------- |
| Who owns the UI       | The operating system                      | Your app                                            |
| Your code can pair    | No — it can only present the system UI    | Yes, fully programmatic                             |
| Secret exchange       | PIN, shown and entered in system UI       | PIN, passphrase, QR or NFC — your choice            |
| Entry point           | `wifiAware.presentPairingUI(...)`         | `wifiAware.getProgrammaticPairing()`                |
| Capability flag       | `capabilities.isPairingUISupported`       | `capabilities.isProgrammaticPairingSupported`       |

Branch on the capability, not on `Platform.OS` — programmatic pairing is gated by the **vendor's
hardware**, so two Android devices on the same OS release can disagree about whether it exists.

```ts
const capabilities = await wifiAware.getCapabilities()

if (capabilities.isPairingUISupported) {
  const device = await wifiAware.presentPairingUI({
    role: 'subscriber',
    serviceName: '_chat._tcp',
  })
  if (device == null) return // the user dismissed the sheet
} else if (capabilities.isProgrammaticPairingSupported) {
  const pairing = await wifiAware.getProgrammaticPairing()
  // …drive your own bootstrapping UI; see below
} else {
  // This device cannot pair at all. Say so plainly rather than failing later at connect().
}
```

`getProgrammaticPairing()` **rejects** rather than returning `null` on devices that cannot do it, so
holding one is proof the methods on it are real. That is deliberate: it removes a whole class of
"check the flag before every call" bugs.

### System-driven pairing (`presentPairingUI`)

The two devices take **opposite roles**, matching the role each declared for the service:

- **`role: 'publisher'`** presents this device to be paired with, and displays the PIN.
- **`role: 'subscriber'`** presents a picker of nearby devices, and the user chooses one.

Resolves with the newly paired device, or `undefined` if the user dismissed the UI. Your code never
sees or generates the PIN — the system handles the whole exchange.

**Users manage and revoke these pairings themselves**, in
**Settings → Privacy & Security → Paired Devices**. Your app cannot remove a system-managed pairing;
`removePairedDevice()` rejects with `'unsupported-operation'` there. If a user reports that a device
"stopped connecting", that settings screen is the first place to look.

QR-code pairing is **not available** on Apple platforms. Apple documents PIN only. Do not build a UI
that promises it.

### App-driven pairing (`getProgrammaticPairing`)

Your app owns the flow, in three steps:

```ts
const pairing = await wifiAware.getProgrammaticPairing()

// 1. Agree how the secret will travel. Only offer methods your UI can actually drive.
await pairing.requestBootstrapping(peer.id, 'pin-code-display')

// 2. Run your own UI for that method — display the PIN, scan the QR code, prompt for input.
const password = await showPinToUser()

// 3. Pair, storing it under an alias you choose and keep stable for this peer.
const device = await pairing.initiatePairing({
  peerId: peer.id,
  alias: 'living-room-tv',
  method: 'pin-code-display',
  password,
})
```

The responding device receives the request through `addOnPairingRequestListener` and answers with
`acceptPairingRequest` or `rejectPairingRequest`. **Always reject explicitly** rather than ignoring a
request — it lets the other device's UI fail fast instead of hanging until a timeout.

Nine bootstrapping methods exist (`opportunistic`, PIN and passphrase in display/keypad form, QR in
display/scan form, and NFC tag/reader). Intersect `pairing.supportedBootstrappingMethods` — what
this device can drive — with `pairing.getSupportedMethods(peerId)` — what the peer will accept —
before choosing one.

> [!WARNING]
> `'opportunistic'` performs **no user verification** and cannot defend against an active attacker in
> radio range. Use it only when the data path carries nothing sensitive.

### Do not trust `pairingInfo`

A device advertises `pairingInfo` (`pairingName`, `vendorName`, `modelName`) *before* pairing
completes, over an unauthenticated, unencrypted channel. It can be intercepted or forged.

Use it for exactly one thing: helping a person recognise the device they meant to pair with. If your
app needs trustworthy facts about the peer, exchange them over the encrypted data path once pairing
is done. The system stops broadcasting these values after initial pairing, specifically so devices
cannot be tracked by them.

---

## Setup

```sh
npm install react-native-wifi-aware react-native-nitro-modules
```

`react-native-nitro-modules` is an **optional peer dependency** and must be installed by the app, not
bundled by this library — two copies of Nitro in one binary fails at runtime with
`Nitro was installed twice`.

### Expo config plugin

```json
{
  "expo": {
    "plugins": [
      ["react-native-wifi-aware", { "services": ["_chat._tcp"] }]
    ]
  }
}
```

The plugin writes the iOS entitlement, the `WiFiAwareServices` Info.plist dictionary, and the Android
permissions with the correct `maxSdkVersion` and `neverForLocation` flags — and **validates every
service name at prebuild**, failing the build with the specific rule that was broken.

That validation is the single most valuable thing the plugin does, because of the next section.

### Service names crash the app if they are wrong

Apple, verbatim: *"Invalid service names in the `Info.plist` will cause the app to crash."* And if
neither `Publishable` nor `Subscribable` is declared for a service, *"the framework crashes your
app."*

This is a launch-time crash on a real device, not a catchable error. A service name must be a DNS-SD
service type:

- `_label._tcp` or `_label._udp`;
- the label uses only `a`–`z`, `A`–`Z`, `0`–`9` and `-`;
- it contains at least one letter;
- it does not start or end with a hyphen;
- it is at most 15 characters.

✅ `_chat._tcp`  ✅ `_photo-sync._udp`  ❌ `_chat` ❌ `_-chat._tcp` ❌ `_123._tcp`

The same rules are exported for use in your own code and tests:

```ts
import { validateServiceName } from 'react-native-wifi-aware'

validateServiceName('_-chat._tcp')
// { isValid: false, rule: 'label-hyphen-position', message: '…starts or ends with a hyphen…' }
```

A service may be **published at most once per device**.

### The iOS entitlement needs Apple's approval

`com.apple.developer.wifi-aware` is a **managed capability**. It does not appear in Xcode's
Signing & Capabilities list until it has been granted to your account, and a build without it fails
at runtime with `'entitlement-missing'`.

Reported practice — from Espressif's August 2026 write-up, **not** documented by Apple — is that you
request it at
[developer.apple.com/contact/request/wifi-aware](https://developer.apple.com/contact/request/wifi-aware).
Apple does not document the approval step itself, so treat "requires approval" as reported rather
than official. Either way: **request it early**, because you cannot ship without it and the timeline
is not in your control.

### Android permissions

The plugin adds these for you. `NEARBY_WIFI_DEVICES` is declared with
`android:usesPermissionFlags="neverForLocation"`, which is what lets the app avoid requesting
location. Drop that flag and you must also request `ACCESS_FINE_LOCATION`.

This library attaches to the Wi-Fi Aware subsystem in the mode that **does not require location
permission**, and deliberately avoids the identity-change listener, which requires location *and*
wakes the app periodically.

---

## Usage

```ts
import { wifiAware, getWifiAwareErrorCode } from 'react-native-wifi-aware'

const capabilities = await wifiAware.getCapabilities()
if (!capabilities.isSupported) return

const { isAvailable } = await wifiAware.getAvailability()
if (!isAvailable) return // Wi-Fi is probably off
```

**Publisher** — advertise, and accept whoever connects:

```ts
const session = await wifiAware.publish({
  serviceName: '_chat._tcp',
  performanceMode: 'bulk',
  passphrase: sharedSecret, // required where the platform does not derive keys from the pairing
})

const incoming = session.addOnConnectionListener(async (connection) => {
  await session.stop() // stop advertising once connected

  connection.addOnMessageListener((data) => {
    const text = new TextDecoder().decode(data) // copy synchronously if you keep the bytes
    console.log(text)
  })
})
```

**Subscriber** — discover, connect, send:

```ts
const session = await wifiAware.subscribe({ serviceName: '_chat._tcp' })

const found = session.addOnPeerFoundListener(async (peer) => {
  if (peer.pairedDeviceId == null) return // needs pairing first

  const connection = await session.connect(peer.id, {
    performanceMode: 'bulk',
    passphrase: sharedSecret,
  })
  await session.stop()

  await connection.send(new TextEncoder().encode('hello').buffer)

  const report = await connection.getPerformance()
  console.log(report?.signalStrength, report?.throughputCapacityRatio)
})

// later
found.remove()
```

Every `addOn…Listener` returns a subscription — call `remove()` when the owning scope ends.
Listeners left registered keep native resources alive.

### The data-path secret

Some platforms derive the data path's encryption keys from the pairing itself. Others require the
app to supply a shared secret, and this library **refuses to open an unencrypted data path** rather
than quietly downgrading:

```ts
await wifiAware.publish({ serviceName: '_chat._tcp', passphrase: secret })
await session.connect(peer.id, { passphrase: secret })   // identical value on both sides
```

Both peers must supply the same value, and it must reach them through a channel you already trust —
derived from the pairing, entered by the user, or fetched from your backend. **Never send it over
the discovery channel**, which is unencrypted. Where the platform derives keys from the pairing, the
value is simply ignored, so passing it unconditionally is safe and portable.

Omitting it where it is required fails with `'invalid-argument'` naming the option, rather than
opening an open link.

### Lifecycle

Sessions and connections own radio resources, and the two are independent:

- **Stop the session once you are connected.** Apple recommends it explicitly, and searching or
  advertising costs power. Stopping a session does **not** close data paths it produced.
- **Close every connection you are handed**, including ones delivered to
  `addOnConnectionListener`. Otherwise the system holds the path open until it times out.
- **Keep device selectors narrow.** `{ type: 'selected', deviceIds: [...] }` costs less power than
  accepting all paired devices, and advertises interest in fewer devices.

Background operation is supported by the platform in both foreground and background states, but your
app still needs runtime — schedule it with BackgroundTasks. There is no documented wake-on-discovery:
nothing will launch your app because a peer appeared.

### The discovery message channel is not a transport

`sendDiscoveryMessage()` exists because a handshake before connecting is sometimes genuinely useful.
It is tiny, **not guaranteed to be delivered**, unordered, and unavailable on some platforms. Use it
to agree on a rendezvous; send everything else through `connection.send()`.

---

## Performance modes

Wi-Fi Aware data paths run in one of two modes, and **both peers must choose the same one**:

| Mode         | Optimises for                        | Cost                                        |
| ------------ | ------------------------------------ | ------------------------------------------- |
| `'bulk'`     | Sustained throughput, power, sharing | Higher latency. **The default.**            |
| `'realtime'` | Latency                              | Throughput, coexistence, **battery drain**  |

> [!WARNING]
> Apple: *"Mismatched performance modes lead to an undefined behaviour."* This is not negotiated and
> a mismatch is not reported — you get a link that misbehaves in ways that are hard to diagnose.

Neither platform tells you the peer's mode, so agree on it out of band: hardcode it for both sides of
your app, or exchange it in your own handshake before connecting.

`accessCategory` is a separate, per-connection quality-of-service hint. Wi-Fi is a shared medium, so
choosing the *lowest* category that meets your needs improves throughput for your own flows and for
every other device in range.

---

## Errors

Failures **caused by a call** are thrown or rejected from that call. Classify them with the exported
helper rather than matching on message text:

```ts
import { getWifiAwareErrorCode } from 'react-native-wifi-aware'

try {
  await session.connect(peer.id)
} catch (error) {
  switch (getWifiAwareErrorCode(error)) {
    case 'no-paired-devices':          return promptToPair()
    case 'device-no-longer-available': return showPeerLeft()
    case 'unavailable':                return promptToEnableWifi()
    default:                           throw error
  }
}
```

Failures that happen **on their own** — the peer walks away, the user disables Wi-Fi, the system
reclaims the radio — arrive through error listeners as a structured `WifiAwareErrorInfo`, carrying
the code plus the untouched native error for your logs:

```ts
connection.addOnErrorListener((error) => {
  console.warn(error.code, error.nativeDomain, error.nativeCode, error.nativeDescription)
})
```

Each distinct platform failure maps to its own code, so `'no-radio-resources'`,
`'connection-idle-timeout'` and `'entitlement-missing'` stay tellable apart — see
`WifiAwareErrorCode` for the full list.

---

## Testing

**On-device native tests** run through React Native Harness. Wi-Fi Aware cannot be tested with one
device or in a simulator, so this needs **two physical devices per platform** — four to cover both.
There is no way around that: the feature is device-to-device by definition.

**Unit tests** run under Jest against the mocked JS layer. The package resolves to a non-native build
off-device where every member throws on access, so an accidental import in a Node test fails loudly
instead of silently no-oping. Mock the `wifiAware` export in tests that need it.

Pure logic — service-name validation, error-code parsing — is testable without any of that:

```ts
import { validateServiceName } from 'react-native-wifi-aware'

expect(validateServiceName('_chat._tcp')).toEqual({ isValid: true })
```

## Who made this

Built and maintained by [Mehdi](https://github.com/mahdidavoodi7)
([@mehdi_made](https://x.com/mehdi_made) on X), the developer behind
[Motionary](https://motionary.dev?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware),
a library of premium, production-ready React Native animations and interactions hand-crafted with
Reanimated, Skia, Gesture Handler and Expo.

This library came out of the far end of that work. A beautifully animated transfer screen is still a
broken feature if the only way to get a file from one phone to another is a round trip through
someone's server — and the moment two people are standing next to each other, the network in the
middle is the slowest part of the product. Wi-Fi Aware removes it. Apple and Google both shipped the
same Wi-Fi Alliance standard and then disagreed about almost every detail of how you use it, so those
disagreements are written down here instead of smoothed over.

If you're here for the visual half of the same problem:

- [React Native animations](https://motionary.dev/animations?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware): the drops, copy-paste animation components with the interaction already tuned
- [Builds](https://motionary.dev/builds?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware): real React Native apps shipped end to end, with the drops inside
- [Free React Native components](https://motionary.dev/components?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware): a copy-paste reference set
- [The Motionary blog](https://motionary.dev/blog?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware), including
  [the best React Native UI libraries in 2026](https://motionary.dev/blog/best-react-native-ui-libraries-2026)
  and [why shape beats shimmer in skeleton loading](https://motionary.dev/blog/react-native-skeleton-loading)

## FAQ

**Does it work in Expo Go?**
No. Nitro modules need native code, so Expo Go can never load them. Use a development build (`npx expo prebuild`, then `expo run:ios` / `expo run:android`).

**Can I test this on the iOS Simulator?**
No, and there is no workaround. Apple's own sample states it outright, and `getCapabilities()` reports `isSupported: false` there. Wi-Fi Aware is device-to-device by definition, so every meaningful test needs **two physical devices** — four if you want to cover both platforms.

**Can an iPhone talk to an Android phone over Wi-Fi Aware?**
Not as far as anyone has demonstrated, and this library does not claim it. Wi-Fi Aware is a Wi-Fi Alliance standard and Apple's implementation is not closed — Espressif shipped an ESP-IDF component that pairs with iPhones — but iPhone ↔ Android has failed at several independent layers in reported testing, and Android's own `isAwarePairingSupported()` returns `false` on most hardware. See [Interoperability](#interoperability) for the full picture. Apple ↔ Apple and Android ↔ Android are the supported product.

**Do users have to pair every time they connect?**
No. Pairing happens **once** per pair of devices and persists until a user removes it; after that, connecting is quick. But pairing is **mandatory** — there is no anonymous or opportunistic path to a data path. Apple's Developer Technical Support: *"Is this pairing mandatory? Yes. That's how Wi-Fi Aware works."*

**Which Android devices support Wi-Fi Aware?**
It is decided per device by the vendor, not by the OS version, so two phones on the same Android release can disagree. Never gate on an API level — call `getCapabilities()` at runtime and branch on `isSupported`. Availability also drops while Wi-Fi is off, or while Wi-Fi Direct, a hotspot or tethering holds the radio.

**Do I need a special entitlement from Apple?**
Yes. `com.apple.developer.wifi-aware` is a **managed capability** — it does not appear in Xcode until Apple grants it to your account, and a build without it fails at runtime with `'entitlement-missing'`. Request it early; the timeline is not in your control. See [The iOS entitlement needs Apple's approval](#the-ios-entitlement-needs-apples-approval).

**Does my app need location permission on Android?**
No. This library attaches to the Wi-Fi Aware subsystem in the mode that does not require location, and the config plugin declares `NEARBY_WIFI_DEVICES` with `android:usesPermissionFlags="neverForLocation"`. Drop that flag and you would also have to request `ACCESS_FINE_LOCATION`.

**How is this different from AirDrop, Nearby Share or Multipeer Connectivity?**
Those are finished features or Apple-only frameworks; this is the transport underneath, available to your own app on both platforms. Wi-Fi Aware gives you an authenticated, encrypted link at Wi-Fi speeds that you move your own bytes over — your protocol, your UI, your payloads — rather than handing a file to a system share sheet.

**Is this the same as Wi-Fi Direct?**
No. Wi-Fi Direct forms a group with one device acting as an access point. Wi-Fi Aware needs no group, no AP and no association step — devices discover each other continuously at low power and open a data path on demand. On Android the two also compete for the radio, which is why `getAvailability()` can report unavailable while a hotspot or Wi-Fi Direct group is active.

**Does it work without Expo?**
Yes. The Expo config plugin is a convenience; the [Setup](#setup) section lists the entitlement, Info.plist and `AndroidManifest.xml` entries to add by hand.

## Related resources

- [motionary.dev](https://motionary.dev?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware) — React Native components, animations and guides
- [Apple: Supercharge device connectivity with Wi-Fi Aware (WWDC25 session 228)](https://developer.apple.com/videos/play/wwdc2025/228/) — the iOS behaviour this library wraps
- [Apple: Wi-Fi Aware framework documentation](https://developer.apple.com/documentation/wifiaware) and [Adopting Wi-Fi Aware](https://developer.apple.com/documentation/WiFiAware/Adopting-Wi-Fi-Aware)
- [Android: Wi-Fi Aware guide](https://developer.android.com/develop/connectivity/wifi/wifi-aware) and [`WifiAwareManager` reference](https://developer.android.com/reference/android/net/wifi/aware/WifiAwareManager)
- [Wi-Fi Alliance: Wi-Fi Aware](https://www.wi-fi.org/discover-wi-fi/wi-fi-aware) — the standard both platforms implement
- [Nitro Modules](https://nitro.margelo.com) — the native module framework this is built on

## Sponsor

Built and maintained by [**motionary.dev**](https://motionary.dev?utm_source=github&utm_medium=readme&utm_campaign=react-native-wifi-aware) — free, and free to use.

If this saved you a week of reading two platforms' peer-to-peer networking documentation, take a look
at what else is over there.

## License


MIT
