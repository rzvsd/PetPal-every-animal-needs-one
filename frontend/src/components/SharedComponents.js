import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedPetMotion } from './Motion';
import DialogLayer from './DialogLayer';
import { useBackHandler } from '../navigation/backNavigation';
import { useApp } from '../context/AppContext';
import { X, ChevronDown, ChevronLeft, Info, Lock, CheckCircle2, XCircle, Clock, AlertTriangle, Dog, Cat } from 'lucide-react';

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-[#E8E6E1] text-[#1F2924]',
    sage: 'bg-[#E3ECE4] text-[#2C402B]',
    clay: 'bg-[#F5DDD0] text-[#8B4C2F]',
    sky: 'bg-[#D8EAF0] text-[#3A7080]',
    rose: 'bg-[#F5D5D8] text-[#9B4650]',
    success: 'bg-[#D4EDDA] text-[#2C5E3F]',
    warning: 'bg-[#FFF3CD] text-[#856404]',
  };
  return (
    <span data-testid="badge" className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}

export function Chip({ label, active, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      data-testid={`chip-${label?.toLowerCase().replace(/\s/g, '-')}`}
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`inline-flex flex-shrink-0 items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium leading-none whitespace-nowrap transition-all duration-200 ${
        active
          ? 'bg-[#2C402B] text-white shadow-sm'
          : 'bg-white text-[#57645C] border border-[#E4E2DC] hover:border-[#9BAE96] hover:text-[#2C402B]'
      }`}
    >
      {Icon && <Icon size={14} className="flex-shrink-0" />}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export function PrimaryButton({ children, onClick, disabled, className = '', icon: Icon, ariaLabel }) {
  return (
    <button
      type="button"
      data-testid="primary-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`w-full bg-[#2C402B] text-white py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#243623] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, className = '', icon: Icon, ariaLabel }) {
  return (
    <button
      type="button"
      data-testid="secondary-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`w-full bg-[#F8F7F4] text-[#2C402B] py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 border border-[#E4E2DC] hover:bg-[#EFEDE8] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}

export function ClayButton({ children, onClick, className = '', ariaLabel }) {
  return (
    <button
      type="button"
      data-testid="clay-button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`w-full bg-[#8B4C2F] text-white py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#743F28] active:scale-[0.98] transition-all duration-200 ${className}`}
    >
      {children}
    </button>
  );
}

export function ScreenHeader({ title, onBack, right }) {
  const { t } = useApp();

  return (
    <div data-testid="screen-header" className="flex items-center justify-between px-5 py-4 bg-white/80 backdrop-blur-lg border-b border-[#E4E2DC]/60 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {onBack && (
          <button type="button" data-testid="back-button" aria-label={t('common.back')} onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-[#F0EDE8] transition-colors">
            <ChevronLeft size={22} className="text-[#2C402B]" />
          </button>
        )}
        <h1 className="text-xl font-semibold text-[#1F2924] tracking-tight font-heading">{title}</h1>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, onAction }) {
  const reduced = useReducedPetMotion();
  return (
    <div data-testid="empty-state" className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {Icon && (
        <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="w-16 h-16 rounded-2xl bg-[#E3ECE4] flex items-center justify-center mb-5">
          <Icon size={28} className="text-[#9BAE96]" />
        </motion.div>
      )}
      <h3 className="text-lg font-semibold text-[#1F2924] mb-2 font-heading">{title}</h3>
      <p className="text-sm text-[#57645C] leading-relaxed mb-6 max-w-[260px]">{description}</p>
      {action && <PrimaryButton onClick={onAction} className="max-w-[200px]">{action}</PrimaryButton>}
    </div>
  );
}

export function PrivacyNote({ text }) {
  return (
    <div data-testid="privacy-note" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#D8EAF0]/40 border border-[#D8EAF0]">
      <Lock size={14} className="text-[#3A7080] flex-shrink-0" />
      <span className="text-xs text-[#3A7080] font-medium">{text}</span>
    </div>
  );
}

export function UrgencyBadge({ urgency }) {
  const { t } = useApp();

  if (urgency === 'HIGH') return <Badge variant="clay"><AlertTriangle size={12} />{t('foster.urgent')}</Badge>;
  if (urgency === 'MEDIUM') return <Badge variant="warning"><Clock size={12} />{t('common.medium')}</Badge>;
  return <Badge variant="default">{t('common.low')}</Badge>;
}

export function CoverageChips({ food, vet, transport }) {
  const { t } = useApp();

  return (
    <div className="flex flex-wrap gap-1.5">
      {food && <Badge variant="sage"><CheckCircle2 size={11} />{t('foster.foodCovered')}</Badge>}
      {vet && <Badge variant="sage"><CheckCircle2 size={11} />{t('foster.vetCovered')}</Badge>}
      {transport && <Badge variant="sage"><CheckCircle2 size={11} />{t('foster.transportAvailable')}</Badge>}
      {!food && <Badge variant="default"><XCircle size={11} />{t('foster.foodCovered')}</Badge>}
      {!vet && <Badge variant="default"><XCircle size={11} />{t('foster.vetCovered')}</Badge>}
      {!transport && <Badge variant="default"><XCircle size={11} />{t('foster.transportAvailable')}</Badge>}
    </div>
  );
}

export function FilterSheet({ open, onClose, title, children, footer, draggable = true }) {
  const { t } = useApp();

  return (
    <DialogLayer open={open} onClose={onClose} sheet label={title} draggable={draggable}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E2DC]">
          <h3 className="text-lg font-semibold text-[#1F2924] font-heading">{title}</h3>
          <button type="button" data-testid="close-filter-sheet" aria-label={t('common.close')} onClick={onClose} className="p-2 rounded-lg hover:bg-[#F0EDE8]">
            <X size={20} className="text-[#57645C]" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5 space-y-4">
          {children}
        </div>
        {footer && <div className="shrink-0 border-t p-4 flex gap-3">{footer}</div>}
    </DialogLayer>
  );
}

export function Modal({ open, onClose, children }) {
  return (
    <DialogLayer open={open} onClose={onClose}>
      <div className="min-h-0 overflow-y-auto">
        {children}
      </div>
    </DialogLayer>
  );
}

export function DemoBanner({ text }) {
  return (
    <div data-testid="demo-banner" className="bg-[#8B4C2F] text-white text-xs font-bold text-center py-2 px-4 tracking-wide">
      {text}
    </div>
  );
}

export function SafetyMenu({ open, onClose, onReport, onBlock, onViewContext }) {
  const { t } = useApp();

  return (
    <DialogLayer open={open} onClose={onClose} sheet label={t('messages.safetyMenu')} draggable>
      <div className="bg-white rounded-t-3xl border-t border-[#E4E2DC] shadow-xl">
        <div className="w-10 h-1 bg-[#E4E2DC] rounded-full mx-auto mt-3" />
        <div className="p-4 space-y-1">
          {onViewContext && <button type="button" data-testid="safety-view-context" onClick={onViewContext} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#F8F7F4] transition-colors">
            <Info size={18} className="text-[#57645C]" />
            <span className="text-sm font-medium text-[#1F2924]">{t('messages.viewContext')}</span>
          </button>}
          <button type="button" data-testid="safety-report" onClick={onReport} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#F5D5D8]/30 transition-colors">
            <AlertTriangle size={18} className="text-[#CD7A7E]" />
            <span className="text-sm font-medium text-[#CD7A7E]">{t('matches.report')}</span>
          </button>
          <button type="button" data-testid="safety-block" onClick={onBlock} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#F5D5D8]/30 transition-colors">
            <XCircle size={18} className="text-[#CD7A7E]" />
            <span className="text-sm font-medium text-[#CD7A7E]">{t('messages.block')}</span>
          </button>
          <button type="button" data-testid="safety-close" onClick={onClose} className="w-full p-3 rounded-xl text-sm font-medium text-[#57645C] hover:bg-[#F8F7F4] transition-colors mt-1">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </DialogLayer>
  );
}

export function AnimalSelector({ animals, selectedId, onSelect, compact = false }) {
  const { t } = useApp();
  const reduced = useReducedPetMotion();
  const [open, setOpen] = useState(false);
  const selected = animals.find(a => a.id === selectedId);
  useBackHandler(open, () => setOpen(false), 20);

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="animal-selector"
        onClick={() => setOpen(!open)}
        aria-label={t('common.selectAnimal')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2.5 bg-white rounded-xl px-4 py-2.5 border border-[#E4E2DC] hover:border-[#9BAE96] transition-colors w-full"
      >
        {selected?.photoUrls?.[0] ? (
          <img src={selected.photoUrls[0]} alt={selected.name} className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#E3ECE4] flex items-center justify-center">
            {selected?.species === 'CAT' ? <Cat size={16} className="text-[#9BAE96]" /> : <Dog size={16} className="text-[#9BAE96]" />}
          </div>
        )}
        <span className="font-semibold text-[#1F2924] text-sm">{selected?.name || t('common.selectAnimal')}</span>
        {!compact && <span className="text-xs text-[#57645C]">{selected?.breed}</span>}
        <ChevronDown size={16} className={`ml-auto text-[#57645C] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0, y: reduced ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -6 }} transition={{ duration: 0.18 }}
          className="absolute top-full right-0 min-w-[240px] max-h-[60vh] mt-1 bg-white rounded-xl border border-[#E4E2DC] shadow-lg z-20 overflow-y-auto" role="listbox" aria-label={t('common.selectAnimal')}>
          {animals.map(a => (
            <button
              type="button"
              key={a.id}
              data-testid={`animal-option-${a.name.toLowerCase()}`}
              onClick={() => { onSelect(a.id); setOpen(false); }}
              role="option"
              aria-selected={a.id === selectedId}
              className={`w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#F8F7F4] transition-colors ${a.id === selectedId ? 'bg-[#E3ECE4]/50' : ''}`}
            >
              {a.photoUrls?.[0] ? (
                <img src={a.photoUrls[0]} alt={a.name} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#E3ECE4] flex items-center justify-center">
                  {a.species === 'CAT' ? <Cat size={16} /> : <Dog size={16} />}
                </div>
              )}
              <div className="text-left">
                <div className="text-sm font-semibold text-[#1F2924]">{a.name}</div>
                <div className="text-xs text-[#57645C]">{a.breed} - {a.sex === 'MALE' ? t('common.male') : a.sex === 'FEMALE' ? t('common.female') : t('common.unknown')}</div>
              </div>
              {a.id === selectedId && <CheckCircle2 size={16} className="ml-auto text-[#9BAE96]" />}
            </button>
          ))}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
