import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useReducedPetMotion } from '../components/Motion';
import {
  Badge, EmptyState, SafetyMenu, PrimaryButton, SecondaryButton
} from '../components/SharedComponents';
import {
  MessageCircle, MapPin, Send, ArrowLeft, Info, ChevronDown,
  MoreVertical, Heart, FileText
} from 'lucide-react';
import { useBackHandler } from '../navigation/backNavigation';

function ConversationCard({ conv, onClick, t }) {
  const isMatch = conv.source === 'MATCH';
  const timeAgo = conv.lastMessageAt ? getTimeAgo(conv.lastMessageAt, t) : '';
  const subtitle = getConversationSubtitle(conv, t);

  return (
    <button
      type="button"
      data-testid={`conversation-card-${conv.id}`}
      onClick={onClick}
      aria-label={`${t('messages.openConversation')}: ${conv.title}`}
      className="w-full flex items-start gap-3 p-4 bg-white rounded-2xl border border-[#E4E2DC] hover:bg-[#FAFAF8] transition-colors text-left shadow-sm"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isMatch ? 'bg-[#E3ECE4]' : 'bg-[#F5DDD0]'}`}>
        {conv.animalPhoto ? <img src={conv.animalPhoto} alt="" className="w-full h-full rounded-2xl object-cover" /> : isMatch ? <Heart size={20} className="text-[#2C402B]" /> : <FileText size={20} className="text-[#C07E67]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="text-sm font-semibold text-[#1F2924] truncate font-heading">{conv.title}</h3>
          <span className="text-xs text-[#57645C] flex-shrink-0 ml-2">{timeAgo}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <Badge variant={isMatch ? 'sage' : 'clay'}>
            {conv.socialRequestStatus === 'PENDING' ? t(conv.socialRequestIsMine ? 'readiness.walkPending' : 'readiness.walkIncoming')
              : conv.socialRequestStatus === 'DECLINED' ? t('readiness.walkDeclined')
                : conv.socialRequestStatus === 'ACCEPTED' ? t('readiness.walkAccepted')
                : conv.mode === 'SOCIAL' ? t('matches.social') : isMatch ? t('messages.match') : t('messages.foster')}
          </Badge>
          <span className="text-xs text-[#57645C]">{subtitle}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={11} className="text-[#9BAE96] flex-shrink-0" />
          <span className="text-xs text-[#57645C]">{conv.city}{conv.coarseArea ? ` / ${conv.coarseArea}` : ''}</span>
        </div>
        <p className="text-sm text-[#57645C] truncate mt-1">{conv.lastMessage}</p>
      </div>
      {conv.unread > 0 && (
        <div className="w-5 h-5 rounded-full bg-[#2C402B] text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-1">
          <span aria-label={`${conv.unread} ${t('messages.unreadMessages')}`}>{conv.unread}</span>
        </div>
      )}
    </button>
  );
}

function ConversationThread({ conv, onBack, t }) {
  const { messaging, reportConversation, blockConversation, dataSource, lang, fosterApplications } = useApp();
  const { sendMessage, outbox, drafts, saveDraft, chatError, realtimeReady, openThread, loadThread,
    threadHasMore, loadingThread, markRead, respondToWalk, typingByConversation, startTyping, stopTyping } = messaging;
  const [input, setInput] = useState(drafts[conv.id] || '');
  const [sendError, setSendError] = useState('');
  const [showSafety, setShowSafety] = useState(false);
  const [notice, setNotice] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [responding, setResponding] = useState(false);
  const scroll = useRef(null);
  const atBottom = useRef(true);
  const olderAnchor = useRef(null);
  const sending = useRef(false);
  const reducedMotion = useReducedPetMotion();
  const isMatch = conv.source === 'MATCH';
  const canWrite = !conv.blocked && !conv.fosterReadOnly && (!conv.socialRequestStatus || conv.socialRequestStatus === 'ACCEPTED');
  const application = fosterApplications.find(item => item.id === conv.fosterApplicationId || item.fosterCaseId === conv.fosterCaseId);
  const messages = useMemo(() => conv.blocked ? [] : [...conv.messages, ...outbox.filter(message => message.conversationId === conv.id
    && !conv.messages.some(accepted => accepted.clientMessageId === message.clientMessageId))], [conv.blocked, conv.id, conv.messages, outbox]);
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
      if (atBottom.current && document.visibilityState !== 'hidden' && !conv.blocked) markRead(conv.id, latest);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [conv.id, conv.blocked, latest, markRead]);
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
  return <section data-testid="conversation-thread" className="petpal-fullscreen conversation-thread">
    <header className="chat-header">
      <button type="button" data-testid="back-button" onClick={onBack} aria-label={t('common.back')} className="chat-icon-button"><ArrowLeft size={22} /></button>
      {conv.animalPhoto ? <img src={conv.animalPhoto} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <Heart size={24} className="shrink-0" />}
      <div className="min-w-0 flex-1"><h1 className="font-heading text-lg font-semibold line-clamp-2">{isMatch ? conv.relatedAnimalName : conv.animalName || conv.title}</h1>
        <p className="text-xs text-[#57645C] truncate">{getConversationSubtitle(conv, t)}{conv.otherOwnerName ? ` · ${conv.otherOwnerName}` : ''}</p></div>
      <button type="button" data-testid="safety-menu-trigger" onClick={() => setShowSafety(true)} aria-label={t('messages.safetyMenu')} className="chat-icon-button"><MoreVertical size={22} /></button>
    </header>
    <details className="chat-context" data-testid="conversation-context-panel">
      <summary className="min-h-11 flex items-center gap-2 cursor-pointer"><Info size={16} />{t(conv.mode === 'SOCIAL' ? 'readiness.walkDetails' : isMatch ? 'readiness.matchDetails' : 'messages.fosterContext')}<ChevronDown size={16} className="ml-auto" /></summary>
      <div className="pb-3 space-y-2 text-sm">
        <p className="font-semibold">{conv.title}</p>
        {conv.otherOwnerName && <p>{conv.otherOwnerName}</p>}
        <p>{t(conv.mode === 'SOCIAL' ? 'readiness.walkHint' : isMatch ? 'messages.matchChatContext' : 'messages.fosterChatContext')}</p>
        <p>{[conv.city, conv.coarseArea].filter(Boolean).join(' · ')}</p>
        {conv.organizationName && <p>{conv.organizationName}</p>}
        <p>{t('matches.locationPrivate')}</p>
        <p>{getConversationSubtitle(conv, t)}</p>
        {!isMatch && application && <div className="space-y-2 border-t pt-2">
          <h2 className="font-semibold">{t('messages.applicationDetails')}</h2>
          <ContextRow label={t('common.submitted')} value={getApplicationStatusLabel(application.status, t)} />
          <ContextRow label={t('foster.housingType')} value={application.housingType} />
          <ContextRow label={t('foster.availabilityField')} value={application.availability} />
          <ContextRow label={t('foster.animalExperience')} value={application.experience} />
          <ContextRow label={t('foster.otherPets')} value={application.otherPets} />
          <ContextRow label={t('foster.childrenInHome')} value={application.childrenInHome} />
        </div>}
      </div>
    </details>
    {conv.blocked && <p role="status" className="px-4 py-2 text-sm bg-[#F5DDD0]">{t('readiness.blockedChat')}</p>}
    {conv.fosterReadOnly && <p role="status" className="px-4 py-2 text-sm bg-[#EAF2ED]">{t('care.readOnlyChat')}</p>}
    {notice && <p role="status" className="px-4 py-2 text-sm">{notice}</p>}
    {dataSource === 'supabase' && !realtimeReady && <p role="status" className="px-4 text-xs text-[#57645C]">{t('readiness.refreshing')}</p>}
    {chatError && <div role="alert" className="px-4 text-sm text-[#9B4650]">{t(chatError)} <button type="button" className="underline min-h-11" onClick={() => loadThread(conv.id)}>{t('readiness.retry')}</button></div>}
    {typingByConversation?.[conv.id] && <div data-testid="typing-indicator" role="status" className="px-4 pb-1 text-xs text-[#57645C]">
      <span>{t('motion.typing')}</span>{' '}
      {!reducedMotion && <motion.span aria-hidden="true" className="inline-flex gap-0.5 align-middle" animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}>
        <span>•</span><span>•</span><span>•</span>
      </motion.span>}
    </div>}
    <div ref={scroll} onScroll={scrollChanged} data-testid="message-scroll" className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {threadHasMore[conv.id] && <button type="button" disabled={loadingThread} onClick={loadEarlier} className="min-h-11 w-full text-sm underline">{t('readiness.earlierMessages')}</button>}
      {loadingThread && <p role="status" className="text-center text-xs">{t('readiness.loading')}</p>}
      {messages.map((msg, index) => {
        const day = new Date(msg.createdAt).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB');
        const previousDay = index ? new Date(messages[index - 1].createdAt).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB') : null;
        const messageBubble = <div data-testid="message-bubble" data-status={msg.status || 'sent'} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
          <div className={`chat-bubble ${msg.isMine ? 'chat-bubble-mine' : ''}`}>
            {!msg.isMine && <p className="text-xs font-semibold mb-1">{msg.senderDisplayName}</p>}
            <p className="whitespace-pre-wrap break-words text-sm">{msg.body}</p>
            <p className="text-[11px] mt-1 text-[#57645C]">{new Date(msg.createdAt).toLocaleTimeString(lang === 'ro' ? 'ro-RO' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
              {msg.isMine && ` · ${t(msg.status === 'sending' ? 'readiness.sending' : msg.status === 'failed' ? 'readiness.failed' : 'readiness.sent')}`}</p>
            {msg.status === 'failed' && <div role="alert" className="text-xs mt-2">
              <p>{t('readiness.sendFailed')}</p>
              <button type="button" data-testid="retry-message" disabled={!canWrite} className="underline font-semibold min-h-11"
                onClick={() => sendMessage(conv.id, msg.body, msg.clientMessageId).catch(error => setSendError(t(error.message)))}>{t('readiness.retryMessage')}</button>
            </div>}
          </div>
        </div>;
        const shouldAnimate = !seenMessages.current.has(messageKey(msg)) && (msg.isNew || msg.status === 'sending');
        return <React.Fragment key={messageKey(msg)}>
          {day !== previousDay && <p className="text-center text-xs text-[#57645C] py-2">{day}</p>}
          <motion.div initial={shouldAnimate && !reducedMotion ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.24 }}>{messageBubble}</motion.div>
        </React.Fragment>;
      })}
    </div>
    {newMessages && <button type="button" className="shrink-0 text-sm py-2 bg-[#E3ECE4]" onClick={() => {
      atBottom.current = true; scroll.current.scrollTop = scroll.current.scrollHeight; setNewMessages(false); markRead(conv.id, latest);
    }}>{t('readiness.newMessages')}</button>}
    <footer className="chat-composer">
      {sendError && <p role="alert" className="text-sm text-[#9B4650] mb-2">{sendError}</p>}
      {conv.socialRequestStatus && conv.socialRequestStatus !== 'ACCEPTED' && !conv.blocked ? <div className="space-y-2">
        <p role="status" className="text-sm">{t(conv.socialRequestStatus === 'DECLINED' ? 'readiness.walkDeclinedHint'
          : conv.socialRequestIsMine ? 'readiness.walkPendingHint' : 'readiness.walkIncomingHint')}</p>
        {conv.socialRequestStatus === 'PENDING' && !conv.socialRequestIsMine && <>
          <div className="flex gap-2">
            <PrimaryButton disabled={responding} onClick={() => respond(true)}>{t('readiness.walkAccept')}</PrimaryButton>
            <SecondaryButton disabled={responding} onClick={() => respond(false)}>{t('readiness.walkDecline')}</SecondaryButton>
          </div>
          <button type="button" disabled={responding} className="min-h-11 underline text-sm" onClick={() => safetyAction('block')}>{t('readiness.walkBlock')}</button>
        </>}
      </div> : <>
      <div className="flex items-end gap-2">
        <textarea data-testid="message-input" rows={1} value={input} disabled={!canWrite}
          onChange={event => { const value = event.target.value; setInput(value); if (value.trim()) startTyping(conv.id); else stopTyping(conv.id); if (!saveDraft(conv.id, value)) setSendError(t('readiness.storageFailed')); }}
          onBlur={() => stopTyping(conv.id)}
          aria-label={t('messages.messageInput')} placeholder={t(conv.blocked ? 'messages.blockedPlaceholder' : 'messages.typeMessage')}
          className="min-w-0 flex-1 resize-none rounded-2xl border border-[#D5D5CE] bg-[#F8F7F4] p-3 text-base max-h-32"
          onInput={event => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(128, event.target.scrollHeight)}px`; }} />
        <button type="button" data-testid="send-message-btn" onClick={handleSend} disabled={!input.trim() || [...input].length > 4000 || !canWrite}
          aria-label={t('messages.send')} className="chat-send"><Send size={21} /></button>
      </div>
      {input.length > 0 && <p className={`text-xs mt-1 ${[...input].length > 4000 ? 'text-[#9B4650]' : 'text-[#57645C]'}`}>{[...input].length}/4000 {t('readiness.characterCount')}</p>}
      </>}
    </footer>
    <SafetyMenu open={showSafety} onClose={() => setShowSafety(false)} onReport={() => safetyAction('report')} onBlock={() => safetyAction('block')}
      onViewContext={() => { setShowSafety(false); document.querySelector('[data-testid="conversation-context-panel"]')?.setAttribute('open', ''); }} />
  </section>;
}

