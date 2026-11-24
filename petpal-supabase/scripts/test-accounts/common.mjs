// Shared helpers for PetPal test accounts. Every test account is marked the
// same way so it can never be mistaken for a real pilot user:
//   email     pp-test-<f|u><NN>@petpal.test   (.test is a reserved TLD, no mail is ever sent)
//   name      "TEST <first name> <NN>"
//   metadata  user_metadata.petpal_test_account = true
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EMAIL_DOMAIN = 'petpal.test';
export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const CREDENTIALS_FILE = path.join(DIR, 'test-accounts.local.json');

export function config() {
  const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anonKey) throw new Error('Set SUPABASE_ANON_KEY (publishable/anon key).');
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
  if (!local && process.env.PETPAL_ALLOW_HOSTED !== 'yes') {
    throw new Error(`${url} is not a local stack. Set PETPAL_ALLOW_HOSTED=yes only if you really mean to touch that database.`);
  }
  return { url, anonKey, serviceKey, local };
}

export function userClient(cfg) {
  return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function adminClient(cfg) {
  if (!cfg.serviceKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY (secret/service_role key). Never commit it.');
  return createClient(cfg.url, cfg.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function call(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

export function readCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) throw new Error(`No ${path.basename(CREDENTIALS_FILE)}. Run seed.mjs first.`);
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
}

export async function signIn(cfg, account) {
  const c = userClient(cfg);
  const data = await call(c.auth.signInWithPassword({ email: account.email, password: account.password }));
  account.c = c;
  account.id = data.user.id;
  return account;
}

// Run fn over items with at most `limit` in flight.
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}
