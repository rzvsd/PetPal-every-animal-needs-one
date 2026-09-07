// Run with NODE_PATH pointing at an installed Playwright runtime and the local app on :3000.
// Uses seeded local accounts only. Generated QA animals/conversations are retained for inspection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const config = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
assert.equal(new URL(config.REACT_APP_SUPABASE_URL).hostname, '127.0.0.1', 'local test database only');
const run = process.env.PETPAL_QA_RUN || `QA-${Date.now()}`;
const phase = process.env.PETPAL_QA_PHASE || 'all';
const chatOnly = phase === 'chat' || phase === 'lifecycle';
const batch = `${run}-${Date.now()}`;
let prefix = randomUUID().slice(0, 24);
const animalId = index => prefix + String(index).padStart(12, '0');
const accountIds = ['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004'];
const emails = ['adopter@petpal.local', 'luna.owner@petpal.local'];
const clients = emails.map(() => createClient(config.REACT_APP_SUPABASE_URL, config.REACT_APP_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }));
const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const output = path.resolve(__dirname, '../../output/playwright', run);
fs.mkdirSync(output, { recursive: true });

async function main() {
  for (let i = 0; i < 2; i++) unwrap(await clients[i].auth.signInWithPassword({ email: emails[i], password: 'petpal-demo-password' }));
  const fixture = index => ({ id: animalId(index), owner_id: accountIds[index ? 1 : 0],
    name: `${run}-${String(index).padStart(3, '0')}`, species: 'DOG', breed_or_mix: 'Golden Retriever',
    approximate_age_months: 24, sex: index ? 'FEMALE' : 'MALE', size_label: 'LARGE',
    vaccine_status: 'UP_TO_DATE', sterilized_status: 'NO', temperament_tags: ['calm', 'social'],
    city: run, coarse_area: 'Test area', active_match_modes: ['PLAY', 'SOCIAL'],
    photo_urls: ['https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&h=800&fit=crop'] });
  if (process.env.PETPAL_QA_RUN) {
    prefix = unwrap(await clients[0].from('owner_animal_profiles').select('id').eq('name', `${run}-000`).single()).id.slice(0, 24);
  } else {
    unwrap(await clients[0].from('owner_animal_profiles').insert(fixture(0)));
    unwrap(await clients[1].from('owner_animal_profiles').insert(Array.from({ length: 500 }, (_, index) => fixture(index + 1))));
  }
  let cursor = null; const found = new Set(); let pages = 0;
  do {
    const rows = unwrap(await clients[0].rpc('discover_match_candidates', { my_animal_id_input: animalId(0),
      mode_input: 'PLAY', filters_input: { area: run }, after_id_input: cursor }));
    assert(rows.length <= 20);
    rows.forEach(row => { assert(!found.has(row.animal_id)); found.add(row.animal_id); });
    pages++;
    if (rows.length < 20) break;
    cursor = rows.at(-1).animal_id;
  } while (pages < 30);
  assert.equal(found.size, 500);
  console.log(`${run}: 500 candidates in bounded pages; fixtures retained for inspection.`);

  const raceAnimals = [0, 1].map(index => ({ ...fixture(index), id: randomUUID(), city: `${run}-race`, name: `${run}-race-${index}` }));
  await Promise.all(clients.map(async (client, index) => unwrap(await client.from('owner_animal_profiles').insert(raceAnimals[index]))));
  const raceLike = index => clients[index].rpc('like_match_candidate', { my_animal_id_input: raceAnimals[index].id,
    target_animal_id_input: raceAnimals[1 - index].id, mode_input: 'PLAY' }).then(unwrap);
  const initialLikes = await Promise.all([raceLike(0), raceLike(1)]);
  assert(initialLikes.some(result => result[0].matched), 'concurrent reciprocal likes produce a match');
  const repeatedLikes = await Promise.all(Array.from({ length: 20 }, (_, index) => raceLike(index % 2)));
  const conversationIds = new Set(repeatedLikes.map(result => result[0].conversation_id));
  assert.equal(conversationIds.size, 1, 'concurrent likes reuse one conversation');
  const raceConversation = [...conversationIds][0]; const requestId = randomUUID();
  const sent = await Promise.all(Array.from({ length: 20 }, () => clients[0].rpc('send_conversation_message', {
    conversation_id_input: raceConversation, body_input: `${run} concurrent retry`, client_message_id_input: requestId }).then(unwrap)));
  assert.equal(new Set(sent).size, 1, 'concurrent retries return one canonical message');
  const raceMessages = unwrap(await clients[0].from('conversation_messages_view').select('message_id').eq('conversation_id', raceConversation));
  assert.equal(raceMessages.length, 1);
  const notifications = unwrap(await clients[1].from('notification_events').select('id')
    .eq('event_type', 'MESSAGE_RECEIVED').eq('payload->>messageId', sent[0]));
  assert.equal(notifications.length, 1, 'concurrent retries create one notification event');
  fs.writeFileSync(path.join(output, `concurrency-${Date.now()}.json`), JSON.stringify({ raceConversation,
    simultaneousLikes: 20, simultaneousRetries: 20, messages: raceMessages.length, notifications: notifications.length }, null, 2));
  console.log('Concurrent reciprocal likes, 20 repeat likes and 20 retries: one conversation, message and notification.');
  if (phase === 'rpc') return;

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let views = [];
  try {
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 412, height: 915 } })));
    views = await Promise.all(contexts.map(context => context.newPage()));
    for (const page of views) page.setDefaultTimeout(15000);
    const enter = async (page, index, login = false) => {
      await page.goto(process.env.PETPAL_QA_APP_URL || 'http://localhost:3000');
      if (login) {
        await page.getByRole('textbox', { name: 'Email', exact: true }).fill(emails[index]);
        await page.getByRole('textbox', { name: 'Password', exact: true }).fill('petpal-demo-password');
        await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
      }
      await page.getByTestId('choose-match-environment').click();
      await page.getByTestId('animal-selector').click();
      await page.getByTestId(`animal-option-${run.toLowerCase()}-${index ? '001' : '000'}`).click();
      await page.getByTestId('matches-more-filters').click();
      await page.getByRole('textbox', { name: 'Area', exact: true }).fill(run);
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      await page.getByTestId('match-card').waitFor();
    };
    await Promise.all(views.map((page, index) => enter(page, index, true)));
    const [a, b] = views;
    assert.equal(await a.getByTestId('data-source-banner').innerText(), 'Live test data');
    assert(!/%/.test(await a.getByTestId('match-card').innerText()));
    const action = await a.getByTestId('match-like-btn').boundingBox();
    const nav = await a.getByTestId('bottom-tabs').boundingBox();
    assert(action.y + action.height < nav.y, 'primary action visible without scrolling');
    await a.screenshot({ path: path.join(output, 'discover.png') });

    if (!chatOnly) {
    await a.getByTestId('matches-more-filters').click();
    await a.getByRole('textbox', { name: 'Area', exact: true }).fill('uncommitted');
    assert.equal(await a.getByRole('textbox', { name: 'Area', exact: true }).evaluate(el => document.activeElement === el), true);
    await a.keyboard.press('Escape');
    await a.getByTestId('matches-more-filters').click();
    assert.equal(await a.getByRole('textbox', { name: 'Area', exact: true }).inputValue(), run);
    await a.goBack();
    assert.equal(await a.getByRole('dialog').count(), 0, 'Back dismisses sheet before leaving Discover');
    const originalCard = await a.getByTestId('match-card').innerText();
    await a.route('**/rpc/like_match_candidate', route => route.fulfill({ status: 503, body: '{}' }));
    await a.getByTestId('match-like-btn').click();
    await a.getByRole('alert').waitFor();
    assert((await a.getByTestId('match-card').innerText()).includes(fixture(1).name));
    await a.unroute('**/rpc/like_match_candidate');
    await a.getByTestId('match-save-btn').click();
    await a.waitForFunction(() => document.querySelector('[data-testid=match-save-btn]')?.getAttribute('aria-pressed') === 'true');
    await enter(a, 0);
    await a.getByTestId('discover-saved').click();
    await a.getByTestId('match-card').waitFor();
    assert((await a.getByTestId('match-card').innerText()).includes(fixture(1).name), 'saved animal survives reload');
    await a.getByTestId('match-pass-btn').click();
    await a.getByTestId('match-card').waitFor({ state: 'detached' });
    await enter(a, 0);
    assert.equal(await a.getByTestId('match-card').innerText(), originalCard, 'session-only skip resets on restart');

    await a.getByTestId('match-like-btn').click();
    await b.getByTestId('match-like-btn').click();
    await b.getByRole('button', { name: 'Open messages', exact: true }).click();
    }
    const match = unwrap(await clients[0].rpc('like_match_candidate', {
      my_animal_id_input: animalId(0), target_animal_id_input: animalId(1), mode_input: 'PLAY' }))[0];
    const conversationId = match.conversation_id;
    if (chatOnly) {
      await b.getByTestId('tab-messages').click();
      await b.getByTestId(`conversation-card-${conversationId}`).click();
    }
    await a.getByTestId('tab-messages').click();
    await a.getByTestId(`conversation-card-${conversationId}`).click();
    await Promise.all(views.map(page => page.getByTestId('conversation-thread').waitFor()));
    await Promise.all(views.map(page => page.getByText('Reconnecting…', { exact: true }).waitFor({ state: 'hidden', timeout: 20000 })));
    if (phase === 'lifecycle') {
      await a.waitForFunction(() => document.querySelectorAll('[data-testid=message-bubble]').length >= 50);
      await a.getByTestId('message-scroll').evaluate(el => { el.scrollTop = 0; });
      await a.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const body = `${batch} while reading history`;
      unwrap(await clients[1].rpc('send_conversation_message', { conversation_id_input: conversationId,
        body_input: body, client_message_id_input: randomUUID() }));
      await a.getByText(body, { exact: true }).waitFor();
      assert.equal(await a.getByTestId('message-scroll').evaluate(el => el.scrollTop), 0, 'incoming message does not move history reader');
      const unread = unwrap(await clients[0].from('conversation_inbox_view').select('unread_count').eq('conversation_id', conversationId).single());
      assert(unread.unread_count > 0, 'unseen incoming message stays unread');
      await a.getByRole('button', { name: 'New messages', exact: true }).click();
      await a.getByTestId('safety-menu-trigger').click();
      await a.goBack();
      assert.equal(await a.getByRole('dialog').count(), 0);
      await a.goBack();
      await a.getByTestId('messages-tab').waitFor();
      await a.goBack();
      await a.getByTestId('matches-tab').waitFor();
      await a.getByTestId('tab-profile').click();
      await a.getByTestId('language-toggle').click();
      await a.getByTestId('tab-matches').click();
      assert.equal(await a.getByTestId('discover-browse').innerText(), 'Explorează');
      await a.setViewportSize({ width: 360, height: 640 });
      await a.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
      await a.getByTestId('matches-more-filters').click();
      const sheet = await a.getByRole('dialog').boundingBox();
      assert(sheet.y >= 0 && sheet.y + sheet.height <= 640);
      assert(await a.getByRole('button', { name: 'Aplica filtrele', exact: true }).isVisible());
      await a.screenshot({ path: path.join(output, 'romanian-large-text-filters.png') });
      await a.goBack();
      await a.getByTestId('tab-messages').click();
      await a.getByTestId(`conversation-card-${conversationId}`).click();
      await a.getByTestId('message-input').fill('x'.repeat(4001));
      assert(await a.getByTestId('send-message-btn').isDisabled());
      await a.getByTestId('message-input').fill('');
      await a.setViewportSize({ width: 360, height: 430 });
      await a.waitForFunction(() => document.documentElement.style.getPropertyValue('--app-height') === '430px');
      const composer = await a.getByTestId('message-input').boundingBox();
      assert(composer.y + composer.height <= 430, `composer stays visible in reduced viewport: ${JSON.stringify(composer)}`);
      assert.equal(await a.getByTestId('bottom-tabs').isVisible(), false);
      await a.screenshot({ path: path.join(output, 'romanian-reduced-viewport-chat.png') });
      const existingBlock = unwrap(await clients[0].from('blocks').select('blocked_id').eq('blocked_id', accountIds[1]));
      assert.equal(existingBlock.length, 0, 'never alter a pre-existing block');
      const createdBlock = unwrap(await clients[0].from('blocks').insert({ blocker_id: accountIds[0], blocked_id: accountIds[1] })
        .select('blocker_id,blocked_id,created_at').single());
      try {
        await b.waitForFunction(() => document.querySelector('[data-testid=message-input]')?.disabled);
        assert.equal(await b.getByTestId('message-bubble').count(), 0, 'block event clears cached messages for other participant');
        assert.equal(unwrap(await clients[1].from('conversation_messages_view').select('message_id').eq('conversation_id', conversationId)).length, 0);
      } finally {
        // Restore only the exact block created above by this check.
        unwrap(await clients[0].from('blocks').delete().eq('blocker_id', createdBlock.blocker_id)
          .eq('blocked_id', createdBlock.blocked_id).eq('created_at', createdBlock.created_at));
      }
      await b.waitForFunction(() => document.querySelector('[data-testid=message-input]')?.disabled === false);
      await a.setViewportSize({ width: 412, height: 915 });
      await a.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await a.goBack();
      await a.getByTestId('tab-profile').click();
      await a.getByTestId('language-toggle').click();
      await a.getByTestId('profile-section-sign-out').click();
      await a.getByTestId('auth-screen').waitFor();
      assert.equal(await a.evaluate(id => localStorage.getItem(`petpal-chat:${id}`), accountIds[0]), null);
      fs.writeFileSync(path.join(output, 'lifecycle.json'), JSON.stringify({ conversationId, historyPreserved: true,
        unreadWhileReading: true, backHierarchy: true, romanianLargeText: true, blocking: true, signOutClearsStorage: true }, null, 2));
      console.log('PASS: history/unread, Back hierarchy, Romanian large text, 4,000-character guard, block invalidation and sign-out cleanup.');
      return;
    }
    const times = [];
    for (let index = 0; index < 100; index++) {
      const sender = views[index % 2]; const receiver = views[1 - index % 2];
      const body = `${batch} message ${String(index).padStart(3, '0')}`;
      await sender.getByTestId('message-input').fill(body);
      const start = Date.now();
      await sender.getByTestId('send-message-btn').click();
      await receiver.getByText(body, { exact: true }).waitFor({ timeout: 10000 });
      times.push(Date.now() - start);
      assert.equal(await receiver.getByText(body, { exact: true }).count(), 1);
      if ((index + 1) % 20 === 0) console.log(`${index + 1}/100 two-way messages received`);
    }
    const persisted = unwrap(await clients[0].from('conversation_messages_view').select('message_id,body')
      .eq('conversation_id', conversationId).like('body', `${batch} message %`));
    assert.equal(persisted.length, 100); assert.equal(new Set(persisted.map(row => row.body)).size, 100);
    console.log(`100 messages persisted once. Maximum foreground browser receipt: ${Math.max(...times)} ms.`);
    if (chatOnly) {
      fs.writeFileSync(path.join(output, `latency-${Date.now()}.json`), JSON.stringify({ batch, conversationId,
        messages: 100, maxReceiptMs: Math.max(...times), underTwoSeconds: times.every(ms => ms <= 2000) }, null, 2));
      assert(times.every(ms => ms <= 2000), 'all healthy browser receipts must be within two seconds');
      return;
    }
    await a.screenshot({ path: path.join(output, 'chat.png') });

    await contexts[0].setOffline(true);
    const offlineText = `${run} recoverable offline text`;
    await a.getByTestId('message-input').fill(offlineText);
    await a.getByTestId('send-message-btn').click();
    await a.getByTestId('retry-message').waitFor({ timeout: 20000 });
    await contexts[0].setOffline(false);
    await a.reload();
    await a.getByTestId('choose-match-environment').click();
    await a.getByTestId('tab-messages').click();
    await a.getByTestId(`conversation-card-${conversationId}`).click();
    await a.getByTestId('retry-message').waitFor();
    await a.getByTestId('retry-message').click();
    await b.getByText(offlineText, { exact: true }).waitFor();
    assert.equal(await b.getByText(offlineText, { exact: true }).count(), 1);
    console.log('Offline failed message survived restart; explicit retry persisted once.');

    await a.getByTestId('message-input').fill(`${run} draft`);
    await a.reload();
    await a.getByTestId('choose-match-environment').click();
    await a.getByTestId('tab-messages').click();
    await a.getByTestId(`conversation-card-${conversationId}`).click();
    assert.equal(await a.getByTestId('message-input').inputValue(), `${run} draft`);
    for (let index = 101; index < 1000; index++) {
      unwrap(await clients[index % 2].rpc('send_conversation_message', { conversation_id_input: conversationId,
        body_input: `${run} history ${index}`, client_message_id_input: randomUUID() }));
    }
    await a.reload();
    await a.getByTestId('choose-match-environment').click();
    await a.getByTestId('tab-messages').click();
    await a.getByTestId(`conversation-card-${conversationId}`).click();
    await a.waitForFunction(() => document.querySelectorAll('[data-testid=message-bubble]').length === 50);
    await a.getByTestId('message-scroll').evaluate(el => { el.scrollTop = 0; });
    await a.getByRole('button', { name: 'Load earlier messages', exact: true }).click();
    await a.waitForFunction(() => document.querySelectorAll('[data-testid=message-bubble]').length === 100);
    const anchor = await a.getByTestId('message-scroll').evaluate(el => el.scrollTop);
    assert(anchor > 0, 'loading older history preserves the visible anchor');
    console.log('1,000-message thread opens with 50 messages; older page and scroll anchor verified.');
    await a.setViewportSize({ width: 360, height: 640 });
    await a.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
    const composer = await a.getByTestId('message-input').boundingBox();
    assert(composer.y + composer.height <= 640, 'large-text composer remains in viewport');
    await a.screenshot({ path: path.join(output, 'chat-small-large-text.png') });
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ run, conversationId, candidates: found.size,
      messages: 1000, maxReceiptMs: Math.max(...times), underTwoSeconds: times.every(ms => ms <= 2000) }, null, 2));
    assert(times.every(ms => ms <= 2000), 'all healthy browser receipts must be within two seconds');
    console.log(`PASS. Evidence: ${output}`);
  } catch (error) {
    await Promise.all(views.map((page, index) => page.screenshot({ path: path.join(output, `failure-${phase}-${index}.png`) }).catch(() => {})));
    throw error;
  } finally { await browser.close(); clients.forEach(client => client.removeAllChannels()); }
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
