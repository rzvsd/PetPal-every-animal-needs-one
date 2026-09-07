import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';
import { loadConversations, loadConversationMessages, sendSupabaseConversationMessage, respondSocialWalk } from './supabaseApi';
import { readChatStorage, writeChatStorage, mergeMessages, reconcileOutbox } from './messageStorage';

export function useMessaging({ accountId, live, conversations, setConversations }) {
  const [local, setLocal] = useState({ outbox: [], drafts: {} });
  const [chatError, setChatError] = useState('');
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [unreadTotals, setUnreadTotals] = useState({ MATCH: 0, FOSTER: 0 });
  const [inboxHasMore, setInboxHasMore] = useState({ MATCH: false, FOSTER: false });
  const [threadHasMore, setThreadHasMore] = useState({});
  const [loadingThread, setLoadingThread] = useState(false);
  const state = useRef({});
  state.current = { accountId, live, conversations, local };
  const activeThread = useRef(null);
  const inboxSource = useRef('MATCH');
  const inboxCursor = useRef({});
  const pendingSends = useRef(new Set());
  const threadLoads = useRef(new Set());
  const queuedLoads = useRef(new Set());
  const fetchedThrough = useRef(new Map());
  const generation = useRef(0);
  const storageReady = useRef(true);

  useEffect(() => {
    generation.current += 1;
    activeThread.current = null;
    inboxCursor.current = {};
    threadLoads.current.clear();
    queuedLoads.current.clear();
    fetchedThrough.current.clear();
    setInboxHasMore({ MATCH: false, FOSTER: false });
    setThreadHasMore({});
    setUnreadTotals({ MATCH: 0, FOSTER: 0 });
    setChatError('');
    try { setLocal(readChatStorage(accountId)); storageReady.current = true; }
    catch { storageReady.current = false; setChatError('readiness.storageFailed'); setLocal({ outbox: [], drafts: {} }); }
  }, [accountId]);

  const persist = useCallback(next => {
    if (!storageReady.current) throw new Error('readiness.storageFailed');
    writeChatStorage(state.current.accountId, next);
    state.current.local = next;
    setLocal(next);
  }, []);

  const saveDraft = useCallback((conversationId, body) => {
    try {
      persist({ ...state.current.local, drafts: { ...state.current.local.drafts, [conversationId]: body } });
      return true;
    } catch { setChatError('readiness.storageFailed'); return false; }
  }, [persist]);

  const refreshInbox = useCallback(async (source = inboxSource.current, older = false, id) => {
    if (!state.current.live) return [];
    const version = generation.current;
    if (!id) inboxSource.current = source;
    try {
      const rows = await loadConversations({ source: id ? undefined : source, before: older ? inboxCursor.current[source] : null, id });
      const { data: totals, error: totalsError } = await supabase.rpc('conversation_unread_totals');
      if (totalsError) throw totalsError;
      if (version !== generation.current) return [];
      for (const row of rows) if (row.blocked) fetchedThrough.current.delete(row.id);
      setUnreadTotals({ MATCH: 0, FOSTER: 0, ...Object.fromEntries(totals.map(row => [row.source, Number(row.unread_count)])) });
      setConversations(current => {
        const result = new Map(current.map(conversation => [conversation.id, conversation]));
        if (id && !rows.length) result.delete(id);
        for (const row of rows) result.set(row.id, { ...row, messages: row.blocked ? [] : result.get(row.id)?.messages || [] });
        return [...result.values()].sort((a, b) => (b.activityAt || b.lastMessageAt || '').localeCompare(a.activityAt || a.lastMessageAt || ''));
      });
      if (!id) {
        if (older || !inboxCursor.current[source]) {
          if (rows.length) inboxCursor.current[source] = rows[rows.length - 1];
          setInboxHasMore(current => ({ ...current, [source]: rows.length === 20 }));
        }
      }
      return rows;
    } catch (error) {
      if (version === generation.current) setChatError('readiness.refreshError');
      throw error;
    }
  }, [setConversations]);

  const loadThread = useCallback(async (conversationId, older = false) => {
    if (!state.current.live) return false;
    if (threadLoads.current.has(conversationId)) {
      if (!older) queuedLoads.current.add(conversationId);
      return false;
    }
    const version = generation.current;
    threadLoads.current.add(conversationId);
    setLoadingThread(true);
    try {
      const existing = state.current.conversations.find(c => c.id === conversationId)?.messages || [];
      let after = older ? undefined : fetchedThrough.current.get(conversationId);
      const before = older && existing.length ? Math.min(...existing.map(m => m.sequence)) : undefined;
      let received = [];
      let rows;
      do {
        rows = await loadConversationMessages(conversationId, { before, after });
        if (version !== generation.current) return;
        received = mergeMessages(received, rows);
        if (after !== undefined && rows.length) after = rows[rows.length - 1].sequence;
      } while (after !== undefined && rows.length === 50);
      if (!older) fetchedThrough.current.set(conversationId, received.at(-1)?.sequence ?? after ?? 0);
      setConversations(current => current.map(c => c.id === conversationId
        ? { ...c, messages: mergeMessages(c.messages || [], received) } : c));
      if (older || !existing.length) setThreadHasMore(current => ({ ...current, [conversationId]: rows.length === 50 }));
      persist({ ...state.current.local, outbox: reconcileOutbox(state.current.local.outbox, received) });
      setChatError('');
      return true;
    } catch {
      if (version === generation.current) setChatError('readiness.refreshError');
      return false;
    } finally {
      if (version === generation.current) {
        threadLoads.current.delete(conversationId);
        setLoadingThread(false);
        if (queuedLoads.current.delete(conversationId)) window.setTimeout(() => {
          if (version === generation.current) loadThread(conversationId);
        }, 0);
      }
    }
  }, [persist, setConversations]);

  const openThread = useCallback(conversationId => {
    activeThread.current = conversationId;
    if (conversationId) loadThread(conversationId);
  }, [loadThread]);

  const sendMessage = useCallback(async (conversationId, body, retryId) => {
    if (!body.trim() || [...body].length > 4000) throw new Error('readiness.messageLimit');
    const conversation = state.current.conversations.find(c => c.id === conversationId);
    if (conversation?.fosterReadOnly) throw new Error('care.readOnlyChat');
    if (conversation?.socialRequestStatus && conversation.socialRequestStatus !== 'ACCEPTED') throw new Error('readiness.walkNotAccepted');
    const requestId = retryId || crypto.randomUUID();
    if (pendingSends.current.has(requestId)) return;
    const version = generation.current;
    const pending = { messageId: requestId, clientMessageId: requestId, conversationId,
      body: body.trim(), createdAt: new Date().toISOString(), isMine: true, status: 'sending' };
    try {
      const { drafts, outbox } = state.current.local;
      persist({ drafts: { ...drafts, [conversationId]: '' }, outbox: [...outbox.filter(m => m.clientMessageId !== requestId), pending] });
    } catch { throw new Error('readiness.storageFailed'); }
    pendingSends.current.add(requestId);
    // Persistence is synchronous before the input is cleared. Server work continues separately.
    const submit = async () => {
      try {
        const messageId = state.current.live
          ? await sendSupabaseConversationMessage(conversationId, pending.body, requestId) : requestId;
        if (version !== generation.current) return;
        if (state.current.live) {
          const { data, error } = await supabase.from('conversation_messages_view').select('*').eq('message_id', messageId).single();
          if (version !== generation.current) return;
          if (error) throw error;
          const canonical = { ...pending, messageId, sequence: data.message_seq, createdAt: data.created_at, status: 'sent' };
          setConversations(current => current.map(c => c.id === conversationId
            ? { ...c, messages: mergeMessages(c.messages || [], [canonical]), lastMessage: pending.body, lastMessageAt: canonical.createdAt } : c));
        } else {
          setConversations(current => current.map(c => c.id === conversationId ? { ...c,
            messages: [...c.messages, { ...pending, status: 'sent' }], lastMessage: pending.body } : c));
        }
        persist({ ...state.current.local, outbox: state.current.local.outbox.filter(m => m.clientMessageId !== requestId) });
        refreshInbox(undefined, false, conversationId).catch(() => {});
      } catch {
        if (version !== generation.current) return;
        const next = { ...state.current.local, outbox: state.current.local.outbox.map(m => m.clientMessageId === requestId ? { ...m, status: 'failed' } : m) };
        try { persist(next); } catch { setLocal(next); setChatError('readiness.storageFailed'); }
      } finally { pendingSends.current.delete(requestId); }
    };
    submit();
  }, [persist, refreshInbox, setConversations]);

  const respondToWalk = useCallback(async (conversationId, accept) => {
    const version = generation.current;
    const status = await respondSocialWalk(conversationId, accept);
    if (version !== generation.current) return;
    setConversations(current => current.map(c => c.id === conversationId ? { ...c, socialRequestStatus: status } : c));
    refreshInbox(undefined, false, conversationId).catch(() => {});
  }, [refreshInbox, setConversations]);

  const markRead = useCallback(async (conversationId, message) => {
    if (!state.current.live || !message?.sequence) return;
    const conversation = state.current.conversations.find(c => c.id === conversationId);
    if (!conversation || message.sequence <= conversation.lastReadSequence) return;
    const version = generation.current;
    const { data, error } = await supabase.rpc('mark_conversation_read', {
      conversation_id_input: conversationId, message_id_input: message.messageId,
    });
    if (!error && version === generation.current) {
      setConversations(current => current.map(c => c.id === conversationId ? { ...c, lastReadSequence: data } : c));
      refreshInbox(undefined, false, conversationId).catch(() => {});
    }
  }, [refreshInbox, setConversations]);

  useEffect(() => {
    if (!accountId || !live) return undefined;
    let alive = true; let subscribed = false; let refreshing = false; let appActive = true;
    const foreground = () => appActive && document.visibilityState !== 'hidden';
    const reconcile = async () => {
      if (!alive || !foreground() || refreshing) return;
      refreshing = true;
      try {
        await refreshInbox();
        if (activeThread.current) {
          await refreshInbox(undefined, false, activeThread.current);
          await loadThread(activeThread.current);
        }
      } catch { /* A visible refresh error is set by refreshInbox. */ }
      finally { refreshing = false; }
    };
    const channel = supabase.channel(`chat:${accountId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (!alive || !foreground()) return;
        const row = payload.new;
        if (activeThread.current === row.conversation_id) {
          // Realtime already applies message RLS. Display immediately; HTTP reconciliation fills any gaps.
          const message = { messageId: row.id, clientMessageId: row.client_message_id, sequence: row.message_seq,
            body: row.body, createdAt: row.created_at, isMine: row.sender_id === accountId, status: 'sent' };
          setConversations(current => current.map(c => c.id === row.conversation_id && !c.blocked
            ? { ...c, messages: mergeMessages(c.messages || [], [{ ...message, senderDisplayName: c.otherOwnerName }]) } : c));
          loadThread(row.conversation_id);
        }
        refreshInbox(undefined, false, row.conversation_id).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants', filter: `profile_id=eq.${accountId}` }, payload => {
        if (!alive || !foreground() || !payload.new.conversation_id) return;
        const id = payload.new.conversation_id;
        const wasBlocked = state.current.conversations.find(c => c.id === id)?.blocked;
        refreshInbox(undefined, false, id).then(rows => {
          if (wasBlocked && rows[0] && !rows[0].blocked && activeThread.current === id) loadThread(id);
        }).catch(() => {});
      })
      .subscribe(status => {
        if (!alive) return;
        subscribed = status === 'SUBSCRIBED'; setRealtimeReady(subscribed);
        if (subscribed) reconcile();
      });
    const timer = window.setInterval(() => { if (!subscribed) reconcile(); }, 5000);
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('online', reconcile);
    let nativeListener;
    if (Capacitor.isNativePlatform()) CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      appActive = isActive;
      if (isActive) reconcile();
    }).then(listener => { if (!alive) listener.remove(); else nativeListener = listener; });
    reconcile();
    return () => {
      alive = false; setRealtimeReady(false); clearInterval(timer);
      document.removeEventListener('visibilitychange', reconcile);
      window.removeEventListener('online', reconcile);
      nativeListener?.remove(); supabase.removeChannel(channel);
    };
  }, [accountId, live, loadThread, refreshInbox, setConversations]);

  return { outbox: local.outbox, drafts: local.drafts, saveDraft, sendMessage, chatError,
    realtimeReady, unreadTotals, refreshInbox, inboxHasMore, openThread, loadThread, loadingThread, threadHasMore, markRead, respondToWalk };
}
