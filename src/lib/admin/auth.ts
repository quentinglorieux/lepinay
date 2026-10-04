// Authentification de l'admin : mots de passe (scrypt), sessions signées
// (HMAC-SHA256) et limitation des tentatives de connexion.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type User = { email: string; name: string };
export type StoredUser = User & { hash: string };

export const SESSION_COOKIE = 'lca_session';
export const SESSION_MAX_AGE = 7 * 24 * 3600; // secondes

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------- mots de passe

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(':');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  if (expected.length !== 64) return false;
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), 64);
  return timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------- utilisateurs

// ADMIN_USERS : JSON [{ "email", "name", "hash" }]. Absent ou invalide : personne.
export function parseUsers(raw: string | undefined): StoredUser[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((u) => u && u.email && u.name && u.hash) : [];
  } catch {
    return [];
  }
}

export function findUser(email: string, users: StoredUser[]): StoredUser | undefined {
  const e = email.trim().toLowerCase();
  return users.find((u) => u.email.trim().toLowerCase() === e);
}

// ---------------------------------------------------------------- sessions

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function createSession(user: User, secret: string, now = Date.now()): string {
  if (secret.length < 32) throw new Error('ADMIN_SESSION_SECRET doit faire au moins 32 caractères');
  const payload = Buffer.from(
    JSON.stringify({ email: user.email, name: user.name, exp: now + SESSION_MAX_AGE * 1000 }),
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(token: string | undefined, secret: string, now = Date.now()): User | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.exp !== 'number' || data.exp < now) return null;
    return { email: data.email, name: data.name };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- tentatives de connexion

async function authStore() {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'admin-auth', consistency: 'strong' });
}

const failureKey = (email: string) => `fail:${email.trim().toLowerCase()}`;
type Failures = { count: number; since: number };

export async function isRateLimited(email: string, now = Date.now()): Promise<boolean> {
  const store = await authStore();
  const entry = (await store.get(failureKey(email), { type: 'json' })) as Failures | null;
  return !!entry && now - entry.since < FAILURE_WINDOW_MS && entry.count >= MAX_FAILURES;
}

export async function recordFailure(email: string, now = Date.now()): Promise<void> {
  const store = await authStore();
  const key = failureKey(email);
  const entry = (await store.get(key, { type: 'json' })) as Failures | null;
  const fresh = !entry || now - entry.since >= FAILURE_WINDOW_MS;
  await store.setJSON(key, fresh ? { count: 1, since: now } : { count: entry.count + 1, since: entry.since });
}

export async function clearFailures(email: string): Promise<void> {
  const store = await authStore();
  await store.delete(failureKey(email));
}
