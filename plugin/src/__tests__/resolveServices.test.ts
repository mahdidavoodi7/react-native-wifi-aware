import { resolveServices } from '../index';

describe('resolveServices', () => {
  it('defaults a bare string to both roles', () => {
    expect(resolveServices({ services: ['_chat._tcp'] })).toEqual([
      { name: '_chat._tcp', publishable: true, subscribable: true },
    ]);
  });

  it('honours an explicit single role', () => {
    expect(
      resolveServices({
        services: [{ name: '_chat._tcp', subscribable: false }],
      })
    ).toEqual([{ name: '_chat._tcp', publishable: true, subscribable: false }]);
  });

  it('fails the build on a malformed service name, naming the rule', () => {
    expect(() => resolveServices({ services: ['_-chat._tcp'] })).toThrow(
      /Rule violated: label-hyphen-position/
    );
  });

  it('explains why the name is validated at build time', () => {
    expect(() => resolveServices({ services: ['_chat'] })).toThrow(
      /crashes the app at launch/
    );
  });

  it('rejects a service with neither role, which iOS treats as fatal', () => {
    expect(() =>
      resolveServices({
        services: [
          { name: '_chat._tcp', publishable: false, subscribable: false },
        ],
      })
    ).toThrow(/neither publishable nor subscribable/);
  });

  it('rejects duplicate service names', () => {
    expect(() =>
      resolveServices({ services: ['_chat._tcp', '_chat._tcp'] })
    ).toThrow(/Duplicate service name/);
  });

  it.each([undefined, { services: [] }, {} as never])(
    'requires at least one service (%p)',
    (options) => {
      expect(() => resolveServices(options as never)).toThrow(
        /required and must list at least one/
      );
    }
  );

  it('rejects an entry that is neither a string nor a named object', () => {
    expect(() =>
      resolveServices({ services: [{ publishable: true } as never] })
    ).toThrow(/must be a service name or an object/);
  });
});
