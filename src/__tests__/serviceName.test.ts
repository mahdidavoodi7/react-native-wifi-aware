import { assertValidServiceName, validateServiceName } from '../serviceName';

describe('validateServiceName', () => {
  it.each([
    '_chat._tcp',
    '_photo-sync._udp',
    '_a._tcp',
    '_sync2._tcp',
    '_ABC._udp',
  ])('accepts %s', (name) => {
    expect(validateServiceName(name)).toEqual({ isValid: true });
  });

  it.each([
    ['_chat', 'format', 'missing the transport suffix'],
    ['chat._tcp', 'format', 'missing the leading underscore'],
    ['_chat._sctp', 'format', 'an unsupported transport'],
    ['_chat._tcp.local', 'format', 'a trailing domain'],
    ['__tcp', 'format', 'no separator at all'],
  ])('rejects %s as a format error (%s: %s)', (name, rule) => {
    const result = validateServiceName(name);
    expect(result.isValid).toBe(false);
    expect(result.isValid === false && result.rule).toBe(rule);
  });

  it('rejects a name component longer than 15 characters', () => {
    const result = validateServiceName('_abcdefghijklmnop._tcp');
    expect(result.isValid === false && result.rule).toBe('label-length');
  });

  it('accepts a name component of exactly 15 characters', () => {
    expect(validateServiceName('_abcdefghijklmno._tcp')).toEqual({
      isValid: true,
    });
  });

  it('rejects an empty name component', () => {
    const result = validateServiceName('_._tcp');
    expect(result.isValid === false && result.rule).toBe('label-length');
  });

  it('rejects characters outside the allowed set', () => {
    const result = validateServiceName('_ch_at._tcp');
    expect(result.isValid === false && result.rule).toBe('label-characters');
  });

  it('rejects a name component with no letter', () => {
    const result = validateServiceName('_123._tcp');
    expect(result.isValid === false && result.rule).toBe(
      'label-letter-required'
    );
  });

  it.each(['_-chat._tcp', '_chat-._tcp'])(
    'rejects hyphen at an edge: %s',
    (name) => {
      const result = validateServiceName(name);
      expect(result.isValid === false && result.rule).toBe(
        'label-hyphen-position'
      );
    }
  );

  it('allows hyphens inside the name component', () => {
    expect(validateServiceName('_a-b-c._tcp')).toEqual({ isValid: true });
  });

  it('reports the offending name in the message so the fix is obvious', () => {
    const result = validateServiceName('_-chat._tcp');
    expect(result.isValid).toBe(false);
    expect(result.isValid === false && result.message).toContain('_-chat._tcp');
    expect(result.isValid === false && result.message).toContain('hyphen');
  });
});

describe('assertValidServiceName', () => {
  it('returns quietly for a valid name', () => {
    expect(() => assertValidServiceName('_chat._tcp')).not.toThrow();
  });

  it('throws naming the broken rule', () => {
    expect(() => assertValidServiceName('_123._tcp')).toThrow(
      /no letter in it/
    );
  });
});
