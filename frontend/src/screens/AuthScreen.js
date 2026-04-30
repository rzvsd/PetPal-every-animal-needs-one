import React, { useState } from 'react';
import { Heart, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrimaryButton, SecondaryButton, Badge } from '../components/SharedComponents';

function AuthField({ label, value, onChange, type = 'text', autoComplete, placeholder = '' }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#57645C]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E4E2DC] bg-white px-3.5 py-3 text-sm text-[#1F2924] outline-none transition-colors focus:border-[#9BAE96] focus:bg-white"
      />
    </label>
  );
}

export default function AuthScreen() {
  const {
    t,
    authLoading,
    authError,
    authNotice,
    signIn,
    signUp,
    signInDemo,
    continueLocalDemo,
    authConfigured,
    demoSupabaseLoginAvailable,
  } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    displayName: '',
    city: 'Bucharest',
    coarseArea: '',
    email: '',
    password: '',
  });
  const [localError, setLocalError] = useState('');

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setLocalError('');
  };

  const validate = () => {
    if (!form.email.includes('@')) return t('auth.emailRequired');
    if (form.password.length < 6) return t('auth.passwordRequired');
    if (mode === 'register') {
      if (form.displayName.trim().length < 2) return t('auth.nameRequired');
      if (form.city.trim().length < 2) return t('auth.cityRequired');
    }
    return '';
  };

  const submit = async () => {
    const error = validate();
    if (error) {
      setLocalError(error);
      return;
    }

    if (mode === 'login') {
      await signIn({
        email: form.email.trim(),
        password: form.password,
      });
      return;
    }

    await signUp({
      email: form.email.trim(),
      password: form.password,
      displayName: form.displayName.trim(),
      city: form.city.trim(),
      coarseArea: form.coarseArea.trim(),
    });
  };

  const message = localError || authError;

  return (
    <div data-testid="auth-screen" className="flex-1 overflow-y-auto no-scrollbar bg-[#F8F7F4] px-5 py-6">
      <div className="min-h-full flex flex-col justify-center space-y-6">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#E3ECE4]">
            <Heart size={30} className="text-[#2C402B]" fill="#9BAE96" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold text-[#1F2924]">{t('auth.title')}</h1>
            <p className="mx-auto mt-2 max-w-[290px] text-sm leading-relaxed text-[#57645C]">
              {t('auth.subtitle')}
            </p>
          </div>
          <Badge variant="sage">
            <ShieldCheck size={12} />
            {authConfigured ? t('auth.supabaseConnected') : t('auth.localDemoMode')}
          </Badge>
        </div>

        <div className="rounded-3xl border border-[#E4E2DC] bg-white p-4 shadow-sm">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-[#EFEDE8] p-1">
            {[
              ['login', t('auth.login')],
              ['register', t('auth.register')],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => {
                  setMode(key);
                  setLocalError('');
                }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === key ? 'bg-white text-[#1F2924] shadow-sm' : 'text-[#57645C]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === 'register' && (
              <>
                <AuthField
                  label={t('profile.displayName')}
                  value={form.displayName}
                  onChange={(value) => update('displayName', value)}
                  autoComplete="name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <AuthField
                    label={t('profile.city')}
                    value={form.city}
                    onChange={(value) => update('city', value)}
                    autoComplete="address-level2"
                  />
                  <AuthField
                    label={t('profile.coarseArea')}
                    value={form.coarseArea}
                    onChange={(value) => update('coarseArea', value)}
                    autoComplete="address-level3"
                  />
                </div>
              </>
            )}

            <AuthField
              label={t('profile.email')}
              value={form.email}
              onChange={(value) => update('email', value)}
              type="email"
              autoComplete="email"
              placeholder="alex@example.com"
            />
            <AuthField
              label={t('auth.password')}
              value={form.password}
              onChange={(value) => update('password', value)}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {message && (
              <div className="rounded-xl border border-[#F5D5D8] bg-[#F5D5D8]/45 px-3 py-2 text-xs font-medium text-[#9B4650]">
                {message}
              </div>
            )}
            {authNotice && !message && (
              <div className="rounded-xl border border-[#D4EDDA] bg-[#D4EDDA]/70 px-3 py-2 text-xs font-medium text-[#2C5E3F]">
                {authNotice}
              </div>
            )}

            <PrimaryButton
              onClick={submit}
              disabled={authLoading}
              icon={mode === 'login' ? LogIn : UserPlus}
            >
              {authLoading ? t('auth.working') : mode === 'login' ? t('auth.login') : t('auth.createAccount')}
            </PrimaryButton>

            {demoSupabaseLoginAvailable && (
              <SecondaryButton onClick={signInDemo} disabled={authLoading}>
                {t('auth.useDemoAccount')}
              </SecondaryButton>
            )}
            <SecondaryButton onClick={continueLocalDemo} disabled={authLoading}>
              {t('auth.continueLocalDemo')}
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
