import { readChatStorage, writeChatStorage, clearChatStorage, mergeMessages, reconcileOutbox } from './messageStorage';

beforeEach(() => localStorage.clear());

test('uncertain sends and drafts survive restart and stay isolated by account', () => {
  const outbox = [{ clientMessageId: 'request-1', body: 'hello', status: 'sending' }];
  writeChatStorage('alice', { outbox, drafts: { chat: 'unfinished' } });
  expect(readChatStorage('alice')).toEqual({ outbox: [{ ...outbox[0], status: 'failed' }], drafts: { chat: 'unfinished' } });
  expect(readChatStorage('bob')).toEqual({ outbox: [], drafts: {} });
  clearChatStorage('alice');
  expect(readChatStorage('alice').outbox).toEqual([]);
});

test('server reconciliation removes only accepted requests from this sender', () => {
  const outbox = [{ clientMessageId: 'a' }, { clientMessageId: 'b' }];
  expect(reconcileOutbox(outbox, [{ clientMessageId: 'a', isMine: false }])).toEqual(outbox);
  expect(reconcileOutbox(outbox, [{ clientMessageId: 'a', isMine: true }])).toEqual([{ clientMessageId: 'b' }]);
});

test('overlapping pages and realtime events produce one ordered copy of each message', () => {
  const first = { messageId: 'a', sequence: 1, body: 'first' };
  const second = { messageId: 'b', sequence: 2, body: 'second' };
  expect(mergeMessages([second], [first, second])).toEqual([first, second]);
});

test('corrupt storage fails explicitly rather than overwriting unsent text', () => {
  localStorage.setItem('petpal-chat:alice', '{invalid');
  expect(() => readChatStorage('alice')).toThrow();
  expect(localStorage.getItem('petpal-chat:alice')).toBe('{invalid');
});
