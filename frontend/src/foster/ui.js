import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Cat, Check, Dog } from 'lucide-react';
import DialogLayer from '../components/DialogLayer';
import { motionSpring, useReducedPetMotion } from '../components/Motion';
import { useBackHandler } from '../navigation/backNavigation';
import { animalPhotoUrl } from '../services/supabaseApi';
import { useApp } from '../context/AppContext';

import { Art } from '../ui/kit';
export { fmt } from '../ui/kit';

// A list that flows in item by item, so a screen reads as one movement.
export const listMotion = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};
export const itemMotion = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: motionSpring },
};

export function Photo({ src, name = '', species, className = '', layoutId }) {
  const [failed, setFailed] = useState(false);
  const reduced = useReducedPetMotion();
  const Icon = species === 'CAT' ? Cat : Dog;
  const url = animalPhotoUrl(src);
  return <motion.div layoutId={reduced ? undefined : layoutId} className={`fx-photo ${className}`}>
    {url && !failed ? <img src={url} alt={name} loading="lazy" onError={() => setFailed(true)} />
      : <Icon aria-label={name} className="fx-photo-icon" />}
  </motion.div>;
}

export function Button({ variant = 'primary', icon: Icon, children, className = '', ...props }) {
  const reduced = useReducedPetMotion();
  return <motion.button type="button" whileTap={reduced || props.disabled ? undefined : { scale: 0.97 }}
    className={`fx-button fx-button-${variant} ${className}`} {...props}>
    {Icon && <Icon size={18} aria-hidden="true" />}{children}
  </motion.button>;
}

export function Card({ children, className = '', onClick, ...props }) {
  const reduced = useReducedPetMotion();
  if (!onClick) return <motion.div variants={itemMotion} className={`fx-card ${className}`} {...props}>{children}</motion.div>;
  return <motion.button type="button" variants={itemMotion} onClick={onClick}
    whileTap={reduced ? undefined : { scale: 0.985 }} className={`fx-card fx-card-button ${className}`} {...props}>{children}</motion.button>;
}

export function SectionTitle({ children, count, action }) {
  return <div className="fx-section-title"><h2>{children}{count != null && <span className="fx-count">{count}</span>}</h2>{action}</div>;
}

// Tap-to-choose options instead of dropdowns.
export function Choices({ options, value, onChange, multiple = false, label, columns }) {
  const reduced = useReducedPetMotion();
  const selected = option => (multiple ? value.includes(option) : value === option);
  const toggle = option => {
    if (!multiple) return onChange(option);
    return onChange(selected(option) ? value.filter(item => item !== option) : [...value, option]);
  };
  return <div role="group" aria-label={label} className={`fx-choices ${columns ? `fx-choices-${columns}` : ''}`}>
    {options.map(([option, text, Icon]) => <motion.button type="button" key={option} aria-pressed={selected(option)}
      whileTap={reduced ? undefined : { scale: 0.95 }} onClick={() => toggle(option)} className="fx-choice">
      {/* The check says "chosen" without relying on colour alone. */}
      {selected(option) ? <motion.span initial={reduced ? false : { scale: 0.4 }} animate={{ scale: 1 }} className="fx-choice-check"><Check size={17} strokeWidth={2.6} /></motion.span>
        : Icon && <Icon size={19} aria-hidden="true" />}<span>{text}</span>
    </motion.button>)}
  </div>;
}

export function Field({ label, hint, children }) {
  return <label className="fx-field"><span className="fx-field-label">{label}</span>{children}{hint && <span className="fx-hint">{hint}</span>}</label>;
}

// A full-screen page that slides in over everything, header and tabs
// included, so there is only ever one back button on screen.
export function Screen(props) {
  const host = document.querySelector('.petpal-screen');
  return host ? createPortal(<ScreenPage {...props} />, host) : <ScreenPage {...props} />;
}

function ScreenPage({ title, onBack, action, children, footer, tone }) {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  const body = useRef(null);
  // Pages that open on a big photo carry their own large title; the bar's
  // title rises into place once that one scrolls away, so it never repeats.
  const [barTitle, setBarTitle] = useState(true);
  const showBarTitle = () => {
    const element = body.current;
    setBarTitle(!element?.querySelector('.fx-hero') || element.scrollTop > 300);
  };
  // Checked again when the content changes: the photo may arrive after a loading state.
  useLayoutEffect(showBarTitle, [children]);
  useBackHandler(true, onBack, 15);
  return <motion.section className={`fx-screen ${tone ? `fx-screen-${tone}` : ''}`} aria-label={typeof title === 'string' ? title : undefined}
    initial={reduced ? { opacity: 0 } : { x: '100%' }} animate={{ x: 0, opacity: 1 }}
    exit={reduced ? { opacity: 0 } : { x: '100%' }} transition={reduced ? { duration: 0.12 } : motionSpring}>
    <header className="fx-screen-header">
      <button type="button" className="fx-icon-button" onClick={onBack} aria-label={t('common.back')}><ArrowLeft size={22} /></button>
      <motion.h1 initial={false} animate={{ opacity: barTitle ? 1 : 0, y: barTitle ? 0 : 8 }} transition={{ duration: 0.18 }}
        aria-hidden={!barTitle || undefined}>{title}</motion.h1>{action || <span className="fx-header-spacer" />}
    </header>
    <div className="fx-screen-body" ref={body} onScroll={showBarTitle}>{children}</div>
    {footer && <footer className="fx-screen-footer">{footer}</footer>}
  </motion.section>;
}

