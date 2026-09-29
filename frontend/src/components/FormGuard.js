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
    <div className="p-5 space-y-4">
      <h2 className="font-heading text-xl font-semibold">{t('motion.discardTitle')}</h2>
      <p className="text-sm text-[#57645C]">{t('motion.discardDescription')}</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="petpal-button-primary" onClick={() => setConfirm(false)}>{t('motion.keepEditing')}</button>
        <button type="button" className="petpal-button-danger" disabled={busy}
          onClick={() => { if (!busy) { setConfirm(false); onClose(); } }}>{t('motion.discard')}</button>
      </div>
    </div>
  </DialogLayer>;
  return { requestClose, discardDialog };
}
