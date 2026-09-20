import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { wifiAware, type BootstrappingMethod } from 'react-native-wifi-aware';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { styles } from '../theme';
import { describeError, useWifiAware } from '../useWifiAware';

/**
 * Cross-ecosystem pairing — explicitly experimental.
 *
 * This screen exists to make the state of interoperability legible, not to suggest it works.
 * Nothing here is reachable from the normal pairing or connection flow.
 */
export function ExperimentalScreen() {
  const { capabilities } = useWifiAware();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function attempt() {
    setBusy(true);
    setStatus('Attempting a standards-based pairing with a foreign peer…');
    try {
      const pairing = await wifiAware.getProgrammaticPairing();
      const method: BootstrappingMethod = 'pin-code-display';

      // A real flow would discover a peer first and take the PIN from the user. This is here to
      // show the shape of the call, and to demonstrate that failure is handled honestly.
      await pairing.requestBootstrapping('unknown-peer', method);
      const device = await pairing.initiatePairingWithForeignPeer({
        peerId: 'unknown-peer',
        alias: 'foreign-peer',
        method,
        password: '000000',
      });
      setStatus(
        `Unexpectedly succeeded: ${device.id}. Please report the exact device pair.`
      );
    } catch (caught) {
      setStatus(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Banner tone="warning" title="Experimental — expected to fail">
        Connecting an iPhone to an Android device over Wi-Fi Aware is not
        demonstrated working. The standard allows it and third-party devices do
        interoperate with iPhones, but nobody has shown this specific pairing
        succeeding.
      </Banner>

      <View style={styles.card}>
        <Text style={styles.title}>What is actually known</Text>
        <Text style={styles.subtitle}>
          Wi-Fi Aware is a Wi-Fi Alliance standard, and Apple requires peers to
          support Wi-Fi Aware 4.0 with NAN Pairing. An ESP-IDF component shipped
          in August 2026 pairs and exchanges data with iPhones, so the
          implementation is not closed.
        </Text>
        <Text style={styles.subtitle}>
          What has not been shown is iPhone to Android. Android&apos;s own
          pairing capability is vendor-gated and mostly reports false; on
          hardware where it reports true, reported testing hit failures at
          several independent layers, from dropped publish frames to a data-path
          request that was never answered.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>This device</Text>
        <Text style={styles.subtitle}>
          The flag below reports a radio capability. It does not mean pairing
          with another ecosystem works.
        </Text>
        <Field
          label="NAN pairing exposed"
          value={String(capabilities?.isCrossPlatformPairingSupported ?? '—')}
        />
        <Field
          label="Programmatic pairing"
          value={String(capabilities?.isProgrammaticPairingSupported ?? '—')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Try it anyway</Text>
        <Text style={styles.subtitle}>
          Uses a separate, clearly-named entry point that the normal pair and
          connect calls never reach. If this ever succeeds, the exact device
          pair and OS builds are the useful thing to report.
        </Text>
        <Button
          title="Attempt foreign-peer pairing"
          onPress={() => {
            void attempt();
          }}
          disabled={
            busy || capabilities?.isCrossPlatformPairingSupported !== true
          }
        />
        {capabilities?.isCrossPlatformPairingSupported !== true ? (
          <Text style={styles.subtitle}>
            Disabled: this device&apos;s radio does not expose standardised NAN
            pairing.
          </Text>
        ) : null}
      </View>

      {status ? (
        <Banner tone="danger" title="Result" children={status} />
      ) : null}
    </ScrollView>
  );
}
