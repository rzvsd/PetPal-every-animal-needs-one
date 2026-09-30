import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Art, Button, Notice, TextField } from '../ui/kit';

// Shown after the reset link from the email signed the person in: one field,
// the new password. Cancel signs out again.
export default function NewPassword() {
  const { t, authLoading, authError, saveNewPassword, signOut } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    if (password.length < 8) { setError(t('auth.passwordRequired')); return; }
    setError('');
    await saveNewPassword(password);
  };

  return <main data-testid="new-password-screen" className="pp-auth ui-scroll">
    <div className="pp-auth-inner">
      <header className="pp-auth-brand">
        <Art name="paw" size={88} />
        <h1 className="ui-title-xl">{t('auth.newPasswordTitle')}</h1>
        <p className="ui-lede">{t('auth.newPasswordLede')}</p>
      </header>
      <form className="pp-auth-form" onSubmit={submit} noValidate>
        <TextField label={t('auth.newPassword')} type="password" autoComplete="new-password" autoFocus
          value={password} error={error} hint={t('auth.passwordHint')} onChange={event => { setPassword(event.target.value); setError(''); }} />
        {authError && <Notice tone="error">{authError}</Notice>}
        <Button type="submit" block busy={authLoading}>{t('auth.savePassword')}</Button>
        <Button type="button" variant="quiet" block disabled={authLoading} onClick={signOut}>{t('common.cancel')}</Button>
      </form>
    </div>
  </main>;
}
