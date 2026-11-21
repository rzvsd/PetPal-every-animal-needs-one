import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Art, Button, Notice, Segment, TextField } from '../ui/kit';
import { expand } from '../ui/motion';

const emptyForm = { displayName: '', city: 'Bucharest', coarseArea: '', email: '', password: '', ageConfirmed: false, termsAccepted: false };
// The screen unmounts while a sign-in or sign-up is checked; what was typed
// waits here in memory (never in storage) so a failed attempt keeps it.
const remembered = { form: emptyForm, mode: 'login' };

export default function AuthScreen() {
  const {
    t, lang, setLang, authLoading, authError, authNotice, signIn, signUp, signInDemo, continueLocalDemo, requestPasswordReset,
    backendStatus, refreshSupabaseData, localDemoAvailable, demoSupabaseLoginAvailable,
  } = useApp();
  const [mode, setModeState] = useState(remembered.mode);
  // The password survives only a failed attempt, never a later visit.
  const [form, setFormState] = useState(() => (authError ? remembered.form : { ...remembered.form, password: '' }));
  const setMode = next => { remembered.mode = next; setModeState(next); };
  const setForm = next => setFormState(current => { remembered.form = typeof next === 'function' ? next(current) : next; return remembered.form; });
  const [errors, setErrors] = useState({});
  const register = mode === 'register';
  const reset = mode === 'reset';

  const update = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
    const consent = key === 'ageConfirmed' || key === 'termsAccepted';
    setErrors(current => ({ ...current, [key]: undefined, ...(consent ? { consent: undefined } : {}) }));
  };

  const validate = () => {
    const found = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = t('auth.emailRequired');
    if (reset) return found;
    if (!form.password) found.password = t('auth.passwordMissing');
    else if (register && form.password.length < 8) found.password = t('auth.passwordRequired');
    if (register) {
      if (form.displayName.trim().length < 2) found.displayName = t('auth.nameRequired');
      if (form.city.trim().length < 2) found.city = t('auth.cityRequired');
      if (!form.ageConfirmed || !form.termsAccepted) found.consent = t('auth.consentRequired');
    }
    return found;
  };

  const submit = async event => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      // Take the person straight to the first thing to fix.
      requestAnimationFrame(() => document.querySelector('.pp-auth-form [aria-invalid="true"]')?.focus());
      return;
    }
    if (reset) { await requestPasswordReset(form.email.trim()); return; }
    if (!register) { await signIn({ email: form.email.trim(), password: form.password }); return; }
    await signUp({
      email: form.email.trim(), password: form.password, displayName: form.displayName.trim(), city: form.city.trim(),
      coarseArea: form.coarseArea.trim(), ageConfirmed: form.ageConfirmed, termsAccepted: form.termsAccepted,
    });
  };

  return <main data-testid="auth-screen" className="pp-auth ui-scroll">
    <div className="pp-auth-inner">
      <div className="pp-auth-lang">
        <Segment label={t('profile.language')} value={lang} onChange={setLang} options={[['ro', 'RO'], ['en', 'EN']]} />
      </div>

      <header className="pp-auth-brand">
        <Art name="paw" size={88} />
        <h1 className="ui-display pp-wordmark">PetPal</h1>
        <p className="ui-lede">{t('intro.tagline')}</p>
      </header>

      {backendStatus.message === 'readiness.loadError' && <Notice tone="error" action={
        <button type="button" className="ui-notice-close" disabled={backendStatus.loading} onClick={() => refreshSupabaseData().catch(() => {})}>{t('readiness.retry')}</button>}>
        {t('errors.network')}</Notice>}

      {reset ? <div className="pp-auth-reset-intro">
        <h2 className="ui-title-m">{t('auth.resetTitle')}</h2>
        <p className="ui-small">{t('auth.resetLede')}</p>
      </div> : <Segment variant="underline" label={t('auth.login')} value={mode} className="pp-auth-modes"
        onChange={next => { setMode(next); setErrors({}); }} options={[['login', t('auth.login')], ['register', t('auth.register')]]} />}

      <form className="pp-auth-form" onSubmit={submit} noValidate>
        <AnimatePresence initial={false}>
          {register && <motion.div key="identity" className="pp-auth-group" {...expand}>
            <TextField label={t('profile.displayName')} value={form.displayName} error={errors.displayName} autoComplete="name"
              onChange={event => update('displayName', event.target.value)} />
            <div className="pp-auth-pair">
              <TextField label={t('profile.city')} value={form.city} error={errors.city} autoComplete="address-level2"
                onChange={event => update('city', event.target.value)} />
              <TextField label={t('profile.coarseArea')} value={form.coarseArea} autoComplete="address-level3"
                onChange={event => update('coarseArea', event.target.value)} />
            </div>
          </motion.div>}
        </AnimatePresence>

        <TextField label={t('profile.email')} type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
          value={form.email} error={errors.email} placeholder={t('auth.emailPlaceholder')} onChange={event => update('email', event.target.value)} />
        {!reset && <TextField label={t('auth.password')} type="password" autoComplete={register ? 'new-password' : 'current-password'}
          value={form.password} error={errors.password} hint={register ? t('auth.passwordHint') : undefined}
          onChange={event => update('password', event.target.value)} />}
        {!register && <button type="button" className="pp-auth-link" onClick={() => { setMode(reset ? 'login' : 'reset'); setErrors({}); }}>
          {t(reset ? 'auth.backToLogin' : 'auth.forgotPassword')}</button>}

        <AnimatePresence initial={false}>
          {register && <motion.div key="consent" className="pp-auth-group" {...expand}>
            <label className="ui-check"><input type="checkbox" checked={form.ageConfirmed} onChange={event => update('ageConfirmed', event.target.checked)} />
              <span>{t('auth.ageConfirm')}</span></label>
            <label className="ui-check"><input type="checkbox" checked={form.termsAccepted} onChange={event => update('termsAccepted', event.target.checked)} />
              <span>{t('auth.termsConfirm')}</span></label>
            <details className="pp-auth-terms">
              <summary>{t('auth.readTerms')}</summary>
              <ul>{[1, 2, 3, 4].map(n => <li key={`terms-${n}`}>{t(`profile.termsBullet${n}`)}</li>)}
                {[1, 2, 3, 4].map(n => <li key={`privacy-${n}`}>{t(`profile.privacyPolicyBullet${n}`)}</li>)}</ul>
            </details>
            {errors.consent && <p role="alert" className="ui-field-error">{errors.consent}</p>}
          </motion.div>}
        </AnimatePresence>

        <AnimatePresence>{authError && <Notice key="error" tone="error">{authError}</Notice>}
          {authNotice && !authError && <Notice key="notice" tone="success">{authNotice}</Notice>}</AnimatePresence>

        <Button type="submit" block busy={authLoading}>{t(reset ? 'auth.sendResetLink' : register ? 'auth.createAccount' : 'auth.login')}</Button>
      </form>

      {(demoSupabaseLoginAvailable || localDemoAvailable) && <div className="pp-auth-demo">
        {demoSupabaseLoginAvailable && <Button variant="quiet" onClick={signInDemo} disabled={authLoading}>{t('auth.useDemoAccount')}</Button>}
        {localDemoAvailable && <Button variant="quiet" onClick={continueLocalDemo} disabled={authLoading}>{t('auth.continueLocalDemo')}</Button>}
      </div>}
    </div>
  </main>;
}
