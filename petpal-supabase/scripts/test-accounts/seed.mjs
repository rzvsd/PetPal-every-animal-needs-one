// Creates 20 test users (each posts one animal that needs a foster home) and
// 20 test foster homes. Usage: node seed.mjs [--users 20] [--fosters 20]
// Passwords are random per account and written only to test-accounts.local.json
// (git-ignored). They are never printed.
import fs from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { config, adminClient, userClient, call, pool, EMAIL_DOMAIN, CREDENTIALS_FILE } from './common.mjs';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : dflt; };
const USERS = arg('users', 20);
const FOSTERS = arg('fosters', 20);

const FIRST = ['Ana', 'Dan', 'Ioana', 'Mihai', 'Elena', 'Andrei', 'Maria', 'Paul', 'Irina', 'Bogdan', 'Simona', 'Florin',
  'Laura', 'Sorin', 'Teodora', 'Victor', 'Raluca', 'Cristina', 'Alexandru', 'Gabriela', 'Radu', 'Oana', 'Vlad', 'Diana'];
const AREAS = ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 6', 'Pipera', 'Militari', 'Berceni',
  'Titan', 'Voluntari', 'Otopeni', 'Chiajna', 'Bragadiru'];
const DOGS = ['Rex', 'Max', 'Luna', 'Bella', 'Rocky', 'Toby', 'Bruno', 'Lola', 'Zara', 'Bobi'];
const CATS = ['Mitzi', 'Tom', 'Kira', 'Pufi', 'Leo', 'Nala', 'Simba', 'Cleo', 'Oscar', 'Mia'];
const HOUSING = ['Apartment', 'Apartment, ground floor', 'House', 'House with fenced yard', 'Studio'];
const pad = n => String(n).padStart(2, '0');

const cfg = config();
const admin = adminClient(cfg);

// Refuse to run twice: the credentials file would no longer match the database.
const existing = (await call(admin.auth.admin.listUsers({ page: 1, perPage: 1000 }))).users
  .filter(u => u.email?.endsWith(`@${EMAIL_DOMAIN}`) && u.email.startsWith('pp-test-'));
if (existing.length) {
  console.error(`${existing.length} test accounts already exist on ${cfg.url}. Run cleanup first.`);
  process.exit(1);
}

const accounts = [
  ...Array.from({ length: FOSTERS }, (_, i) => ({ kind: 'foster', n: i + 1, email: `pp-test-f${pad(i + 1)}@${EMAIL_DOMAIN}` })),
  ...Array.from({ length: USERS }, (_, i) => ({ kind: 'user', n: i + 1, email: `pp-test-u${pad(i + 1)}@${EMAIL_DOMAIN}` })),
];
accounts.forEach((a, i) => {
  a.name = `TEST ${FIRST[i % FIRST.length]} ${a.kind === 'foster' ? 'F' : 'U'}${pad(a.n)}`;
  a.area = AREAS[i % AREAS.length];
  a.password = randomBytes(18).toString('base64url');
});

const failures = [];
const t0 = Date.now();
await pool(accounts, 5, async a => {
  try {
    const created = await call(admin.auth.admin.createUser({
      email: a.email, password: a.password, email_confirm: true,
      user_metadata: { display_name: a.name, petpal_test_account: true },
    }));
    a.id = created.user.id;
    const c = userClient(cfg);
    await call(c.auth.signInWithPassword({ email: a.email, password: a.password }));
    await call(c.rpc('complete_profile_onboarding', {
      display_name_input: a.name, city_input: 'Bucharest', coarse_area_input: a.area,
      roles_input: [a.kind === 'foster' ? 'FOSTER' : 'ADOPTER'], age_confirmed_input: true, terms_accepted_input: true,
    }));
    if (a.kind === 'foster') {
      const species = a.species = a.n % 3 === 0 ? ['CAT'] : a.n % 3 === 1 ? ['DOG', 'CAT'] : ['DOG'];
      a.homeId = await call(c.rpc('save_foster_home', { home_id_input: randomUUID(), data_input: {
        name: `[TEST] ${a.name.split(' ')[1]}'s foster home`, city: 'Bucharest', area: a.area, published: true,
        capacity: 1 + (a.n % 3), dogCapacity: species.includes('DOG') ? 2 : 0, catCapacity: species.includes('CAT') ? 2 : 0,
        availability: a.n % 5 === 0 ? 'LIMITED' : 'AVAILABLE', species, housingType: HOUSING[a.n % HOUSING.length],
        bio: 'TEST ACCOUNT for stress testing. Not a real foster home.',
      } }));
    } else {
      const dog = a.n % 2 === 1;
      a.species = [dog ? 'DOG' : 'CAT'];
      const pet = (dog ? DOGS : CATS)[a.n % 10];
      a.caseId = await call(c.rpc('save_foster_case', { case_id_input: randomUUID(), animal_id_input: null, data_input: {
        name: `[TEST] ${pet}`, species: dog ? 'DOG' : 'CAT', city: 'Bucharest', area: a.area,
        urgency: a.n % 4 === 0 ? 'HIGH' : 'MEDIUM', status: 'ACTIVE',
        description: 'TEST ANIMAL for stress testing. Not a real animal.',
      } }));
    }
    await c.auth.signOut();
  } catch (e) {
    failures.push({ email: a.email, error: e.message || String(e) });
  }
});

const ok = accounts.filter(a => a.id && (a.homeId || a.caseId));
fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify({ url: cfg.url, createdAt: new Date().toISOString(),
  accounts: accounts.filter(a => a.id).map(({ kind, n, email, name, password, id, homeId, caseId, species }) => ({ kind, n, email, name, password, id, homeId, caseId, species })) }, null, 2), { mode: 0o600 });
console.log(`Seeded ${ok.filter(a => a.kind === 'foster').length} fosters (with homes) and ${ok.filter(a => a.kind === 'user').length} users (with one animal each) on ${cfg.url} in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
console.log(`Logins saved to ${CREDENTIALS_FILE} (git-ignored).`);
if (failures.length) { console.error('Failures:', failures); process.exit(1); }
