import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { reportFosterItem } from '../services/fosterApi';
import { SUPPORT_EMAIL } from '../services/support';
import { Button, Choices, Field, Notice, Sheet, fmt } from '../foster/ui';
import '../foster/foster.css';

export const reportSentText = t =>
  `${t('care.reportSent')} ${SUPPORT_EMAIL ? fmt(t('fx.supportEmailLine'), { email: SUPPORT_EMAIL }) : t('fx.supportInAppLine')}`;

// One report sheet for animals, homes, placements and chats.
// target: { profileId, listingId, conversationId, category }. A chat report
// also sends the last messages to moderators, so the sheet says so.
export default function ReportSheet({ target, onClose, onSent }) {
  const { t, reportConversation } = useApp();
  const [category, setCategory] = useState('SPAM');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (target) { setCategory(target.category || 'SPAM'); setDetails(''); setError(''); } }, [target]);
  const send = async () => {
    setBusy(true); setError('');
    try {
      if (target.conversationId) await reportConversation(target.conversationId, details, category);
      else await reportFosterItem({ profileId: target.profileId, listingId: target.listingId, category, details });
      onSent();
    } catch (failure) { setError(friendlyError(failure, t)); }
    finally { setBusy(false); }
  };
  return <Sheet open={Boolean(target)} onClose={onClose} title={t('fx.report')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="danger" disabled={busy || !details.trim()} onClick={send}>{t('fx.report')}</Button></>}>
    <Field label={t('fx.reportWhy')}><Choices label={t('fx.reportWhy')} value={category} onChange={setCategory} columns={2}
      options={[['ANIMAL_DANGER', t('fx.reportDanger')], ['SPAM', t('fx.reportSpam')], ['ABUSE', t('fx.reportAbuse')], ['MISLEADING', t('fx.reportMisleading')], ['OTHER', t('fx.reportOther')]]} /></Field>
    {category === 'ANIMAL_DANGER' && <Notice>{t('fx.reportDangerHint')}</Notice>}
    <Field label={t('care.details')}><textarea className="fx-input" maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} /></Field>
    {target?.conversationId && <p className="fx-muted">{t('fx.reportChatContext')}</p>}
    {error && <Notice tone="error">{error}</Notice>}
  </Sheet>;
}
