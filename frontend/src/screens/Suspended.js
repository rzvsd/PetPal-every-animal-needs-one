import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SUPPORT_EMAIL } from '../services/support';
import { Button, Empty, fmt } from '../ui/kit';

// A suspended account sees why PetPal stopped working for them, not a broken app.
export default function Suspended({ suspension }) {
  const { t, lang, signOut, refreshSupabaseData } = useApp();
  const [checking, setChecking] = useState(false);
  // A suspension can end or be lifted while this screen is open.
  const checkAgain = () => { setChecking(true); refreshSupabaseData().catch(() => {}).finally(() => setChecking(false)); };
  const until = suspension.endsAt
    ? fmt(t('auth.suspendedUntil'), { date: new Date(suspension.endsAt).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) })
    : t('auth.suspendedOpen');
  const contact = SUPPORT_EMAIL ? fmt(t('auth.suspendedContact'), { email: SUPPORT_EMAIL }) : '';
  return <div role="alert" className="pp-state">
    <Empty art="paw" title={t('auth.suspendedTitle')} text={[until, t('auth.suspendedText'), contact].filter(Boolean).join(' ')}
      action={<div className="pp-confirm-actions"><Button busy={checking} onClick={checkAgain}>{t('auth.suspendedCheck')}</Button>
        <Button variant="secondary" onClick={() => signOut()}>{t('auth.suspendedSignOut')}</Button></div>} />
  </div>;
}
