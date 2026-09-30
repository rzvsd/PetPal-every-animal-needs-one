import React, { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import DialogLayer from './DialogLayer';

export function useDiscardGuard({ dirty, busy, onClose }) {
  const { t } = useApp();
  const [confirm, setConfirm] = useState(false);
  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) setConfirm(true);
    else onClose();
  }, [busy, dirty, onClose]);
  const discardDialog = <DialogLayer open={confirm} onClose={() => setConfirm(false)}
    label={t('motion.discardTitle')} priority={40}>
    <div className="pp-confirm">
      <h2 className="ui-title-m">{t('motion.discardTitle')}</h2>
      <p className="ui-small">{t('motion.discardDescription')}</p>
      <div className="pp-confirm-actions">
        <button type="button" className="ui-btn ui-btn-danger" disabled={busy}
          onClick={() => { if (!busy) { setConfirm(false); onClose(); } }}>{t('motion.discard')}</button>
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => setConfirm(false)}>{t('motion.keepEditing')}</button>
      </div>
    </div>
  </DialogLayer>;
  return { requestClose, discardDialog };
}
