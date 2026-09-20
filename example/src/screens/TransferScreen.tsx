import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  wifiAware,
  type Connection,
  type DiscoveredPeer,
  type PerformanceReport,
  type PublishSession,
  type SubscribeSession,
} from 'react-native-wifi-aware';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { DEMO_PASSPHRASE, PERFORMANCE_MODE, SERVICE_NAME } from '../SERVICE';
import { colors, styles } from '../theme';
import { describeError } from '../useWifiAware';

/** Size of the payload the "send 1 MB" button transfers. */
const PAYLOAD_BYTES = 1024 * 1024;

/**
 * The two-device flow: publish on one, subscribe on the other, connect, and stream bytes.
 *
 * Run this on two paired devices, tapping Publish on one and Subscribe on the other.
 */
export function TransferScreen() {
  const [log, setLog] = useState<string[]>([]);
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [connection, setConnection] = useState<Connection>();
  const [performance, setPerformance] = useState<PerformanceReport>();
  const [received, setReceived] = useState(0);
  const [busy, setBusy] = useState(false);

  const publishSession = useRef<PublishSession>(undefined);
  const subscribeSession = useRef<SubscribeSession>(undefined);

  const append = useCallback((line: string) => {
    setLog((previous) =>
      [`${new Date().toLocaleTimeString()}  ${line}`, ...previous].slice(0, 40)
    );
  }, []);

  /** Wires listeners onto a freshly opened connection. */
  const adopt = useCallback(
    (opened: Connection) => {
      setConnection(opened);
      setReceived(0);
      append(`Connected to ${opened.peerId}.`);

      const message = opened.addOnMessageListener((data) => {
        // The buffer is only valid for this call, so read what we need synchronously.
        setReceived((total) => total + data.byteLength);
      });
      const state = opened.addOnStateChangedListener((next) =>
        append(`Connection ${next}.`)
      );
      const failed = opened.addOnErrorListener((error) =>
        append(`Connection error — ${error.code}: ${error.message}`)
      );

      return () => {
        message.remove();
        state.remove();
        failed.remove();
      };
    },
    [append]
  );

  // Poll link quality while a connection is open. A refresh every second or two is plenty.
  useEffect(() => {
    if (connection == null) {
      setPerformance(undefined);
      return;
    }
    const timer = setInterval(() => {
      void connection
        .getPerformance()
        .then(setPerformance)
        .catch(() => {});
    }, 1500);
    return () => clearInterval(timer);
  }, [connection]);

  // Release radio resources if the screen goes away mid-session.
  useEffect(() => {
    return () => {
      void publishSession.current?.stop();
      void subscribeSession.current?.stop();
    };
  }, []);

  async function publish() {
    setBusy(true);
    try {
      const session = await wifiAware.publish({
        serviceName: SERVICE_NAME,
        performanceMode: PERFORMANCE_MODE,
        passphrase: DEMO_PASSPHRASE,
      });
      publishSession.current = session;
      append('Publishing. Waiting for a peer to connect…');

      session.addOnConnectionListener((incoming) => {
        adopt(incoming);
        // Apple recommends stopping the listener once connected, and it saves power everywhere.
        void session.stop();
        append('Stopped advertising now that a peer is connected.');
      });
      session.addOnErrorListener((error) =>
        append(`Publish error — ${error.code}`)
      );
    } catch (caught) {
      append(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function subscribe() {
    setBusy(true);
    try {
      const session = await wifiAware.subscribe({ serviceName: SERVICE_NAME });
      subscribeSession.current = session;
      append('Searching for peers…');

      session.addOnPeerFoundListener((peer) => {
        setPeers((current) =>
          current.some((existing) => existing.id === peer.id)
            ? current
            : [...current, peer]
        );
        append(`Found ${peer.displayName ?? peer.id}.`);
      });
      session.addOnPeerLostListener((peerId) => {
        setPeers((current) => current.filter((peer) => peer.id !== peerId));
        append(`Lost ${peerId}.`);
      });
      session.addOnErrorListener((error) =>
        append(`Subscribe error — ${error.code}`)
      );
    } catch (caught) {
      append(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function connect(peer: DiscoveredPeer) {
    setBusy(true);
    try {
      append(`Connecting to ${peer.id}…`);
      const opened = await subscribeSession.current!.connect(peer.id, {
        performanceMode: PERFORMANCE_MODE,
        passphrase: DEMO_PASSPHRASE,
        timeoutMs: 30_000,
      });
      adopt(opened);
      await subscribeSession.current?.stop();
      append('Stopped searching now that we are connected.');
    } catch (caught) {
      append(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (connection == null) return;
    setBusy(true);
    try {
      const payload = new Uint8Array(PAYLOAD_BYTES);
      // Fill so the bytes are not trivially compressible by any layer underneath.
      for (let index = 0; index < payload.length; index += 1)
        payload[index] = index % 256;

      const startedAt = Date.now();
      await connection.send(payload.buffer);
      const seconds = (Date.now() - startedAt) / 1000;
      const mbps = ((PAYLOAD_BYTES * 8) / 1_000_000 / seconds).toFixed(1);
      append(
        `Sent ${PAYLOAD_BYTES / 1024} KiB in ${seconds.toFixed(2)}s (~${mbps} Mbps).`
      );
    } catch (caught) {
      append(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await connection?.close();
    setConnection(undefined);
    append('Closed the connection.');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Banner title="Two devices required">
        Tap Publish on one device and Subscribe on the other. Both must already
        be paired, and both must use the same performance mode.
      </Banner>

      <View style={styles.card}>
        <Text style={styles.title}>Session</Text>
        <Button
          title="Publish (device A)"
          onPress={() => {
            void publish();
          }}
          disabled={busy}
        />
        <Button
          title="Subscribe (device B)"
          variant="secondary"
          onPress={() => {
            void subscribe();
          }}
          disabled={busy}
        />
      </View>

      {peers.length > 0 && connection == null ? (
        <View style={styles.card}>
          <Text style={styles.title}>Discovered peers</Text>
          {peers.map((peer) => (
            <View key={peer.id} style={styles.peerRow}>
              <Text style={styles.value}>{peer.displayName ?? peer.id}</Text>
              {peer.pairedDeviceId == null ? (
                <Text style={{ ...styles.subtitle, color: colors.warning }}>
                  Not paired yet — pair on the Setup tab first.
                </Text>
              ) : null}
              <Button
                title="Connect"
                onPress={() => {
                  void connect(peer);
                }}
                disabled={busy || peer.pairedDeviceId == null}
              />
            </View>
          ))}
        </View>
      ) : null}

      {connection != null ? (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>Connection</Text>
            <Field label="Peer" value={connection.peerId} />
            <Field label="State" value={connection.state} />
            <Field
              label="Received"
              value={`${(received / 1024).toFixed(0)} KiB`}
            />
            <Button
              title="Send 1 MiB"
              onPress={() => {
                void send();
              }}
              disabled={busy}
            />
            <Button
              title="Close"
              variant="secondary"
              onPress={() => {
                void disconnect();
              }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Link quality</Text>
            <Text style={styles.subtitle}>
              Every metric is independently optional. A dash means the system
              could not measure it, which is different from zero.
            </Text>
            <Field
              label="Signal"
              value={
                performance?.signalStrength != null
                  ? `${Math.round(performance.signalStrength * 100)}%`
                  : undefined
              }
            />
            <Field
              label="Ceiling"
              value={performance?.throughputCeilingMbps?.toFixed(1)}
            />
            <Field
              label="Capacity"
              value={performance?.throughputCapacityMbps?.toFixed(1)}
            />
            <Field
              label="Capacity ratio"
              value={
                performance?.throughputCapacityRatio != null
                  ? `${Math.round(performance.throughputCapacityRatio * 100)}%`
                  : undefined
              }
            />
            <Field
              label="Active"
              value={performance?.activeDurationMs?.toFixed(0)}
            />
            {performance?.transmitLatency.map((metric) => (
              <Field
                key={metric.accessCategory}
                label={metric.accessCategory}
                value={metric.averageLatencyMs?.toFixed(1)}
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>Log</Text>
        {log.length === 0 ? (
          <Text style={styles.subtitle}>Nothing yet.</Text>
        ) : (
          log.map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.mono}>
              {line}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}
