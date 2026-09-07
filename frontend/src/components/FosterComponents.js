import React, { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Dog, Cat, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBackHandler } from '../navigation/backNavigation';
import { uploadSupabaseAnimalPhoto } from '../services/supabaseApi';

export function FosterField({ label, children, ...props }) {
  return <label className="foster-field"><span>{label}</span>{children || <input {...props} />}</label>;
}

export function FosterSelect({ label, value, onChange, options, empty, ...props }) {
  return <FosterField label={label}><select value={value ?? ''} onChange={event => onChange(event.target.value)} {...props}>
    {empty !== undefined && <option value="">{empty}</option>}
    {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
  </select></FosterField>;
}

export function FosterCheck({ label, checked, onChange }) {
  return <label className="foster-check"><input type="checkbox" checked={Boolean(checked)} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>;
}

export function FosterPhoto({ src, name = '', species, large = false }) {
  const [failed, setFailed] = useState(false);
  const Icon = species === 'CAT' ? Cat : Dog;
  return <div className={large ? 'foster-photo-large' : 'foster-thumb'}>
    {src && !failed ? <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} /> : <Icon aria-label={name} size={large ? 56 : 28} />}
  </div>;
}

export function FosterStatus({ value }) {
  const { t } = useApp();
  return <span className={`foster-status status-${value?.toLowerCase()}`}>{t(`care.${value}`)}</span>;
}

export function FosterInfo({ title, children }) {
  return <details className="foster-info"><summary><Info size={17} /><span>{title}</span></summary><p>{children}</p></details>;
}

export function FosterPager({ page, count, onChange, disabled = false }) {
  const { t } = useApp();
  return <div className="foster-pager">
    <span>{count} {t('care.results')} · {t('care.page')} {page + 1}</span>
    <button type="button" aria-label={t('care.previous')} disabled={disabled || !page} onClick={() => onChange(page - 1)}><ChevronLeft size={19} /></button>
    <button type="button" aria-label={t('care.next')} disabled={disabled || (page + 1) * 25 >= count} onClick={() => onChange(page + 1)}><ChevronRight size={19} /></button>
  </div>;
}

export function FosterScreen({ title, onClose, children, busy = false }) {
  const { t } = useApp();
  useBackHandler(true, () => { if (!busy) onClose(); }, 15);
  return <section className="foster-overlay" aria-label={title}>
    <header className="foster-screen-header"><button type="button" onClick={onClose} disabled={busy} aria-label={t('care.back')}><ArrowLeft size={22} /></button><h2>{title}</h2></header>
    {children}
  </section>;
}

export function FosterForm({ title, onClose, onSave, children, submitLabel, onSaved }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsAck, setNeedsAck] = useState(false);
  const [ack, setAck] = useState(false);
  const lock = React.useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const value = await onSave(ack);
      onSaved?.(value);
      onClose();
    } catch (failure) {
      if (failure.message === 'CAPACITY_ACK_REQUIRED') { setNeedsAck(true); setError(t('care.capacityWarning')); }
      else setError(failure.message || t('readiness.saveError'));
    } finally { lock.current = false; setBusy(false); }
  };
  return <FosterScreen title={title} onClose={onClose} busy={busy}>
    <form className="foster-form" onSubmit={submit}>
      <fieldset disabled={busy} className="foster-form-fields">{children}</fieldset>
      {error && <p role="alert" className="foster-alert">{error}</p>}
      {needsAck && <FosterCheck label={t('care.confirmOverride')} checked={ack} onChange={setAck} />}
      <footer className="foster-form-actions"><button className="foster-secondary" type="button" onClick={onClose} disabled={busy}>{t('care.cancel')}</button>
        <button className="foster-primary" type="submit" disabled={busy || (needsAck && !ack)}>{t(busy ? 'care.saving' : submitLabel || 'care.save')}</button></footer>
    </form>
  </FosterScreen>;
}

export function FosterPhotoField({ value, onChange, itemId }) {
  const { user, t } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uploadInput = React.useRef(null);
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('JPEG, PNG, WebP · maximum 10 MB'); return;
    }
    setBusy(true); setError('');
    uploadInput.current?.setCustomValidity(t('care.saving'));
    try {
      // Resize locally for mobile bandwidth; only the selected copy is uploaded, never the original document.
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob) throw new Error(t('readiness.saveError'));
      const photo = new File([blob], `${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' });
      onChange(await uploadSupabaseAnimalPhoto({ ownerId: user.id, animalId: itemId, file: photo }));
    } catch (failure) { setError(failure.message || t('readiness.saveError')); }
    finally { setBusy(false); uploadInput.current?.setCustomValidity(''); }
  };
  return <div className="foster-photo-field">
    <FosterField label={t('care.photo')}><input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { if (!busy) upload(event); }} aria-disabled={busy} /></FosterField>
    {value && <FosterPhoto src={value} name={t('care.photo')} />}
    <p className="foster-muted">{t('care.photosHint')}</p>
    {busy && <p role="status">{t('care.saving')}</p>}{error && <p role="alert" className="foster-alert">{error}</p>}
  </div>;
}
