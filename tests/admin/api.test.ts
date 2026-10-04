import { describe, it, expect } from 'vitest';
import { checkOrigin, safeNext } from '../../src/lib/admin/api';

const req = (origin?: string, method = 'POST') =>
  new Request('https://pierre-lepinay-architecture.com/api/admin/save', {
    method,
    headers: origin ? { origin } : {},
  });

describe('checkOrigin', () => {
  it('accepte la même origine', () => expect(checkOrigin(req('https://pierre-lepinay-architecture.com'))).toBe(true));
  it('refuse une autre origine', () => expect(checkOrigin(req('https://evil.example'))).toBe(false));
  it('refuse une écriture sans origine', () => expect(checkOrigin(req())).toBe(false));
  it('accepte une lecture sans origine', () => expect(checkOrigin(req(undefined, 'GET'))).toBe(true));
});

describe('safeNext', () => {
  it('garde un chemin admin', () => expect(safeNext('/admin/projets?x=1')).toBe('/admin/projets?x=1'));
  it('refuse un site externe', () => {
    expect(safeNext('https://evil.example')).toBe('/admin');
    expect(safeNext('//evil.example/admin')).toBe('/admin');
    expect(safeNext('/autre')).toBe('/admin');
    expect(safeNext(null)).toBe('/admin');
  });
});
