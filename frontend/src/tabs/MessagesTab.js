import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Badge, ScreenHeader, EmptyState, SafetyMenu, Modal
} from '../components/SharedComponents';
import {
  MessageCircle, ShieldCheck, MapPin, Lock, Send,
  MoreVertical, Heart, FileText
} from 'lucide-react';

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
        {isMatch ? <Heart size={20} className="text-[#2C402B]" /> : <FileText size={20} className="text-[#C07E67]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="text-sm font-semibold text-[#1F2924] truncate font-heading">{conv.title}</h3>
          <span className="text-xs text-[#57645C] flex-shrink-0 ml-2">{timeAgo}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <Badge variant={isMatch ? 'sage' : 'clay'}>
            {isMatch ? t('messages.match') : t('messages.foster')}
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
  const { sendMessage, reportConversation, blockConversation, setActiveTab, fosterApplications } = useApp();
  const [input, setInput] = useState('');
  const [showSafety, setShowSafety] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showApplicationDetails, setShowApplicationDetails] = useState(false);
  const [reported, setReported] = useState(Boolean(conv.reported));
  const [blocked, setBlocked] = useState(Boolean(conv.blocked));
  const [safetyNotice, setSafetyNotice] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv.messages]);

  const handleSend = () => {
    if (!input.trim() || blocked) return;
    sendMessage(conv.id, input.trim());
    setInput('');
  };

  const handleReport = async () => {
    setShowSafety(false);
    try {
      await reportConversation(conv.id, `${conv.title}: ${t('messages.conversationReported')}`);
      setReported(true);
      setSafetyNotice(t('messages.conversationReported'));
    } catch (error) {
      setSafetyNotice(error.message || t('messages.reportFailed'));
    }
  };

  const handleBlock = async () => {
    setShowSafety(false);
    try {
      await blockConversation(conv.id);
      setBlocked(true);
      setSafetyNotice(t('messages.userBlocked'));
    } catch (error) {
      setSafetyNotice(error.message || t('messages.blockFailed'));
    }
  };

  const isMatch = conv.source === 'MATCH';
  const subtitle = getConversationSubtitle(conv, t);
  const contextLabel = isMatch ? t('messages.matchChatContext') : t('messages.fosterChatContext');
  const privacyLabel = t('matches.locationPrivate');
  const contextActionText = isMatch
    ? t('messages.matchContextNotice')
    : t('messages.fosterContextNotice');
  const fosterApplication = fosterApplications.find(app =>
    app.id === conv.fosterApplicationId || app.fosterCaseId === conv.fosterCaseId
  );

  const openContext = () => {
    setShowContext(true);
    setShowApplicationDetails(false);
    setSafetyNotice(contextActionText);
  };

  const openContextTab = (tab) => {
    setShowContext(false);
    onBack();
    setActiveTab(tab);
  };

  return (
    <div data-testid="conversation-thread" className="absolute inset-0 z-[60] bg-[#F8F7F4] flex flex-col">
      <ScreenHeader
        title={conv.title}
        onBack={onBack}
        right={
          <button
            type="button"
            data-testid="safety-menu-trigger"
            onClick={() => setShowSafety(true)}
            aria-label={t('messages.safetyMenu')}
            className="p-2 rounded-lg hover:bg-[#F0EDE8] transition-colors"
          >
            <MoreVertical size={20} className="text-[#57645C]" />
          </button>
        }
      />

      <div className={`mx-4 mt-2 mb-2 p-3 rounded-2xl border ${isMatch ? 'bg-[#E3ECE4]/30 border-[#E3ECE4]' : 'bg-[#F5DDD0]/30 border-[#F5DDD0]'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant={isMatch ? 'sage' : 'clay'}>
            {isMatch ? t('messages.match') : t('messages.foster')}
          </Badge>
          <span className="text-xs text-[#57645C]">{subtitle}</span>
        </div>
        {conv.organizationName && (
          <div className="flex items-center gap-1.5 text-xs text-[#57645C] mb-1">
            <ShieldCheck size={12} className="text-[#9BAE96]" />
            <span className="font-medium">{conv.organizationName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-[#57645C] mb-1">
          <MapPin size={11} className="text-[#9BAE96]" />
          <span>{conv.city}{conv.coarseArea ? ` / ${conv.coarseArea}` : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#3A7080]">
          <Lock size={11} />
          <span>{privacyLabel}</span>
        </div>
        <p className="text-xs text-[#57645C] mt-2 italic">{contextLabel}</p>
        <button
          type="button"
          onClick={openContext}
          className="mt-2 text-xs font-semibold text-[#2C402B] underline underline-offset-2"
        >
          {isMatch ? t('messages.viewMatchDetails') : t('messages.fosterContext')}
        </button>
        {(reported || blocked || safetyNotice) && (
          <div className="mt-2 rounded-xl border border-[#E4E2DC] bg-white px-3 py-2 text-xs text-[#57645C]">
            {blocked ? t('messages.userBlocked') : reported ? t('messages.conversationReported') : safetyNotice}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 no-scrollbar">
        {conv.messages.map(msg => (
          <div key={msg.messageId} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.isMine
                ? 'bg-[#2C402B] text-white rounded-br-md'
                : 'bg-white border border-[#E4E2DC] text-[#1F2924] rounded-bl-md'
            }`}>
              {!msg.isMine && (
                <p className="text-xs font-semibold text-[#2C402B] mb-0.5">{msg.senderDisplayName}</p>
              )}
              <p className="text-sm leading-relaxed">{msg.body}</p>
              <p className={`text-xs mt-1 ${msg.isMine ? 'text-white/60' : 'text-[#57645C]'}`}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-lg border-t border-[#E4E2DC]/60">
        <div className="flex items-center gap-2">
          <input
            data-testid="message-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={blocked}
            aria-label={t('messages.messageInput')}
            placeholder={blocked ? t('messages.blockedPlaceholder') : t('messages.typeMessage')}
            className="flex-1 bg-[#F8F7F4] border border-[#E4E2DC] rounded-xl px-4 py-3 text-sm text-[#1F2924] placeholder:text-[#57645C]/50 focus:outline-none focus:ring-2 focus:ring-[#9BAE96] transition-all"
          />
          <button
            type="button"
            data-testid="send-message-btn"
            onClick={handleSend}
            disabled={!input.trim() || blocked}
            aria-label={t('messages.send')}
            className="w-11 h-11 rounded-xl bg-[#2C402B] text-white flex items-center justify-center hover:bg-[#243623] active:scale-[0.95] transition-all disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <SafetyMenu
        open={showSafety}
        onClose={() => setShowSafety(false)}
        onReport={handleReport}
        onBlock={handleBlock}
        onViewContext={() => {
          openContext();
          setShowSafety(false);
        }}
      />

      <Modal open={showContext} onClose={() => setShowContext(false)}>
        <div data-testid="conversation-context-panel" className="p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#1F2924] font-heading">
              {isMatch ? t('messages.viewMatchDetails') : t('messages.fosterContext')}
            </h3>
            <p className="text-sm text-[#57645C] mt-1">{contextLabel}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={isMatch ? 'sage' : 'clay'}>{isMatch ? t('messages.match') : t('messages.foster')}</Badge>
            <Badge variant="default">{subtitle}</Badge>
            {conv.ownerVerified && <Badge variant="success">{t('messages.ownerVerified')}</Badge>}
            {conv.organizationVerified && <Badge variant="success">{t('messages.verifiedRescuer')}</Badge>}
          </div>

          <div className="rounded-2xl border border-[#E4E2DC] bg-[#F8F7F4] p-4 space-y-2">
            <ContextRow label={isMatch ? t('messages.myAnimal') : t('messages.animal')} value={conv.animalName || conv.title} />
            {isMatch && <ContextRow label={t('messages.matchedAnimal')} value={conv.relatedAnimalName} />}
            {!isMatch && <ContextRow label={t('messages.rescuerShelter')} value={conv.organizationName || t('foster.rescuer')} />}
            <ContextRow label={t('messages.location')} value={`${conv.city}${conv.coarseArea ? ` / ${conv.coarseArea}` : ''}`} />
            <ContextRow label={t('messages.privacy')} value={privacyLabel} />
          </div>

          {showApplicationDetails && (
            <div className="rounded-2xl border border-[#E4E2DC] bg-white p-4 space-y-2">
              <h4 className="text-sm font-semibold text-[#1F2924]">{t('messages.applicationDetails')}</h4>
              {fosterApplication ? (
                <>
                  <ContextRow label={t('common.submitted')} value={getApplicationStatusLabel(fosterApplication.status, t)} />
                  <ContextRow label={t('foster.housingType')} value={fosterApplication.housingType} />
                  <ContextRow label={t('foster.availabilityField')} value={fosterApplication.availability} />
                  <ContextRow label={t('foster.animalExperience')} value={fosterApplication.experience} />
                  <ContextRow label={t('foster.otherPets')} value={fosterApplication.otherPets} />
                  <ContextRow label={t('foster.childrenInHome')} value={fosterApplication.childrenInHome} />
                  <ContextRow label={t('foster.canTransport')} value={fosterApplication.canTransport ? t('common.yes') : t('common.no')} />
                  <ContextRow label={t('foster.canHandleMedical')} value={fosterApplication.canHandleMedicalNeeds ? t('common.yes') : t('common.no')} />
                </>
              ) : (
                <p className="text-sm text-[#57645C]">{t('messages.noApplicationDetails')}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => openContextTab(isMatch ? 'matches' : 'foster')}
              className="w-full rounded-xl bg-[#2C402B] py-3 text-sm font-semibold text-white hover:bg-[#243623] transition-colors"
            >
              {isMatch ? t('messages.openMatchesTab') : t('messages.openFosterTab')}
            </button>
            {!isMatch && (
              <button
                type="button"
                onClick={() => setShowApplicationDetails(current => !current)}
                className="w-full rounded-xl border border-[#E4E2DC] bg-[#F8F7F4] py-3 text-sm font-semibold text-[#2C402B] hover:bg-[#EFEDE8] transition-colors"
              >
                {t('messages.viewApplication')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowContext(false)}
              className="w-full rounded-xl border border-[#E4E2DC] py-3 text-sm font-semibold text-[#57645C] hover:bg-[#F8F7F4] transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function getConversationSubtitle(conv, t) {
  if (conv.source === 'FOSTER') {
    return conv.fosterStatus === 'ACCEPTED' ? t('messages.applicationAccepted') : (conv.subtitle || t('messages.foster'));
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

export default function MessagesTab() {
  const { t, conversations } = useApp();
  const [filter, setFilter] = useState('all');
  const [activeConv, setActiveConv] = useState(null);

  const filters = [
    { key: 'all', label: t('messages.all') },
    { key: 'matches', label: t('messages.matchesFilter') },
    { key: 'foster', label: t('messages.fosterFilter') },
  ];

  const filtered = conversations.filter(c => {
    if (filter === 'matches') return c.source === 'MATCH';
    if (filter === 'foster') return c.source === 'FOSTER';
    return true;
  });

  const matchConvs = filtered.filter(c => c.source === 'MATCH');
  const fosterConvs = filtered.filter(c => c.source === 'FOSTER');

  if (activeConv) {
    return <ConversationThread conv={activeConv} onBack={() => setActiveConv(null)} t={t} />;
  }

  return (
    <div data-testid="messages-tab" className="flex-1 flex flex-col">
      <div className="px-5 pt-4 pb-3 bg-[#F8F7F4]">
        <h1 className="text-2xl font-bold text-[#1F2924] tracking-tight font-heading mb-3">{t('messages.title')}</h1>

        <div className="flex gap-1 bg-[#EFEDE8] rounded-xl p-1">
          {filters.map(f => (
            <button
              type="button"
              key={f.key}
              data-testid={`messages-filter-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === f.key ? 'bg-white text-[#1F2924] shadow-sm' : 'text-[#57645C]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3 pb-20 space-y-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={t('messages.noConversations')}
            description={t('messages.noConversationsDesc')}
          />
        ) : filter === 'all' ? (
          <>
            {matchConvs.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('messages.matchesFilter')}</h3>
                <div className="space-y-2">
                  {matchConvs.map(c => (
                    <ConversationCard key={c.id} conv={c} onClick={() => setActiveConv(c)} t={t} />
                  ))}
                </div>
              </div>
            )}
            {fosterConvs.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#57645C] uppercase tracking-wider mb-2">{t('messages.fosterFilter')}</h3>
                <div className="space-y-2">
                  {fosterConvs.map(c => (
                    <ConversationCard key={c.id} conv={c} onClick={() => setActiveConv(c)} t={t} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <ConversationCard key={c.id} conv={c} onClick={() => setActiveConv(c)} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
