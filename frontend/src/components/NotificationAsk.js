import React from 'react';
import { BellRing } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DialogLayer from './DialogLayer';
import { Button } from '../foster/ui';

// Asked once, right after something the person will want news about,
// instead of a bare system prompt straight after login.
export default function NotificationAsk() {
  const { t, notifyAsk, pushStatus, answerNotifyAsk } = useApp();
  const open = Boolean(notifyAsk) && pushStatus.status === 'not-asked';
  return <DialogLayer open={open} onClose={() => answerNotifyAsk(false)} sheet label={t('notify.title')}>
    <div className="fx-sheet" style={{ textAlign: 'center' }}>
      <span className="fx-intent-icon is-green" style={{ margin: '4px auto 12px' }} aria-hidden="true"><BellRing size={26} /></span>
      <h2 className="fx-sheet-title">{t(`notify.${notifyAsk}Title`)}</h2>
      <p className="fx-muted" style={{ marginTop: 6 }}>{t('notify.body')}</p>
      <div className="fx-sheet-footer">
        <Button variant="secondary" onClick={() => answerNotifyAsk(false)}>{t('notify.later')}</Button>
        <Button onClick={() => answerNotifyAsk(true)}>{t('notify.allow')}</Button>
      </div>
    </div>
  </DialogLayer>;
}
