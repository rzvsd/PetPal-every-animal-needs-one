// Stress run over the seeded accounts: all 40 sign in at once, browse, every
// foster applies to 3 animals at the same moment, every owner accepts one
// application at the same moment, and both sides of each accepted chat send
// messages concurrently. Prints timings (p50/p95) and errors per phase and
// writes load-report.local.json. Usage: node load.mjs [--messages 10]
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config, readCredentials, signIn, call, DIR } from './common.mjs';

const i = process.argv.indexOf('--messages');
const MESSAGES = i > 0 ? Number(process.argv[i + 1]) : 10;
const cfg = config();
const creds = readCredentials();
if (creds.url !== cfg.url) throw new Error(`Logins were made for ${creds.url}, not ${cfg.url}.`);
const fosters = creds.accounts.filter(a => a.kind === 'foster');
const users = creds.accounts.filter(a => a.kind === 'user');
const report = [];

async function phase(name, tasks) {
  const times = [], errors = {};
  const t0 = Date.now();
  const results = await Promise.all(tasks.map(async t => {
    const s = Date.now();
    try { const r = await t(); times.push(Date.now() - s); return r; }
    catch (e) { const m = e.message || String(e); errors[m] = (errors[m] || 0) + 1; return undefined; }
  }));
  times.sort((a, b) => a - b);
  const pct = p => times.length ? times[Math.min(times.length - 1, Math.floor(p * times.length))] : null;
  const row = { phase: name, calls: tasks.length, ok: times.length, failed: tasks.length - times.length,
    p50_ms: pct(0.5), p95_ms: pct(0.95), max_ms: times.at(-1) ?? null, wall_ms: Date.now() - t0, errors };
  // The 30-messages-a-minute anti-spam limit is a feature, count it apart from real failures.
  row.rate_limited = Object.entries(errors).filter(([m]) => /too quickly/.test(m)).reduce((n, [, c]) => n + c, 0);
  report.push(row);
  console.log(`${name}: ${row.ok}/${row.calls} ok, p50 ${row.p50_ms} ms, p95 ${row.p95_ms} ms, wall ${row.wall_ms} ms`
    + (row.failed ? `\n   errors: ${JSON.stringify(errors)}` : ''));
  return results;
}

await phase('40 sign-ins at once', creds.accounts.map(a => () => signIn(cfg, a)));
await phase('20 fosters load the animal list', fosters.map(f => () =>
  call(f.c.from('foster_cases_directory').select('*').eq('status', 'ACTIVE').range(0, 49))));
await phase('20 users load the foster-home list', users.map(u => () =>
  call(u.c.from('foster_homes_directory').select('*').range(0, 49))));

// Every animal gets 3 applications from fosters who take its species, spread round-robin.
const applications = users.flatMap((u, k) => {
  const fits = fosters.filter(f => f.species.some(sp => u.species.includes(sp)));
  return [0, 1, 2].map(t => ({ u, f: fits[(k * 3 + t) % fits.length] }));
});
await phase(`${applications.length} applications at once`, applications.map(({ f, u }) => () =>
  call(f.c.rpc('create_foster_request', { request_id_input: randomUUID(), case_id_input: u.caseId,
    home_id_input: f.homeId, kind_input: 'APPLICATION', message_input: 'TEST application from the stress run' }))));

const pending = await phase('20 owners load their requests', users.map(u => () =>
  call(u.c.from('foster_requests_view').select('id,updated_at,conversation_id,sender_id,status').eq('case_id', u.caseId).eq('status', 'PENDING'))));

// Owners pick different fosters where they can, as a real pilot would spread animals out.
const taken = new Set();
const choice = users.map((u, k) => {
  const r = (pending[k] || []).find(x => !taken.has(x.sender_id)) || pending[k]?.[0];
  if (r) taken.add(r.sender_id);
  return r;
});
const accepted = await phase('20 owners accept one application at once', users.map((u, k) => async () => {
  const r = choice[k];
  if (!r) throw new Error('no pending application');
  await call(u.c.rpc('respond_foster_request', { request_id_input: r.id, action_input: 'ACCEPT',
    expected_updated_at_input: r.updated_at }));
  return { u, conv: r.conversation_id, f: fosters.find(f => f.id === r.sender_id) };
}));

const chats = accepted.filter(x => x?.conv && x.f);
// Like real phones: every person sends their messages one after another, all 40 people at once.
await phase(`${chats.length} chats, ${MESSAGES} messages per side, both sides at once`, chats.flatMap(({ u, f, conv }) =>
  [u, f].map(p => async () => {
    for (let n = 0; n < MESSAGES; n++) {
      await call(p.c.rpc('send_conversation_message', { conversation_id_input: conv, body_input: `TEST message ${n + 1}`,
        client_message_id_input: randomUUID() }));
    }
  })));

await phase('40 inbox loads at once', creds.accounts.map(a => () => call(a.c.from('conversation_inbox_view').select('*'))));

const out = path.join(DIR, 'load-report.local.json');
fs.writeFileSync(out, JSON.stringify({ url: cfg.url, at: new Date().toISOString(), report }, null, 2));
console.log(`Report: ${out}`);
