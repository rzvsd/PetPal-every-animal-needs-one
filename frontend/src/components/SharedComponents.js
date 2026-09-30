import React from 'react';
import DialogLayer from './DialogLayer';
import { useApp } from '../context/AppContext';
import { X, Info, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

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
      <div className="pp-sheet-head">
        <h2 className="ui-title-m">{title}</h2>
        <button type="button" data-testid="close-filter-sheet" aria-label={t('common.close')} onClick={onClose} className="ui-icon-btn ui-icon-btn-plain">
          <X size={22} />
        </button>
      </div>
      <div className="pp-sheet-body">{children}</div>
      {footer && <div className="pp-sheet-foot">{footer}</div>}
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
  const item = (testId, Icon, label, onClick, danger) => (
    <button type="button" data-testid={testId} onClick={onClick} className={`pp-menu-item ${danger ? 'is-danger' : ''}`}>
      <Icon size={20} aria-hidden="true" /><span>{label}</span>
    </button>
  );

  return (
    <DialogLayer open={open} onClose={onClose} sheet label={t('messages.safetyMenu')} draggable>
      <div className="pp-menu">
        {onViewContext && item('safety-view-context', Info, t('messages.viewContext'), onViewContext)}
        {item('safety-report', AlertTriangle, t('matches.report'), onReport, true)}
        {item('safety-block', XCircle, t('messages.block'), onBlock, true)}
        <button type="button" data-testid="safety-close" onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-block pp-menu-cancel">{t('common.cancel')}</button>
      </div>
    </DialogLayer>
  );
}
