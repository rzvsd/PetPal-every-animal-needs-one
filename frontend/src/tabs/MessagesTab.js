import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowDown, ArrowLeft, Check, ChevronDown, Clock, Lock, MoreVertical, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useReducedPetMotion } from '../components/Motion';
import { SafetyMenu } from '../components/SharedComponents';
import DialogLayer from '../components/DialogLayer';
import { useBackHandler } from '../navigation/backNavigation';
import { Avatar, Button, Count, Empty, IconButton, Notice, OverScreen, PageTitle, Row, Skeleton, fmt, person } from '../ui/kit';
import { list, listItem, push, spring } from '../ui/motion';
import { MATCH_ENABLED } from '../navigation/environments';
import './messages.css';

// What kind of conversation this is, in two or three words.
function conversationKind(conv, t) {
  if (conv.source === 'FOSTER') return conv.fosterRequestId ? t(`care.${conv.fosterStatus}`) : (conv.subtitle || t('messages.foster'));
  if (conv.socialRequestStatus === 'PENDING') return t(conv.socialRequestIsMine ? 'readiness.walkPending' : 'readiness.walkIncoming');
  if (conv.socialRequestStatus === 'DECLINED') return t('readiness.walkDeclined');
  if (conv.mode === 'SOCIAL') return t('matches.social');
  if (conv.mode === 'PLAY') return t('matches.play');
  return t('messages.match');
}

// The status word is coloured by what it means: done, waiting on someone, or over.
const STATUS_TONE = { ACCEPTED: 'good', COMPLETED: 'good', IN_CARE: 'good', PENDING: 'waiting', RESERVED: 'waiting',
  DECLINED: 'ended', WITHDRAWN: 'ended', CANCELLED: 'ended', PLACED_ELSEWHERE: 'ended' };
function statusTone(conv) {
  if (conv.source === 'FOSTER') return conv.fosterRequestId ? STATUS_TONE[conv.fosterStatus] || '' : '';
  if (conv.socialRequestStatus === 'PENDING') return 'waiting';
  if (conv.socialRequestStatus === 'DECLINED') return 'ended';
  return '';
}

function ConversationRow({ conv, onClick, t }) {
  const time = conv.lastMessageAt ? getTimeAgo(conv.lastMessageAt, t) : '';
  return <Row variants={listItem} data-testid={`conversation-card-${conv.id}`} onClick={onClick} unread={conv.unread > 0}
      aria-label={`${t('messages.openConversation')}: ${conv.title}`}
      className={`${conv.source === 'FOSTER' ? 'pp-conv-foster' : ''} ${statusTone(conv) ? `is-tone-${statusTone(conv)}` : ''}`}
      leading={<Avatar src={conv.animalPhoto} name="" size={56} />}
      overline={conversationKind(conv, t)} title={conv.title} subtitle={conv.lastMessage || t('messages.sayHello')}
      meta={time} trailing={<Count value={conv.unread} />} />;
}

function MessageStatus({ status, t }) {
  if (status === 'sending') return <span className="pp-msg-status"><Clock size={12} aria-hidden="true" />{t('readiness.sending')}</span>;
  if (status === 'failed') return <span className="pp-msg-status is-failed"><AlertCircle size={12} aria-hidden="true" />{t('readiness.failed')}</span>;
  return <span className="pp-msg-status"><Check size={12} aria-hidden="true" />{t('readiness.sent')}</span>;
}

