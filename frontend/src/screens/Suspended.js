import React from 'react';
import { useApp } from '../context/AppContext';
import { SUPPORT_EMAIL } from '../services/support';
import { Button, Empty, fmt } from '../ui/kit';

// A suspended account sees why PetPal stopped working for them, not a broken app.
export default function Suspended({ suspension }) {
  const { t, lang, signOut } = useApp();
  const until = suspension.endsAt
    ? fmt(t('auth.suspendedUntil'), { date: new Date(suspension.endsAt).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) })
    : t('auth.suspendedOpen');
  const contact = SUPPORT_EMAIL ? fmt(t('auth.suspendedContact'), { email: SUPPORT_EMAIL }) : '';
  return <div role="alert" className="pp-state">
    <Empty art="paw" title={t('auth.suspendedTitle')} text={[until, t('auth.suspendedText'), contact].filter(Boolean).join(' ')}
      action={<Button variant="secondary" onClick={() => signOut()}>{t('auth.suspendedSignOut')}</Button>} />
  </div>;
}
