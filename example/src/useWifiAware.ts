import { useCallback, useEffect, useState } from 'react';
import {
  wifiAware,
  getWifiAwareErrorCode,
  type Availability,
  type Capabilities,
  type PairedDevice,
} from 'react-native-wifi-aware';

/** Turns any thrown value into a line worth showing a human. */
export function describeError(error: unknown): string {
  const code = getWifiAwareErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  return code
    ? `${code}: ${message.replace(/^\[wifi-aware:[a-z-]+\]\s*/, '')}`
    : message;
}

/**
 * Reads device capabilities once, and tracks availability and pairings as they change.
 *
 * Capabilities are fixed for the process lifetime, so they are fetched once. Availability changes
 * while the app runs — Wi-Fi being switched off, the radio being taken by another feature — so it
 * is refreshed from the listener where the platform provides one.
 */
export function useWifiAware() {
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [availability, setAvailability] = useState<Availability>();
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setCapabilities(await wifiAware.getCapabilities());
      setAvailability(await wifiAware.getAvailability());
      setPairedDevices(await wifiAware.getPairedDevices());
      setError(undefined);
    } catch (caught) {
      setError(describeError(caught));
    }
  }, []);

  useEffect(() => {
    void refresh();

    // Subscribe before the first render settles so a transition that happens immediately is not
    // missed. Both listeners are no-ops on platforms that broadcast nothing.
    const availabilitySub =
      wifiAware.addOnAvailabilityChangedListener(setAvailability);
    const pairedSub =
      wifiAware.addOnPairedDevicesChangedListener(setPairedDevices);

    return () => {
      availabilitySub.remove();
      pairedSub.remove();
    };
  }, [refresh]);

  return { capabilities, availability, pairedDevices, error, refresh };
}