function getConversationSubtitle(conv, t) {
  if (conv.source === 'FOSTER') {
    return conv.fosterRequestId ? t(`care.${conv.fosterStatus}`) : (conv.subtitle || t('messages.foster'));
  }

  const modeLabels = {
    PLAY: t('matches.play'),
    SOCIAL: t('matches.social'),
    VERIFIED_MATE: t('matches.verifiedMate'),
  };

  return modeLabels[conv.mode] || conv.subtitle || t('messages.match');
}

function getApplicationStatusLabel(status, t) {
  const statusLabels = {
    DRAFT: t('common.draft'),
    SUBMITTED: t('common.submitted'),
    IN_REVIEW: t('common.inReview'),
    ACCEPTED: t('common.accepted'),
    REJECTED: t('common.rejected'),
    WITHDRAWN: t('common.withdrawn'),
    COMPLETED: t('common.completed'),
  };

  return statusLabels[status] || status || t('common.unknown');
}

function ContextRow({ label, value }) {
  if (!value) return null;

  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[#57645C]">{label}</span>
      <span className="font-medium text-[#1F2924] text-right">{value}</span>
    </div>
  );
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

export default function MessagesTab({ source = 'MATCH' }) {
  const { t, conversations, messaging, dataSource, requestedConversation, setRequestedConversation, requestOpenConversation } = useApp();
  const { refreshInbox, inboxHasMore, chatError } = messaging;
  const [activeConvId, setActiveConvId] = useState(null);
  const [loading, setLoading] = useState(false);
  const isMatchInbox = source === 'MATCH';
  const scopedConversations = conversations.filter((conversation) => conversation.source === source);
  const activeConv = scopedConversations.find((conversation) => conversation.id === activeConvId);
  const title = isMatchInbox ? t('messages.matchMessagesTitle') : t('messages.fosterMessagesTitle');
  const subtitle = isMatchInbox ? t('messages.matchMessagesSubtitle') : t('messages.fosterMessagesSubtitle');
  const emptyTitle = isMatchInbox ? t('messages.noMatchConversations') : t('messages.noFosterConversations');
  const emptyDescription = isMatchInbox
    ? t('messages.noMatchConversationsDesc')
    : t('messages.noFosterConversationsDesc');

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
      if (conversation?.source && conversation.source !== source) {
        requestOpenConversation(conversation.id, conversation.source);
        return;
      }
      if (conversation) setActiveConvId(conversation.id);
      setRequestedConversation(null);
    };
    open().catch(() => { if (alive) setRequestedConversation(null); });
    return () => { alive = false; };
  }, [requestedConversation, conversations, source, refreshInbox, requestOpenConversation, setRequestedConversation]);

  useEffect(() => {
    document.body.classList.toggle('petpal-thread-open', Boolean(activeConv));

    return () => {
      document.body.classList.remove('petpal-thread-open');
    };
  }, [activeConv]);

  if (activeConv) {
    return <ConversationThread conv={activeConv} onBack={() => setActiveConvId(null)} t={t} />;
  }

  return (
    <div
      data-testid="messages-tab"
      data-message-source={source}
      className="min-h-0 flex-1 flex flex-col"
    >
      <div className="px-5 pt-4 pb-3 bg-[#F8F7F4]">
        <h1 className="text-2xl font-bold text-[#1F2924] tracking-tight font-heading">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#57645C]">{subtitle}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pt-3 pb-20">
        {chatError && <div role="alert" className="text-sm text-[#9B4650]">{t(chatError)} <button type="button" className="min-h-11 underline" onClick={() => refreshInbox(source).catch(() => {})}>{t('readiness.retry')}</button></div>}
        {loading && <p role="status">{t('readiness.loading')}</p>}
        {!loading && scopedConversations.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <div className="space-y-2">
            {scopedConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conv={conversation}
                onClick={() => setActiveConvId(conversation.id)}
                t={t}
              />
            ))}
            {inboxHasMore[source] && <button type="button" disabled={loading} className="min-h-11 w-full underline" onClick={async () => {
              setLoading(true); try { await refreshInbox(source, true); } catch {} finally { setLoading(false); }
            }}>{t('readiness.more')}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
