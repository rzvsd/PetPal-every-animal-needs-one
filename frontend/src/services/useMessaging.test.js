import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useMessaging } from './useMessaging';
import { supabase } from './supabaseClient';
import {
  loadConversations,
  loadConversationMessages,
  sendSupabaseConversationMessage,
  setSupabaseConversationTyping,
  loadSupabaseConversationTyping,
} from './supabaseApi';

jest.mock('./supabaseClient', () => ({ supabase: { rpc: jest.fn(), from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));
jest.mock('./supabaseApi', () => ({
  loadConversations: jest.fn(),
  loadConversationMessages: jest.fn(),
  sendSupabaseConversationMessage: jest.fn(),
  setSupabaseConversationTyping: jest.fn(),
  loadSupabaseConversationTyping: jest.fn(),
}));
jest.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
jest.mock('@capacitor/app', () => ({ App: { addListener: jest.fn() } }));

let root; let api; let rows; let host;
function Harness({ accountId = 'alice', showTypingActivity = true, conversationIds = ['chat'] }) {
  const [conversations, setConversations] = useState(conversationIds.map(id => ({ id, messages: [], lastReadSequence: 0 })));
  rows = conversations;
  api = useMessaging({ accountId, live: true, conversations, setConversations, showTypingActivity });
  return null;
}

beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); jest.clearAllMocks();
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'request-uuid' } });
  loadConversations.mockImplementation(async ({ id }) => id ? [{ id, lastReadSequence: 0 }] : []);
  loadConversationMessages.mockResolvedValue([]);
  setSupabaseConversationTyping.mockResolvedValue(true);
  loadSupabaseConversationTyping.mockResolvedValue({ isTyping: false, updatedAt: null });
  supabase.rpc.mockResolvedValue({ data: [], error: null });
  const channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() };
  supabase.channel.mockReturnValue(channel);
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({
    data: { message_seq: 7, created_at: '2026-09-07T12:00:00Z' }, error: null,
  }) };
  supabase.from.mockReturnValue(query);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

test('uncertain send keeps text and retries the same UUID into one canonical message', async () => {
  sendSupabaseConversationMessage.mockRejectedValueOnce(new Error('response lost after server acceptance'));
  await act(async () => api.sendMessage('chat', 'recover this'));
  expect(api.outbox).toMatchObject([{ body: 'recover this', status: 'failed', clientMessageId: 'request-uuid' }]);
  expect(JSON.parse(localStorage.getItem('petpal-chat:alice')).outbox[0].body).toBe('recover this');
  sendSupabaseConversationMessage.mockResolvedValueOnce('canonical-id');
  await act(async () => api.sendMessage('chat', 'recover this', api.outbox[0].clientMessageId));
  expect(sendSupabaseConversationMessage).toHaveBeenLastCalledWith('chat', 'recover this', 'request-uuid');
  expect(api.outbox).toEqual([]);
  expect(rows[0].messages).toMatchObject([{ messageId: 'canonical-id', body: 'recover this', status: 'sent', sequence: 7 }]);
});

test('an accepted response completing after account switch cannot enter the new account', async () => {
  let resolveCanonical;
  sendSupabaseConversationMessage.mockResolvedValue('accepted');
  supabase.from().single.mockReturnValue(new Promise(resolve => { resolveCanonical = resolve; }));
  await act(async () => api.sendMessage('chat', 'private alice text'));
  await act(async () => root.render(<Harness accountId="bob" />));
  await act(async () => resolveCanonical({ data: { message_seq: 1, created_at: new Date().toISOString() } }));
  expect(api.outbox).toEqual([]);
  expect(rows[0].messages).toEqual([]);
  expect(localStorage.getItem('petpal-chat:bob')).toBeNull();
});

test('draft persistence failure stops sending before any server request', async () => {
  const failStorage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  try {
    await expect(api.sendMessage('chat', 'do not lose me')).rejects.toThrow('readiness.storageFailed');
    expect(sendSupabaseConversationMessage).not.toHaveBeenCalled();
  } finally { failStorage.mockRestore(); }
});

test('a later outgoing acceptance does not skip an earlier incoming message during reconciliation', async () => {
  loadConversationMessages.mockResolvedValueOnce([{ messageId: 'first', sequence: 5, body: 'first' }]);
  await act(async () => api.loadThread('chat'));
  sendSupabaseConversationMessage.mockResolvedValueOnce('outgoing');
  await act(async () => api.sendMessage('chat', 'later outgoing'));
  loadConversationMessages.mockResolvedValueOnce([{ messageId: 'incoming', sequence: 6, body: 'earlier incoming' }]);
  await act(async () => api.loadThread('chat'));
  expect(loadConversationMessages).toHaveBeenLastCalledWith('chat', { before: undefined, after: 5 });
  expect(rows[0].messages.map(message => message.sequence)).toEqual([5, 6, 7]);
});

test('typing activity starts immediately, refreshes while active, and stops after inactivity', async () => {
  jest.useFakeTimers();
  try {
    await act(async () => api.openThread('chat'));
    await act(async () => api.startTyping('chat'));
    expect(setSupabaseConversationTyping).toHaveBeenLastCalledWith('chat', true);

    await act(async () => { jest.advanceTimersByTime(2500); });
    await act(async () => api.startTyping('chat'));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(setSupabaseConversationTyping.mock.calls.filter(([, typing]) => typing)).toHaveLength(2);

    await act(async () => { jest.advanceTimersByTime(2500); });
    expect(setSupabaseConversationTyping).toHaveBeenLastCalledWith('chat', false);
  } finally {
    jest.useRealTimers();
  }
});

