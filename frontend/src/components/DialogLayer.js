import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useIsPresent } from 'framer-motion';
import { useBackHandler } from '../navigation/backNavigation';
import { motionSpring, useReducedPetMotion } from './Motion';

const dialogs = [];
const topDialog = () => [...dialogs].sort((a, b) => b.priority - a.priority || dialogs.indexOf(b) - dialogs.indexOf(a))[0];
const syncInert = () => dialogs.forEach(item => { item.element.inert = item !== topDialog(); });

function DialogSurface({ onClose, children, sheet, label, priority, draggable }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  const present = useIsPresent();
  const reduced = useReducedPetMotion();
  const dragControls = useDragControls();
  close.current = present ? onClose : () => {};
  useBackHandler(true, () => close.current(), priority);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const element = dialog.current;
    const entry = { element, priority };
    dialogs.push(entry);
    if (root) root.inert = true;
    syncInert();
    if (!label) {
      const heading = element.querySelector('h1, h2, h3');
      if (heading) element.setAttribute('aria-label', heading.textContent);
    }
    (element.querySelector('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') || element).focus();
    const trap = event => {
      if (topDialog() !== entry) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        .filter(item => item.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); element.focus(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus(); }
    };
    element.addEventListener('keydown', trap);
    return () => {
      element.removeEventListener('keydown', trap);
      dialogs.splice(dialogs.indexOf(entry), 1);
      syncInert();
      if (root && !dialogs.length) root.inert = false;
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus();
      else topDialog()?.element.focus();
    };
  }, [label, priority]);
  const closed = reduced ? { opacity: 0 } : sheet ? { y: '100%', opacity: 1 } : { opacity: 0, scale: 0.98 };
  return (
    <div className={`dialog-layer ${sheet ? 'dialog-sheet' : ''}`} style={{ zIndex: 100 + priority }} data-testid={sheet ? 'filter-sheet' : 'modal-overlay'}>
      <motion.div className="absolute inset-0 bg-[rgb(27_37_32/0.4)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.1 : 0.2 }} onClick={() => close.current()} aria-hidden="true" />
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        initial={closed} animate={{ opacity: 1, scale: 1, y: 0 }} exit={closed}
        transition={reduced ? { duration: 0.1 } : sheet ? motionSpring : { duration: 0.2 }}
        drag={sheet && draggable && !reduced ? 'y' : false} dragControls={dragControls} dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.3 }} dragSnapToOrigin
        onDragEnd={(_, info) => { if (info.offset.y > 80 || (info.velocity.y > 600 && info.offset.y > 20)) close.current(); }}
        className={`dialog-content ${sheet ? 'rounded-t-3xl' : 'rounded-3xl'}`}>
        {sheet && draggable && <div className="dialog-drag-handle" aria-hidden="true" onPointerDown={event => dragControls.start(event)}><span /></div>}
        {children}
      </motion.div>
    </div>
  );
}

export default function DialogLayer({ open, onClose, children, sheet = false, label, priority = 20, draggable = false }) {
  return createPortal(<AnimatePresence>{open && <DialogSurface key="dialog" {...{ onClose, children, sheet, label, priority, draggable }} />}</AnimatePresence>, document.body);
}
