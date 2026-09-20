import { ScrollView, Text, View } from 'react-native';
import { wifiAware } from 'react-native-wifi-aware';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { SERVICE_NAME } from '../SERVICE';
import { styles } from '../theme';
import { describeError, useWifiAware } from '../useWifiAware';
import { useState } from 'react';

/**
 * Capability and pairing screen.
 *
 * Pairing is mandatory before any data path, and the two platforms pair in structurally different
 * ways, so this screen branches on the capability flags rather than on the platform.
 */
export function SetupScreen() {
  const { capabilities, availability, pairedDevices, error, refresh } =
    useWifiAware();
  const [status, setStatus] = useState<string>();

  async function pair(role: 'publisher' | 'subscriber') {
    setStatus(`Presenting the ${role} pairing UI…`);
    try {
      const device = await wifiAware.presentPairingUI({
        role,
        serviceName: SERVICE_NAME,
      });
      setStatus(
        device
          ? `Paired with ${device.displayName ?? device.id}.`
          : 'Pairing cancelled.'
      );
      await refresh();
    } catch (caught) {
      setStatus(describeError(caught));
    }
  }

  if (capabilities == null) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Banner title="Reading capabilities…" />
          {error ? (
            <Banner tone="danger" title="Failed" children={error} />
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!capabilities.isSupported ? (
        <Banner tone="danger" title="Wi-Fi Aware is not supported here">
          This needs a physical iPhone 12 or later, or an Android device whose
          vendor ships Wi-Fi Aware. It never works in the iOS Simulator or in
          Expo Go.
        </Banner>
      ) : availability?.isAvailable === false ? (
        <Banner tone="warning" title="Wi-Fi Aware is unavailable right now">
          Turn Wi-Fi on. Availability also drops while Wi-Fi Direct, a hotspot,
          or tethering is using the radio.
        </Banner>
      ) : (
        <Banner
          tone="success"
          title="Ready"
          children={`Advertising ${SERVICE_NAME}.`}
        />
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Capabilities</Text>
        <Text style={styles.subtitle}>
          Fixed for this device. Limits are read at runtime because neither
          platform publishes them.
        </Text>
        <Field label="Supported" value={String(capabilities.isSupported)} />
        <Field label="Max peers" value={capabilities.maxConnectableDevices} />
        <Field
          label="Max publish"
          value={capabilities.maxPublishableServices}
        />
        <Field
          label="Max subscribe"
          value={capabilities.maxSubscribableServices}
        />
        <Field
          label="Pairing UI"
          value={String(capabilities.isPairingUISupported)}
        />
        <Field
          label="Programmatic pairing"
          value={String(capabilities.isProgrammaticPairingSupported)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Availability</Text>
        <Text style={styles.subtitle}>
          Changes while the app runs. A dash means the platform reports no
          running count, not that none are free.
        </Text>
        <Field
          label="Available"
          value={String(availability?.isAvailable ?? '—')}
        />
        <Field label="Data paths" value={availability?.availableDataPaths} />
        <Field
          label="Publish slots"
          value={availability?.availablePublishSessions}
        />
        <Field
          label="Subscribe slots"
          value={availability?.availableSubscribeSessions}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Pairing</Text>
        {capabilities.isPairingUISupported ? (
          <>
            <Text style={styles.subtitle}>
              The system owns this flow. Run one device as publisher and the
              other as subscriber, then confirm the PIN. Existing pairs live in
              Settings › Privacy &amp; Security › Paired Devices.
            </Text>
            <Button
              title="Pair as publisher"
              onPress={() => {
                void pair('publisher');
              }}
            />
            <Button
              title="Pair as subscriber"
              variant="secondary"
              onPress={() => {
                void pair('subscriber');
              }}
            />
          </>
        ) : capabilities.isProgrammaticPairingSupported ? (
          <Text style={styles.subtitle}>
            This device pairs programmatically, so the app owns the UI: pick a
            bootstrapping method, show or collect the secret, then call
            initiatePairing. getProgrammaticPairing() reports which methods this
            device can drive, and getSupportedMethods(peerId) what a given peer
            will accept.
          </Text>
        ) : (
          <Banner tone="warning" title="This device cannot pair">
            No system pairing UI, and the radio does not expose programmatic
            pairing. Support is decided by the hardware vendor, so it varies
            between devices on the same OS release.
          </Banner>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>
          Paired devices ({pairedDevices.length})
        </Text>
        {pairedDevices.length === 0 ? (
          <Text style={styles.subtitle}>
            None yet. A peer must be paired before any connection can be made.
          </Text>
        ) : (
          pairedDevices.map((device) => (
            <View key={device.id} style={styles.row}>
              <Text style={styles.value}>
                {device.displayName ?? device.id}
              </Text>
              <Text style={styles.subtitle}>
                {device.pairingInfo?.modelName ?? ''}
              </Text>
            </View>
          ))
        )}
      </View>

      {status ? <Banner title="Status" children={status} /> : null}
      <Button
        title="Refresh"
        variant="secondary"
        onPress={() => {
          void refresh();
        }}
      />
    </ScrollView>
  );
}
