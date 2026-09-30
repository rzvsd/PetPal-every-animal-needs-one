import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Cat, ChevronRight, Dog, Eye, EyeOff } from 'lucide-react';
import { useReducedPetMotion } from '../components/Motion';
import { useApp } from '../context/AppContext';
import { expand, press, spring } from './motion';
import './system.css';

// Accounts removed through "Delete my account" keep this fixed name in the
// database; show it in the reader's language.
export const person = (name, t) => (name === 'Deleted user' ? t('common.deletedUser') : name);

// Full pages (details, a conversation) cover the whole screen, header and
// tabs included, so there is only ever one way back.
export function OverScreen({ children }) {
  const host = document.querySelector('.petpal-screen');
  return host ? createPortal(children, host) : children;
}

// Fills {name}-style placeholders in translated copy.
export function fmt(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) => (values[key] ?? match));
}

// The 3D characters from the intro are PetPal's only illustrations. They
// play their entrance once when they appear, and rest as a still otherwise.
export function Art({ name, size = 96, play = true, className = '' }) {
  const reduced = useReducedPetMotion();
  // One stamp per mount restarts the entrance once, and follows the name if it changes.
  const [stamp] = useState(() => Date.now());
  const src = play && !reduced ? `/reel/${name}.webp?play=${stamp}` : `/art/${name}.webp`;
  return <img src={src} alt="" aria-hidden="true" width={size} height={size} draggable={false}
    className={`ui-art ${className}`} style={{ width: size, height: size }} />;
}

export function Avatar({ src, name = '', species, size = 48, className = '' }) {
  const [failed, setFailed] = useState(false);
  const Icon = species === 'CAT' ? Cat : Dog;
  return <span className={`ui-avatar ${className}`} style={{ width: size, height: size }}>
    {src && !failed ? <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      : <Icon size={typeof size === 'number' ? Math.round(size * 0.42) : 48} aria-label={name} />}
  </span>;
}

export function Button({ variant = 'primary', icon: Icon, busy = false, block = false, children, className = '', disabled, ...props }) {
  const reduced = useReducedPetMotion();
  const off = disabled || busy;
  return <motion.button type="button" whileTap={reduced || off ? undefined : press} disabled={off} aria-busy={busy || undefined}
    className={`ui-btn ui-btn-${variant} ${block ? 'ui-btn-block' : ''} ${className}`} {...props}>
    {busy ? <span className="ui-spinner" aria-hidden="true" /> : Icon && <Icon size={19} aria-hidden="true" />}
    {children && <span>{children}</span>}
  </motion.button>;
}

export function IconButton({ icon: Icon, label, badge, variant = 'plain', size = 22, className = '', ...props }) {
  const reduced = useReducedPetMotion();
  return <motion.button type="button" aria-label={label} title={label} whileTap={reduced ? undefined : { scale: 0.92 }}
    className={`ui-icon-btn ui-icon-btn-${variant} ${className}`} {...props}>
    <Icon size={size} aria-hidden="true" />
    {badge > 0 && <span className="ui-count ui-count-float">{badge}</span>}
  </motion.button>;
}

// A small number that says how many things are new. Screen readers hear
// "3 unread messages", not just "3".
export function Count({ value, className = '' }) {
  const { t } = useApp();
  if (!value) return null;
  return <motion.span key={value} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}
    className={`ui-count ${className}`} role="img" aria-label={`${value} ${t('messages.unreadMessages')}`}>{value > 99 ? '99+' : value}</motion.span>;
}

