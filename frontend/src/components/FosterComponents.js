import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Dog, Cat, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { friendlyError } from '../services/errors';
import { useBackHandler } from '../navigation/backNavigation';
import { animalPhotoUrl, uploadSupabaseAnimalPhotoPath } from '../services/supabaseApi';
import { prepareImageForUpload } from '../services/imageUpload';
import { useDiscardGuard } from './FormGuard';
import { motionSpring, useReducedPetMotion } from './Motion';

const UploadPending = React.createContext(() => {});

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
  const [loaded, setLoaded] = useState(false);
  const reducedMotion = useReducedPetMotion();
  const Icon = species === 'CAT' ? Cat : Dog;
  useEffect(() => { setFailed(false); setLoaded(false); }, [src]);
  return <div className={large ? 'foster-photo-large' : 'foster-thumb'}>
    {src && !failed ? <motion.img src={animalPhotoUrl(src)} alt={name} loading="lazy" initial={reducedMotion ? false : { opacity: 0.35 }}
      animate={{ opacity: loaded ? 1 : 0.35 }} transition={reducedMotion ? { duration: 0 } : motionSpring}
      onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /> : <Icon aria-label={name} size={large ? 56 : 28} />}
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
  const reducedMotion = useReducedPetMotion();
  const present = useIsPresent();
  const screen = React.useRef(null);
  useBackHandler(true, () => { if (!busy && present) onClose(); }, 15);
  useEffect(() => {
    const previous = document.activeElement;
    const element = screen.current;
    (element.querySelector('button:not(:disabled)') || element).focus();
    const trap = event => {
      if (event.key !== 'Tab' || event.target.closest('.foster-overlay') !== element) return;
      const items = [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')]
        .filter(item => item.closest('.foster-overlay') === element && item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === element)) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && (document.activeElement === items.at(-1) || document.activeElement === element)) { event.preventDefault(); items[0].focus(); }
    };
    element.addEventListener('keydown', trap);
    return () => { element.removeEventListener('keydown', trap); if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); };
  }, []);
  return <motion.section ref={screen} role="dialog" aria-modal="true" tabIndex={-1} className="foster-overlay" aria-label={title} initial={reducedMotion ? false : { opacity: 0, x: 22 }}
    animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 22 }} transition={{ duration: reducedMotion ? 0.1 : 0.24 }}>
    <header className="foster-screen-header"><button type="button" onClick={onClose} disabled={busy} aria-label={t('care.back')}><ArrowLeft size={22} /></button><h2>{title}</h2></header>
    {children}
  </motion.section>;
}

export function FosterForm({ title, onClose, onSave, children, submitLabel, onSaved, values }) {
  const { t } = useApp();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = saving || uploading;
  const [error, setError] = useState('');
  const [needsAck, setNeedsAck] = useState(false);
  const [ack, setAck] = useState(false);
  const [photoSelected, setPhotoSelected] = useState(false);
  const serialized = JSON.stringify(values, (_, value) => typeof value === 'number' ? String(value) : value);
  const initial = React.useRef(serialized);
  const dirty = photoSelected || ack || initial.current !== serialized;
  const lock = React.useRef(false);
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, busy, onClose });
  const submit = async event => {
    event.preventDefault();
    if (lock.current || uploading) return;
    lock.current = true; setSaving(true); setError('');
    try {
      const value = await onSave(ack);
      onSaved?.(value);
      onClose();
    } catch (failure) {
      if (failure.message === 'CAPACITY_ACK_REQUIRED') { setNeedsAck(true); setError(t('care.capacityWarning')); }
      else setError(friendlyError(failure, t));
    } finally { lock.current = false; setSaving(false); }
  };
  return <FosterScreen title={title} onClose={requestClose} busy={busy}>
    <form className="foster-form" onSubmit={submit} onChange={event => { if (event.target.type === 'file') setPhotoSelected(Boolean(event.target.files?.length)); }}>
      <div className="foster-form-scroll">
      <UploadPending.Provider value={setUploading}><fieldset disabled={busy} className="foster-form-fields">{children}</fieldset></UploadPending.Provider>
      <AnimatePresence initial={false}>{error && <motion.p role="alert" className="foster-alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={motionSpring}>{error}</motion.p>}</AnimatePresence>
      {needsAck && <FosterCheck label={t('care.confirmOverride')} checked={ack} onChange={setAck} />}
      </div>
      <footer className="foster-form-actions"><button className="foster-secondary" type="button" onClick={requestClose} disabled={busy}>{t('care.cancel')}</button>
        <button className="foster-primary" type="submit" disabled={busy || (needsAck && !ack)}>{t(busy ? 'care.saving' : submitLabel || 'care.save')}</button></footer>
    </form>
    {discardDialog}
  </FosterScreen>;
}

export function FosterPhotoField({ value, onChange, itemId }) {
  const { user, t } = useApp();
  const setUploading = React.useContext(UploadPending);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const uploadInput = React.useRef(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const upload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('JPEG, PNG, WebP · maximum 10 MB');
      uploadInput.current?.setCustomValidity('JPEG, PNG, WebP · maximum 10 MB'); return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true); setUploading(true); setError('');
    uploadInput.current?.setCustomValidity('');
    try {
      // Only the re-encoded copy is uploaded, never the original file.
      const photo = await prepareImageForUpload(file);
      onChange(await uploadSupabaseAnimalPhotoPath({ ownerId: user.id, animalId: itemId, file: photo }));
    } catch (failure) {
      const message = friendlyError(failure, t);
      setError(message); uploadInput.current?.setCustomValidity(message);
    }
    finally { setBusy(false); setUploading(false); }
  };
  return <div className="foster-photo-field">
    <FosterField label={t('care.photo')}><input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { if (!busy) upload(event); }} disabled={busy} /></FosterField>
    {(preview || value) && <FosterPhoto src={preview || value} name={t('care.photo')} />}
    {preview && <p className="foster-muted">{t('motion.photoPreview')}</p>}
    <p className="foster-muted">{t('care.photosHint')}</p>
    {busy && <p role="status">{t('care.saving')}</p>}{error && <p role="alert" className="foster-alert">{error}</p>}
  </div>;
}
