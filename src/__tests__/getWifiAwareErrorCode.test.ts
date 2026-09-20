import { getWifiAwareErrorCode } from '../getWifiAwareErrorCode';

describe('getWifiAwareErrorCode', () => {
  it('reads the code out of a tagged error', () => {
    const error = new Error(
      '[wifi-aware:connection-failed] The data path could not be established.'
    );
    expect(getWifiAwareErrorCode(error)).toBe('connection-failed');
  });

  it.each([
    'unsupported',
    'no-paired-devices',
    'service-already-publishing',
    'programmatic-pairing-unsupported',
  ])('reads %s', (code) => {
    expect(
      getWifiAwareErrorCode(new Error(`[wifi-aware:${code}] detail`))
    ).toBe(code);
  });

  it('returns undefined for an untagged error', () => {
    expect(
      getWifiAwareErrorCode(new Error('something else went wrong'))
    ).toBeUndefined();
  });

  it('only matches the tag at the start, so message text cannot spoof a code', () => {
    const error = new Error(
      'failed because [wifi-aware:unsupported] was reported earlier'
    );
    expect(getWifiAwareErrorCode(error)).toBeUndefined();
  });

  it.each([undefined, null, 'a string', 42, {}, []])(
    'returns undefined for non-Error value %p',
    (value) => {
      expect(getWifiAwareErrorCode(value)).toBeUndefined();
    }
  );
});
