import { wifiAware } from '../wifiAware';

describe('wifiAware without a native build', () => {
  it('throws a tagged, actionable error on any access', () => {
    expect(() => wifiAware.getCapabilities()).toThrow(
      /\[wifi-aware:unsupported\]/
    );
  });

  it('names Expo Go and the Simulator, which are the usual causes', () => {
    expect(() => wifiAware.publish).toThrow(/Expo Go/);
    expect(() => wifiAware.publish).toThrow(/Simulator/);
  });

  it('fails loudly rather than silently no-oping', () => {
    // A silent no-op here would look like "discovery found nothing" instead of "no native build".
    expect(() => wifiAware.subscribe).toThrow();
  });
});