test('typing polling exposes only fresh activity for the active thread and expires it locally', async () => {
  jest.useFakeTimers();
  try {
    loadSupabaseConversationTyping.mockResolvedValue({ isTyping: true, updatedAt: new Date().toISOString() });
    await act(async () => {
      api.openThread('chat');
      await Promise.resolve();
    });
    expect(api.typingByConversation.chat).toEqual(expect.objectContaining({ expiresAt: expect.any(Number) }));

    await act(async () => { jest.advanceTimersByTime(6001); });
    expect(api.typingByConversation).toEqual({});
  } finally {
    jest.useRealTimers();
  }
});

test('typing activity respects the sharing preference and account generation', async () => {
  await act(async () => api.openThread('chat'));
  await act(async () => root.render(<Harness showTypingActivity={false} />));
  await act(async () => api.startTyping('chat'));
  expect(setSupabaseConversationTyping).not.toHaveBeenCalledWith('chat', true);

  await act(async () => root.render(<Harness showTypingActivity />));
  await act(async () => api.startTyping('chat'));
  expect(setSupabaseConversationTyping).toHaveBeenLastCalledWith('chat', true);
  await act(async () => root.render(<Harness accountId="bob" />));
  expect(setSupabaseConversationTyping).not.toHaveBeenLastCalledWith('chat', false);
});

test('switching threads stops the old session and immediately starts the new one', async () => {
  await act(async () => root.render(<Harness conversationIds={['chat', 'other']} />));
  await act(async () => api.openThread('chat'));
  await act(async () => api.startTyping('chat'));
  await act(async () => api.openThread('other'));
  await act(async () => api.startTyping('other'));

  expect(setSupabaseConversationTyping.mock.calls).toEqual(expect.arrayContaining([
    ['chat', true], ['chat', false], ['other', true],
  ]));
  expect(setSupabaseConversationTyping.mock.calls.some(([id, typing]) => id === 'other' && typing)).toBe(true);
});

test('typing stop waits for an in-flight start and sends the latest state', async () => {
  let resolveStart;
  setSupabaseConversationTyping.mockImplementationOnce(() => new Promise(resolve => { resolveStart = resolve; }));
  await act(async () => api.openThread('chat'));
  await act(async () => api.startTyping('chat'));
  await act(async () => api.stopTyping('chat'));
  expect(setSupabaseConversationTyping).toHaveBeenCalledTimes(1);
  expect(setSupabaseConversationTyping).toHaveBeenLastCalledWith('chat', true);

  await act(async () => {
    resolveStart(true);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(setSupabaseConversationTyping).toHaveBeenLastCalledWith('chat', false);
});

test('queued typing state from an old account is discarded after account switch', async () => {
  let resolveStart;
  setSupabaseConversationTyping.mockImplementationOnce(() => new Promise(resolve => { resolveStart = resolve; }));
  await act(async () => api.openThread('chat'));
  await act(async () => api.startTyping('chat'));
  await act(async () => api.stopTyping('chat'));
  await act(async () => root.render(<Harness accountId="bob" />));
  await act(async () => {
    resolveStart(true);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(setSupabaseConversationTyping).toHaveBeenCalledTimes(1);
  expect(setSupabaseConversationTyping).toHaveBeenLastCalledWith('chat', true);
});

test('stopping outgoing typing leaves an incoming typing indicator intact', async () => {
  loadSupabaseConversationTyping.mockResolvedValue({ isTyping: true, updatedAt: new Date().toISOString() });
  await act(async () => {
    api.openThread('chat');
    await Promise.resolve();
  });
  expect(api.typingByConversation.chat).toEqual(expect.objectContaining({ expiresAt: expect.any(Number) }));

  await act(async () => api.startTyping('chat'));
  await act(async () => root.render(<Harness showTypingActivity={false} />));
  expect(api.typingByConversation.chat).toEqual(expect.objectContaining({ expiresAt: expect.any(Number) }));
});

test('typing polling stops in the background and ignores a late response until foregrounded', async () => {
  jest.useFakeTimers();
  const previousVisibility = document.visibilityState;
  const pending = [];
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  loadSupabaseConversationTyping.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  try {
    await act(async () => {
      api.openThread('chat');
      await Promise.resolve();
    });
    expect(pending).toHaveLength(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => { jest.advanceTimersByTime(6001); });
    expect(pending).toHaveLength(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(pending).toHaveLength(1);
    await act(async () => {
      pending.shift()({ isTyping: true, updatedAt: new Date().toISOString() });
      await Promise.resolve();
    });
    expect(api.typingByConversation).toEqual({});
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(pending).toHaveLength(1);
    await act(async () => {
      pending.shift()({ isTyping: true, updatedAt: new Date().toISOString() });
      await Promise.resolve();
    });
    expect(api.typingByConversation.chat).toEqual(expect.objectContaining({ expiresAt: expect.any(Number) }));
  } finally {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: previousVisibility });
    jest.useRealTimers();
  }
});
