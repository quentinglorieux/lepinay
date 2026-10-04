import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createSession,
  readSession,
  findUser,
  parseUsers,
} from '../../src/lib/admin/auth';

const S = 'secret-de-test-32-octets-minimum!!';

describe('mots de passe', () => {
  it('vérifie le bon', () => expect(verifyPassword('abc', hashPassword('abc'))).toBe(true));
  it('refuse le mauvais', () => expect(verifyPassword('abd', hashPassword('abc'))).toBe(false));
  it('refuse un hash malformé', () => {
    expect(verifyPassword('abc', 'n-importe-quoi')).toBe(false);
    expect(verifyPassword('abc', 'scrypt$$')).toBe(false);
  });
  it('sel aléatoire', () => expect(hashPassword('abc')).not.toBe(hashPassword('abc')));
});

describe('utilisateurs', () => {
  const users = [{ email: 'g@x.fr', name: 'G', hash: 'h' }];
  it('email insensible à la casse et aux espaces', () => expect(findUser(' G@X.fr ', users)?.name).toBe('G'));
  it('inconnu', () => expect(findUser('z@x.fr', users)).toBeUndefined());
  it('parse ADMIN_USERS', () => expect(parseUsers(JSON.stringify(users))).toEqual(users));
  it('ADMIN_USERS absent ou invalide : aucun utilisateur', () => {
    expect(parseUsers(undefined)).toEqual([]);
    expect(parseUsers('pas du json')).toEqual([]);
  });
});

describe('sessions', () => {
  const u = { email: 'g@x.fr', name: 'G' };
  it('relit une session valide', () => expect(readSession(createSession(u, S), S)).toEqual(u));
  it('refuse une session expirée', () => {
    expect(readSession(createSession(u, S, 0), S, 8 * 864e5)).toBeNull();
  });
  it('refuse un autre secret', () => expect(readSession(createSession(u, S), S + 'x')).toBeNull());
  it('refuse une charge modifiée', () => {
    const [p, sig] = createSession(u, S).split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, email: 'pirate@x.fr' })).toString('base64url');
    expect(readSession(`${forged}.${sig}`, S)).toBeNull();
  });
  it('refuse vide ou malformé', () => {
    expect(readSession(undefined, S)).toBeNull();
    expect(readSession('', S)).toBeNull();
    expect(readSession('abc', S)).toBeNull();
    expect(readSession('a.b.c', S)).toBeNull();
  });
  it('refuse un secret trop court', () => expect(() => createSession(u, 'court')).toThrow());
});
