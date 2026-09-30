import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';
import {
  loadConversations,
  loadConversationMessages,
  sendSupabaseConversationMessage,
  respondSocialWalk,
  setSupabaseConversationTyping,
  loadSupabaseConversationTyping,
} from './supabaseApi';
import { readChatStorage, writeChatStorage, mergeMessages, reconcileOutbox } from './messageStorage';

export function useMessaging({ accountId, live, conversations, setConversations, showTypingActivity = true }) {
  const [local, setLocal] = useState({ outbox: [], drafts: {} });
  const [chatError, setChatError] = useState('');
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [unreadTotals, setUnreadTotals] = useState({ MATCH: 0, FOSTER: 0 });
  const [inboxHasMore, setInboxHasMore] = useState({ ALL: false, MATCH: false, FOSTER: false });
  const [threadHasMore, setThreadHasMore] = useState({});
  const [loadingThread, setLoadingThread] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState({});
  const state = useRef({});
  state.current = { accountId, live, conversations, local, showTypingActivity };
  const activeThread = useRef(null);
  const inboxSource = useRef('ALL');
  const inboxCursor = useRef({});
  const pendingSends = useRef(new Set());
  const threadLoads = useRef(new Set());
  const queuedLoads = useRef(new Set());
  const fetchedThrough = useRef(new Map());
  const generation = useRef(0);
  const storageReady = useRef(true);
  const appActive = useRef(true);
  const [typingConversationId, setTypingConversationId] = useState(null);
  const typingSession = useRef(null);
  const typingWrites = useRef(new Map());

  const sendTyping = useCallback((conversationId, isTyping, version) => {
    const accountId = state.current.accountId;
    if (!accountId || !state.current.live || navigator.onLine === false
      || version !== generation.current || typeof setSupabaseConversationTyping !== 'function') return;
    const key = `${accountId}:${conversationId}`;
    const entry = typingWrites.current.get(key) || { inFlight: null, queued: null };
    const next = { accountId, isTyping: Boolean(isTyping), version };
    if (entry.inFlight?.isTyping === next.isTyping && !entry.queued) return;
    if (entry.queued?.isTyping === next.isTyping) return;
    entry.queued = next;
    typingWrites.current.set(key, entry);

    const flush = () => {
      if (entry.inFlight || !entry.queued) {
        if (!entry.inFlight && !entry.queued) typingWrites.current.delete(key);
        return;
      }
      const request = entry.queued;
      entry.queued = null;
      if (request.accountId !== state.current.accountId || request.version !== generation.current
        || !state.current.live || navigator.onLine === false) {
        typingWrites.current.delete(key);
        return;
      }
      entry.inFlight = request;
      Promise.resolve(setSupabaseConversationTyping(conversationId, request.isTyping))
        .catch(() => {
          // Typing is ephemeral; a missed best-effort update expires server-side.
        })
        .finally(() => {
          entry.inFlight = null;
          flush();
        });
    };
    flush();
  }, []);

  const stopTyping = useCallback((conversationId) => {
    const session = typingSession.current;
    if (!session || (conversationId && session.conversationId !== conversationId)) return;
    if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
    if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
    typingSession.current = null;
    if (session.accountId === state.current.accountId && session.version === generation.current) {
      sendTyping(session.conversationId, false, session.version);
    }
  }, [sendTyping]);

  const startTyping = useCallback((conversationId) => {
    if (!state.current.live || !state.current.showTypingActivity || navigator.onLine === false
      || document.visibilityState === 'hidden' || !appActive.current || activeThread.current !== conversationId) return;
    const conversation = state.current.conversations.find(item => item.id === conversationId);
    if (conversation?.blocked || conversation?.fosterReadOnly
      || (conversation?.socialRequestStatus && conversation.socialRequestStatus !== 'ACCEPTED')) return;

    let current = typingSession.current;
    if (current && current.conversationId !== conversationId) {
      stopTyping();
      current = null;
    }
    const session = current || {
      accountId: state.current.accountId,
      conversationId,
      version: generation.current,
      heartbeatTimer: null,
      inactivityTimer: null,
    };
    typingSession.current = session;
    session.lastInputAt = Date.now();
    if (!current) sendTyping(conversationId, true, session.version);
    if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
    session.inactivityTimer = window.setTimeout(() => {
      if (typingSession.current === session && Date.now() - session.lastInputAt >= 3000) stopTyping(conversationId);
    }, 3000);
    if (!session.heartbeatTimer) {
      session.heartbeatTimer = window.setInterval(() => {
        if (typingSession.current !== session || Date.now() - session.lastInputAt >= 3000
          || document.visibilityState === 'hidden' || navigator.onLine === false || !appActive.current) {
          stopTyping(conversationId);
          return;
        }
        sendTyping(conversationId, true, session.version);
      }, 3000);
    }
  }, [sendTyping, stopTyping]);

  useEffect(() => {
    if (showTypingActivity) return undefined;
    stopTyping();
    return undefined;
  }, [showTypingActivity, stopTyping]);

  useEffect(() => {
    stopTyping();
    generation.current += 1;
    activeThread.current = null;
    setTypingConversationId(null);
    setTypingByConversation({});
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
  }, [accountId, stopTyping]);

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
    if (activeThread.current && activeThread.current !== conversationId) stopTyping(activeThread.current);
    activeThread.current = conversationId;
    setTypingConversationId(conversationId || null);
    if (!conversationId) setTypingByConversation({});
    if (conversationId) loadThread(conversationId);
  }, [loadThread, stopTyping]);

  const sendMessage = useCallback(async (conversationId, body, retryId) => {
    if (!body.trim() || [...body].length > 4000) throw new Error('readiness.messageLimit');
    const conversation = state.current.conversations.find(c => c.id === conversationId);
    if (conversation?.fosterReadOnly) throw new Error('care.readOnlyChat');
    if (conversation?.socialRequestStatus && conversation.socialRequestStatus !== 'ACCEPTED') throw new Error('readiness.walkNotAccepted');
    stopTyping(conversationId);
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
          const canonical = { ...pending, messageId, sequence: data.message_seq, createdAt: data.created_at, status: 'sent', isNew: true };
          setConversations(current => current.map(c => c.id === conversationId
            ? { ...c, messages: mergeMessages(c.messages || [], [canonical]), lastMessage: pending.body, lastMessageAt: canonical.createdAt } : c));
        } else {
          setConversations(current => current.map(c => c.id === conversationId ? { ...c,
            messages: [...c.messages, { ...pending, status: 'sent', isNew: true }], lastMessage: pending.body } : c));
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
  }, [persist, refreshInbox, setConversations, stopTyping]);

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
    if (!accountId || !live || !typingConversationId || typeof loadSupabaseConversationTyping !== 'function') return undefined;
    const conversationId = typingConversationId;
    const version = generation.current;
    let alive = true;
    let inFlight = false;
    let expiryTimer = null;
    let timer = null;
    let nativeListener;
    let foregroundVersion = 0;
    const foreground = () => appActive.current && document.visibilityState !== 'hidden' && navigator.onLine !== false;
    const clearTyping = () => setTypingByConversation(current => {
      if (!current[conversationId]) return current;
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    const clearExpired = () => setTypingByConversation(current => {
      const row = current[conversationId];
      if (!row?.expiresAt || row.expiresAt > Date.now()) return current;
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    const stopPolling = () => {
      foregroundVersion += 1;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      if (expiryTimer !== null) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
      }
      clearTyping();
    };
    const poll = async () => {
      if (!alive || version !== generation.current || !foreground() || inFlight) return;
      clearExpired();
      const requestForegroundVersion = foregroundVersion;
      inFlight = true;
      try {
        const result = await loadSupabaseConversationTyping(conversationId);
        if (!alive || version !== generation.current || activeThread.current !== conversationId
          || requestForegroundVersion !== foregroundVersion || !foreground()) return;
        const updatedAt = result?.updatedAt ? Date.parse(result.updatedAt) : Date.now();
        const active = Boolean(result?.isTyping) && updatedAt > Date.now() - 6000;
        if (!active) {
          clearTyping();
        } else {
          const expiresAt = updatedAt + 6000;
          setTypingByConversation({ [conversationId]: { expiresAt } });
          if (expiryTimer !== null) clearTimeout(expiryTimer);
          expiryTimer = window.setTimeout(() => {
            expiryTimer = null;
            if (alive && version === generation.current && foreground()) clearTyping();
          }, Math.max(0, expiresAt - Date.now()));
        }
      } catch {
        if (alive && version === generation.current && activeThread.current === conversationId
          && requestForegroundVersion === foregroundVersion && foreground()) clearExpired();
      } finally {
        inFlight = false;
      }
    };
    const startPolling = () => {
      if (timer !== null || !foreground()) return;
      poll();
      timer = window.setInterval(poll, 2000);
    };
    const onVisibility = () => {
      if (foreground()) startPolling();
      else stopPolling();
    };
    const onOffline = () => stopPolling();
    startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onVisibility);
    window.addEventListener('offline', onOffline);
    if (Capacitor.isNativePlatform()) CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      appActive.current = isActive;
      if (isActive) startPolling();
      else stopPolling();
    }).then(listener => { if (!alive) listener.remove(); else nativeListener = listener; });
    return () => {
      stopPolling();
      alive = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onVisibility);
      window.removeEventListener('offline', onOffline);
      nativeListener?.remove();
    };
  }, [accountId, live, typingConversationId]);

  useEffect(() => {
    if (!accountId || !live) return undefined;
    let alive = true; let subscribed = false; let refreshing = false;
    appActive.current = true;
    const foreground = () => appActive.current && document.visibilityState !== 'hidden';
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
            body: row.body, createdAt: row.created_at, isMine: row.sender_id === accountId, status: 'sent', isNew: true };
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
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopTyping();
      reconcile();
    };
    const onOffline = () => stopTyping();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', reconcile);
    window.addEventListener('offline', onOffline);
    let nativeListener;
    if (Capacitor.isNativePlatform()) CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      appActive.current = isActive;
      if (!isActive) stopTyping();
      if (isActive) reconcile();
    }).then(listener => { if (!alive) listener.remove(); else nativeListener = listener; });
    reconcile();
    return () => {
      alive = false; setRealtimeReady(false); clearInterval(timer);
      stopTyping();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', reconcile);
      window.removeEventListener('offline', onOffline);
      nativeListener?.remove(); supabase.removeChannel(channel);
    };
  }, [accountId, live, loadThread, refreshInbox, setConversations, stopTyping]);

  useEffect(() => {
    const newMessageIds = conversations.flatMap(conversation => (conversation.messages || [])
      .filter(message => message.isNew).map(message => `${conversation.id}:${message.messageId}`));
    if (!newMessageIds.length) return undefined;
    const timer = window.setTimeout(() => {
      const ids = new Set(newMessageIds);
      setConversations(current => current.map(conversation => ({
        ...conversation,
        messages: (conversation.messages || []).map(message => ids.has(`${conversation.id}:${message.messageId}`)
          ? { ...message, isNew: false } : message),
      })));
    }, 360);
    return () => clearTimeout(timer);
  }, [conversations, setConversations]);

  return { outbox: local.outbox, drafts: local.drafts, saveDraft, sendMessage, chatError,
    realtimeReady, unreadTotals, refreshInbox, inboxHasMore, openThread, loadThread, loadingThread, threadHasMore,
    markRead, respondToWalk, typingByConversation, startTyping, stopTyping };
}