// A labelled field. Errors appear under it and grow in, so the form
// explains itself without jumping.
export function TextField({ label, hint, error, type = 'text', multiline = false, className = '', ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const { t } = useApp();
  const secret = type === 'password';
  const Input = multiline ? 'textarea' : 'input';
  return <div className={`ui-field ${error ? 'has-error' : ''} ${className}`}>
    <label htmlFor={id} className="ui-field-label">{label}</label>
    <div className="ui-field-box">
      <Input id={id} type={secret && visible ? 'text' : type} aria-invalid={Boolean(error) || undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined} className="ui-input" {...props} />
      {secret && <button type="button" className="ui-field-toggle" onClick={() => setVisible(value => !value)}
        aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')} aria-pressed={visible}>
        {visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>}
    </div>
    <AnimatePresence initial={false} mode="popLayout">
      {error ? <motion.p key="error" id={`${id}-note`} role="alert" className="ui-field-error" {...expand}><AlertCircle size={15} aria-hidden="true" />{error}</motion.p>
        : hint ? <p key="hint" id={`${id}-note`} className="ui-field-hint">{hint}</p> : null}
    </AnimatePresence>
  </div>;
}

// One choice among a few. The marker slides to the new choice so the
// change is easy to follow. "underline" suits page-level tabs.
export function Segment({ value, options, onChange, label, variant = 'pill', className = '' }) {
  const reduced = useReducedPetMotion();
  const layoutId = `segment-${label}`;
  return <div className={`ui-segment ui-segment-${variant} ${className}`} role="group" aria-label={label}>
    {options.map(([key, text, Icon]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>
      {value === key && <motion.span layoutId={reduced ? undefined : layoutId} className="ui-segment-mark" transition={spring} />}
      <span className="ui-segment-text">{Icon && <Icon size={16} aria-hidden="true" />}{text}</span>
    </button>)}
  </div>;
}

export function PageTitle({ title, subtitle, action, className = '' }) {
  return <header className={`ui-page-title ${className}`}>
    <div className="ui-grow"><h1 className="ui-title-xl">{title}</h1>{subtitle && <p className="ui-lede">{subtitle}</p>}</div>
    {action}
  </header>;
}

export function Section({ title, action, children, className = '' }) {
  return <section className={`ui-section ${className}`}>
    {title && <div className="ui-section-head"><h2 className="ui-overline">{title}</h2>{action}</div>}
    {children}
  </section>;
}

// One line in a list: something to look at, what it is, and what is new.
export function Row({ leading, title, overline, subtitle, meta, trailing, onClick, unread = false, className = '', ...props }) {
  const reduced = useReducedPetMotion();
  const Tag = onClick ? motion.button : motion.div;
  return <Tag type={onClick ? 'button' : undefined} onClick={onClick} whileTap={onClick && !reduced ? { scale: 0.985 } : undefined}
    className={`ui-row ${onClick ? 'is-action' : ''} ${unread ? 'is-unread' : ''} ${className}`} {...props}>
    {leading && <span className="ui-row-lead">{leading}</span>}
    <span className="ui-row-body">
      {overline && <span className="ui-row-overline">{overline}</span>}
      <span className="ui-row-title">{title}</span>
      {subtitle && <span className="ui-row-sub">{subtitle}</span>}
    </span>
    {(meta || trailing) && <span className="ui-row-end">{meta && <span className="ui-row-meta">{meta}</span>}{trailing}</span>}
    {onClick && !trailing && <ChevronRight size={18} className="ui-row-chevron" aria-hidden="true" />}
  </Tag>;
}

export function Empty({ art = 'paw', title, text, action, className = '' }) {
  return <div className={`ui-empty ${className}`}>
    <Art name={art} size={112} />
    <h2 className="ui-title-m">{title}</h2>
    {text && <p className="ui-small">{text}</p>}
    {action}
  </div>;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, className = '' }) {
  return <span className={`ui-skeleton ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

// A short message that belongs to the screen: errors stay, good news fades.
export function Notice({ tone = 'info', children, action, onClose, className = '' }) {
  const { t } = useApp();
  return <motion.div role={tone === 'error' ? 'alert' : 'status'} className={`ui-notice ui-notice-${tone} ${className}`}
    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring}>
    <span className="ui-grow">{children}</span>
    {action}
    {onClose && <button type="button" className="ui-notice-close" onClick={onClose}>{t('common.close')}</button>}
  </motion.div>;
}