function ConversationThread({ conv, onBack, t }) {
  const { messaging, reportConversation, blockConversation, dataSource, lang } = useApp();
  const { sendMessage, outbox, drafts, saveDraft, chatError, realtimeReady, openThread, loadThread,
    threadHasMore, loadingThread, markRead, respondToWalk, typingByConversation, startTyping, stopTyping } = messaging;
  const [input, setInput] = useState(drafts[conv.id] || '');
  const [sendError, setSendError] = useState('');
  const [showSafety, setShowSafety] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [notice, setNotice] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [responding, setResponding] = useState(false);
  const scroll = useRef(null);
  const atBottom = useRef(true);
  const olderAnchor = useRef(null);
  const sending = useRef(false);
  const reducedMotion = useReducedPetMotion();
  const isMatch = conv.source === 'MATCH';
  const locale = lang === 'ro' ? 'ro-RO' : 'en-GB';
  const canWrite = !conv.blocked && !conv.fosterReadOnly && (!conv.socialRequestStatus || conv.socialRequestStatus === 'ACCEPTED');
  const hidden = conv.blocked && !conv.historyKept;
  const messages = useMemo(() => hidden ? [] : [...conv.messages, ...outbox.filter(message => message.conversationId === conv.id
    && !conv.messages.some(accepted => accepted.clientMessageId === message.clientMessageId))], [hidden, conv.id, conv.messages, outbox]);
  const messageKey = message => message.clientMessageId || message.messageId;
  const seenMessages = useRef(null);
  if (!seenMessages.current) seenMessages.current = new Set(messages.map(messageKey));
  useLayoutEffect(() => { messages.forEach(message => seenMessages.current.add(messageKey(message))); }, [messages]);
  const latest = conv.messages[conv.messages.length - 1];
  useBackHandler(true, onBack);
  useEffect(() => {
    openThread(conv.id);
    return () => openThread(null);
  }, [conv.id, openThread]);
  useEffect(() => { setInput(drafts[conv.id] || ''); }, [conv.id, drafts]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (olderAnchor.current) {
      element.scrollTop = olderAnchor.current.top + element.scrollHeight - olderAnchor.current.height;
      olderAnchor.current = null;
    } else if (atBottom.current) element.scrollTop = element.scrollHeight;
    else setNewMessages(true);
  }, [conv.messages, outbox]);
  useEffect(() => {
    const read = () => {
      if (atBottom.current && document.visibilityState !== 'hidden' && !hidden) markRead(conv.id, latest);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [conv.id, hidden, latest, markRead]);
  const handleSend = async () => {
    if (sending.current || !input.trim() || !canWrite) return;
    sending.current = true; setSendError('');
    try {
      stopTyping(conv.id);
      await sendMessage(conv.id, input);
      setInput(''); atBottom.current = true;
    } catch (error) { setSendError(t(error.message)); }
    finally { sending.current = false; }
  };
  const respond = async accept => {
    if (sending.current) return;
    sending.current = true; setResponding(true); setSendError('');
    try { await respondToWalk(conv.id, accept); }
    catch { setSendError(t('readiness.walkResponseError')); }
    finally { sending.current = false; setResponding(false); }
  };
  const loadEarlier = async () => {
    if (loadingThread) return;
    olderAnchor.current = { height: scroll.current.scrollHeight, top: scroll.current.scrollTop };
    const loaded = await loadThread(conv.id, true);
    // A failed request doesn't leave an anchor waiting for an unrelated new message.
    if (!loaded) olderAnchor.current = null;
  };
  const safetyAction = async action => {
    setShowSafety(false);
    // Blocking cannot be taken back from here, so it asks once.
    if (action === 'block') { setConfirmBlock(true); return; }
    await runSafety(action);
  };
  const runSafety = async action => {
    setConfirmBlock(false);
    try {
      if (action === 'block') await blockConversation(conv.id);
      else await reportConversation(conv.id, t('messages.conversationReported'));
      setNotice(t(action === 'block' ? 'messages.userBlocked' : 'messages.conversationReported'));
    } catch { setNotice(t(action === 'block' ? 'messages.blockFailed' : 'messages.reportFailed')); }
  };
  const scrollChanged = () => {
    const element = scroll.current;
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    if (atBottom.current) { setNewMessages(false); markRead(conv.id, latest); }
  };
  const jumpDown = () => {
    atBottom.current = true; scroll.current.scrollTo({ top: scroll.current.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
    setNewMessages(false); markRead(conv.id, latest);
  };
  const other = isMatch ? conv.relatedAnimalName || conv.title : conv.animalName || conv.title;

  return <motion.section data-testid="conversation-thread" className="petpal-fullscreen pp-thread" aria-label={other} {...push}>
    <header className="pp-thread-head">
      <IconButton icon={ArrowLeft} label={t('common.back')} onClick={onBack} data-testid="back-button" />
      <button type="button" className="pp-thread-who" onClick={() => setShowContext(value => !value)} aria-expanded={showContext}
        data-testid="conversation-context-panel">
        <Avatar src={conv.animalPhoto} name="" size={40} className="is-round" />
        <span className="ui-grow"><span className="pp-thread-name">{other}</span>
          <span className="pp-thread-sub">{[person(conv.otherOwnerName, t), conversationKind(conv, t)].filter(Boolean).join(' · ')}</span></span>
        <ChevronDown size={18} className={`pp-thread-chevron ${showContext ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      <IconButton icon={MoreVertical} label={t('messages.safetyMenu')} onClick={() => setShowSafety(true)} data-testid="safety-menu-trigger" />
    </header>
    <AnimatePresence initial={false}>{showContext && <motion.div key="context" className="pp-thread-context"
      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
      <div className="pp-thread-context-inner">
        <p className="ui-title-s">{conv.title}</p>
        <p className="ui-small">{t(conv.mode === 'SOCIAL' ? 'readiness.walkHint' : isMatch ? 'messages.matchChatContext' : 'messages.fosterChatContext')}</p>
        {[conv.city, conv.coarseArea].filter(Boolean).length > 0 && <p className="ui-small">{[conv.coarseArea, conv.city].filter(Boolean).join(', ')}</p>}
        {conv.organizationName && <p className="ui-small">{conv.organizationName}</p>}
        <p className="ui-small pp-detail-private"><Lock size={14} aria-hidden="true" />{t('matches.locationPrivate')}</p>
      </div>
    </motion.div>}</AnimatePresence>

    <div className="pp-thread-notes">
      {conv.blocked && <Notice tone="error">{t(conv.historyKept ? 'fx.historyKept' : 'readiness.blockedChat')}</Notice>}
      {conv.fosterReadOnly && <Notice>{t('care.readOnlyChat')}</Notice>}
      {notice && <Notice tone="success" onClose={() => setNotice('')}>{notice}</Notice>}
      {chatError && <Notice tone="error" action={<button type="button" className="ui-notice-close" onClick={() => loadThread(conv.id)}>{t('readiness.retry')}</button>}>{t(chatError)}</Notice>}
      {dataSource === 'supabase' && !realtimeReady && <p role="status" className="ui-small">{t('readiness.refreshing')}</p>}
    </div>

    <div ref={scroll} onScroll={scrollChanged} data-testid="message-scroll" className="pp-thread-scroll">
      {threadHasMore[conv.id] && <Button variant="quiet" block disabled={loadingThread} onClick={loadEarlier}>{t('readiness.earlierMessages')}</Button>}
      {loadingThread && !messages.length && <div className="pp-thread-skeleton" aria-hidden="true">
        <Skeleton width="62%" height={44} radius={20} /><Skeleton width="48%" height={44} radius={20} className="is-mine" /><Skeleton width="55%" height={60} radius={20} /></div>}
      {!loadingThread && !messages.length && !hidden && <p className="pp-thread-empty">{t('messages.sayHello')}</p>}
      {messages.map((msg, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const day = new Date(msg.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
        const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
        // Messages from the same person a few minutes apart read as one group.
        const groupedWithNext = next && next.isMine === msg.isMine && new Date(next.createdAt) - new Date(msg.createdAt) < 5 * 60000
          && new Date(next.createdAt).toDateString() === new Date(msg.createdAt).toDateString();
        const startsGroup = newDay || !previous || previous.isMine !== msg.isMine || new Date(msg.createdAt) - new Date(previous.createdAt) >= 5 * 60000;
        const shouldAnimate = !seenMessages.current.has(messageKey(msg)) && (msg.isNew || msg.status === 'sending');
        return <React.Fragment key={messageKey(msg)}>
          {newDay && <p className="pp-thread-day">{day}</p>}
          <motion.div data-testid="message-bubble" data-status={msg.status || 'sent'}
            className={`pp-msg ${msg.isMine ? 'is-mine' : ''} ${startsGroup ? 'starts' : ''} ${groupedWithNext ? '' : 'ends'} ${msg.status === 'sending' ? 'is-sending' : ''}`}
            initial={shouldAnimate && !reducedMotion ? { opacity: 0, y: 10, scale: 0.98 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}>
            {/* Foster chats can include a whole care team, so name who wrote. */}
            {!msg.isMine && !isMatch && startsGroup && msg.senderDisplayName && <p className="pp-msg-sender">{person(msg.senderDisplayName, t)}</p>}
            <div className="pp-msg-bubble"><p>{msg.body}</p></div>
            {(!groupedWithNext || msg.status === 'failed') && <p className="pp-msg-meta">
              {new Date(msg.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
              {msg.isMine && <MessageStatus status={msg.status} t={t} />}</p>}
            {msg.status === 'failed' && <div role="alert" className="pp-msg-retry">
              <span>{t('readiness.sendFailed')}</span>
              <button type="button" data-testid="retry-message" disabled={!canWrite}
                onClick={() => sendMessage(conv.id, msg.body, msg.clientMessageId).catch(error => setSendError(t(error.message)))}>{t('readiness.retryMessage')}</button>
            </div>}
          </motion.div>
        </React.Fragment>;
      })}
      <AnimatePresence>{typingByConversation?.[conv.id] && <motion.p key="typing" data-testid="typing-indicator" role="status" className="pp-thread-typing"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        {conv.otherOwnerName ? fmt(t('motion.typingName'), { name: person(conv.otherOwnerName, t) }) : t('motion.typing')}</motion.p>}</AnimatePresence>
    </div>

    <AnimatePresence>{newMessages && <motion.button key="new" type="button" className="pp-thread-jump" onClick={jumpDown}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={spring}>
      <ArrowDown size={16} aria-hidden="true" />{t('readiness.newMessages')}</motion.button>}</AnimatePresence>

    <footer className="pp-composer">
      {sendError && <p role="alert" className="ui-field-error">{sendError}</p>}
      {conv.socialRequestStatus && conv.socialRequestStatus !== 'ACCEPTED' && !conv.blocked ? <div className="pp-walk-answer">
        <p role="status" className="ui-small">{t(conv.socialRequestStatus === 'DECLINED' ? 'readiness.walkDeclinedHint'
          : conv.socialRequestIsMine ? 'readiness.walkPendingHint' : 'readiness.walkIncomingHint')}</p>
        {conv.socialRequestStatus === 'PENDING' && !conv.socialRequestIsMine && <>
          <div className="pp-walk-answer-row">
            <Button variant="secondary" disabled={responding} onClick={() => respond(false)}>{t('readiness.walkDecline')}</Button>
            <Button className="ui-grow" busy={responding} onClick={() => respond(true)}>{t('readiness.walkAccept')}</Button>
          </div>
          <Button variant="quiet" disabled={responding} onClick={() => safetyAction('block')}>{t('readiness.walkBlock')}</Button>
        </>}
      </div> : <>
        <div className="pp-composer-row">
          <textarea data-testid="message-input" rows={1} value={input} disabled={!canWrite} className="pp-composer-input"
            onChange={event => { const value = event.target.value; setInput(value); if (value.trim()) startTyping(conv.id); else stopTyping(conv.id); if (!saveDraft(conv.id, value)) setSendError(t('readiness.storageFailed')); }}
            onBlur={() => stopTyping(conv.id)}
            aria-label={t('messages.messageInput')} placeholder={t(conv.blocked ? 'messages.blockedPlaceholder' : 'messages.typeMessage')}
            onInput={event => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(132, event.target.scrollHeight)}px`; }} />
          <motion.button type="button" data-testid="send-message-btn" onClick={handleSend} whileTap={reducedMotion ? undefined : { scale: 0.9 }}
            disabled={!input.trim() || [...input].length > 4000 || !canWrite} aria-label={t('messages.send')} className="pp-send">
            <Send size={20} aria-hidden="true" /></motion.button>
        </div>
        {[...input].length > 3500 && <p className={`pp-composer-count ${[...input].length > 4000 ? 'is-over' : ''}`}>{[...input].length}/4000 {t('readiness.characterCount')}</p>}
      </>}
    </footer>
    <SafetyMenu open={showSafety} onClose={() => setShowSafety(false)} onReport={() => safetyAction('report')} onBlock={() => safetyAction('block')}
      onViewContext={() => { setShowSafety(false); setShowContext(true); }} />
    <DialogLayer open={confirmBlock} onClose={() => setConfirmBlock(false)} label={t('messages.blockConfirmTitle')} priority={40}>
      <div className="pp-confirm">
        <h2 className="ui-title-m">{t('messages.blockConfirmTitle')}</h2>
        <p className="ui-small">{t(conv.source === 'FOSTER' ? 'messages.blockConfirmFoster' : 'messages.blockConfirmText')}</p>
        <div className="pp-confirm-actions">
          <button type="button" className="ui-btn ui-btn-danger" onClick={() => runSafety('block')}>{t('messages.block')}</button>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setConfirmBlock(false)}>{t('common.cancel')}</button>
        </div>
      </div>
    </DialogLayer>
  </motion.section>;
}

function getTimeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return t('messages.justNow');
  if (mins < 60) return `${mins}${t('messages.minutesShort')}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t('messages.hoursShort')}`;
  const days = Math.floor(hrs / 24);
  return `${days}${t('messages.daysShort')}`;
}

export default function MessagesTab({ environment = 'match' }) {
  const { t, conversations, messaging, dataSource, requestedConversation, setRequestedConversation } = useApp();
  const { refreshInbox, inboxHasMore, inboxError } = messaging;
  const reduced = useReducedPetMotion();
  const [activeConvId, setActiveConvId] = useState(null);
  const [loading, setLoading] = useState(false);
  // Each space has its own inbox: Match chats never show in Foster, and the other way round.
  const source = environment === 'foster' ? 'FOSTER' : 'MATCH';
  const shown = conversations.filter((conversation) => conversation.source === source);
  const activeConv = shown.find((conversation) => conversation.id === activeConvId);
  const empty = source === 'FOSTER' ? ['messages.noFosterConversations', 'messages.noFosterConversationsDesc', 'house']
    : ['messages.noMatchConversations', 'messages.noMatchConversationsDesc', 'dog'];

  useEffect(() => {
    let alive = true;
    if (dataSource === 'supabase') {
      setLoading(true);
      refreshInbox(source).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [source, dataSource, refreshInbox]);

  useEffect(() => {
    if (!requestedConversation?.id) return;
    let alive = true;
    const open = async () => {
      const existing = conversations.find(c => c.id === requestedConversation.id);
      const conversation = existing || (await refreshInbox(undefined, false, requestedConversation.id))[0];
      if (!alive) return;
      if (conversation && conversation.source !== source && !MATCH_ENABLED) {
        // Match is hidden in this build, so its chats have nowhere to open.
        setRequestedConversation(null);
        return;
      }
      if (conversation && conversation.source !== source) {
        // It belongs to the other space: the app switches there and opens it then.
        if (requestedConversation.source !== conversation.source) {
          setRequestedConversation({ id: conversation.id, source: conversation.source });
        }
        return;
      }
      if (conversation) setActiveConvId(conversation.id);
      setRequestedConversation(null);
    };
    open().catch(() => { if (alive) setRequestedConversation(null); });
    return () => { alive = false; };
  }, [requestedConversation, conversations, refreshInbox, setRequestedConversation, source]);

  return <div data-testid="messages-tab" data-message-source={source} className="pp-inbox ui-page">
    <div className="ui-scroll">
      <PageTitle title={t('messages.inboxTitle')} subtitle={t(source === 'FOSTER' ? 'messages.fosterInboxLede' : 'messages.matchInboxLede')} />
      <div className="ui-gutter pp-inbox-list">
        {inboxError && <Notice tone="error" action={<button type="button" className="ui-notice-close" onClick={() => refreshInbox(source).catch(() => {})}>{t('readiness.retry')}</button>}>{t(inboxError)}</Notice>}
        {loading && !shown.length ? <div className="ui-list" aria-hidden="true">{[0, 1, 2, 3].map(key => <div key={key} className="ui-row">
          <Skeleton width={56} height={56} radius={16} /><span className="ui-row-body"><Skeleton width="30%" height={11} /><Skeleton width="55%" height={16} /><Skeleton width="80%" height={13} /></span></div>)}</div>
          : !shown.length ? <Empty art={empty[2]} title={t(empty[0])} text={t(empty[1])} />
            : <motion.div key={source} className="ui-list ui-list-inset" variants={list} initial={reduced ? false : 'hidden'} animate="show">
              {shown.map((conversation) => <ConversationRow key={conversation.id} conv={conversation} onClick={() => setActiveConvId(conversation.id)} t={t} />)}
            </motion.div>}
        {inboxHasMore[source] && <Button variant="quiet" block disabled={loading} onClick={async () => {
          setLoading(true); try { await refreshInbox(source, true); } catch {} finally { setLoading(false); }
        }}>{t('readiness.more')}</Button>}
      </div>
    </div>
    <OverScreen><AnimatePresence>
      {activeConv && <ConversationThread key={activeConv.id} conv={activeConv} onBack={() => setActiveConvId(null)} t={t} />}
    </AnimatePresence></OverScreen>
  </div>;
}