export function Sheet({ open, onClose, title, children, footer }) {
  return <DialogLayer open={open} onClose={onClose} sheet draggable label={title}>
    <div className="fx-sheet"><h2 className="fx-sheet-title">{title}</h2><div className="fx-sheet-body">{children}</div>
      {footer && <div className="fx-sheet-footer">{footer}</div>}</div>
  </DialogLayer>;
}

// The story of one fostering, from offer to finish.
export function Journey({ steps, current }) {
  const reduced = useReducedPetMotion();
  const progress = steps.length > 1 ? current / (steps.length - 1) : 0;
  return <div className="fx-journey" role="list">
    <div className="fx-journey-track" aria-hidden="true">
      <motion.div className="fx-journey-fill" initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: progress }}
        transition={reduced ? { duration: 0 } : { ...motionSpring, delay: 0.15 }} />
    </div>
    {steps.map((step, index) => <div role="listitem" key={step} className={`fx-journey-step ${index < current ? 'is-done' : index === current ? 'is-now' : ''}`}
      aria-current={index === current ? 'step' : undefined}>
      <motion.span className="fx-journey-dot" initial={reduced ? false : { scale: 0.6 }} animate={{ scale: index === current ? 1.15 : 1 }}
        transition={reduced ? { duration: 0 } : { ...motionSpring, delay: 0.1 + index * 0.06 }}>
        {index < current && <Check size={12} />}
      </motion.span>
      <span className="fx-journey-label">{step}</span>
    </div>)}
  </div>;
}

export function TaskCheck({ done, label, meta, late, disabled, onToggle }) {
  const reduced = useReducedPetMotion();
  return <motion.button type="button" variants={itemMotion} layout={!reduced} className={`fx-task ${done ? 'is-done' : ''} ${late && !done ? 'is-late' : ''}`}
    aria-pressed={done} disabled={disabled} onClick={onToggle} whileTap={reduced || done ? undefined : { scale: 0.98 }}>
    <span className="fx-task-box" aria-hidden="true">
      <AnimatePresence>{done && <motion.svg viewBox="0 0 24 24" width="16" height="16" initial={reduced ? false : { scale: 0.4 }} animate={{ scale: 1 }}>
        <motion.path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
      </motion.svg>}</AnimatePresence>
    </span>
    <span className="fx-task-text"><span>{label}</span>{meta && <small>{meta}</small>}</span>
  </motion.button>;
}

export function Notice({ tone = 'info', children, onClose }) {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  return <motion.div role={tone === 'error' ? 'alert' : 'status'} className={`fx-notice fx-notice-${tone}`}
    initial={reduced ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -8 }}>
    <span>{children}</span>{onClose && <button type="button" onClick={onClose} className="fx-notice-close">{t('fx.close')}</button>}
  </motion.div>;
}

export function Empty({ art = 'paw', title, text, children }) {
  return <motion.div variants={itemMotion} className="fx-empty">
    <Art name={art} size={96} />
    <h3>{title}</h3>{text && <p>{text}</p>}{children}
  </motion.div>;
}

// A celebratory burst for moments worth marking, such as an animal arriving.
export function Celebrate({ show, text }) {
  const reduced = useReducedPetMotion();
  return <AnimatePresence>{show && <motion.div className="fx-celebrate" role="status"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    {!reduced && [...Array(10)].map((_, index) => <motion.span key={index} className="fx-celebrate-dot"
      initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
      animate={{ x: Math.cos((index / 10) * Math.PI * 2) * 110, y: Math.sin((index / 10) * Math.PI * 2) * 110, scale: 1, opacity: 0 }}
      transition={{ duration: 0.9, ease: 'easeOut' }} />)}
    <motion.p initial={reduced ? false : { scale: 0.8, y: 10 }} animate={{ scale: 1, y: 0 }} transition={motionSpring}>{text}</motion.p>
  </motion.div>}</AnimatePresence>;
}

// A plain "are you sure" for steps that cannot be undone.
export function ConfirmSheet({ open, title, text, confirmLabel, danger, busy, onClose, onConfirm, children }) {
  const { t } = useApp();
  return <Sheet open={open} onClose={onClose} title={title}
    footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{busy ? t('fx.loading') : confirmLabel}</Button></>}>
    {text && <p className="fx-lead">{text}</p>}
    {children}
  </Sheet>;
}
