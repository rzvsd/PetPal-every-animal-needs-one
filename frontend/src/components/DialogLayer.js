import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler } from '../navigation/backNavigation';

let openDialogs = 0;

export default function DialogLayer({ open, onClose, children, sheet = false, label }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useBackHandler(open, onClose, 20);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    openDialogs += 1;
    if (root) root.inert = true;
    const element = dialog.current;
    if (!label) {
      const heading = element.querySelector('h1, h2, h3');
      if (heading) element.setAttribute('aria-label', heading.textContent);
    }
    (element.querySelector('button, input, select, textarea') || element).focus();
    const trap = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]')];
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    element.addEventListener('keydown', trap);
    return () => {
      element.removeEventListener('keydown', trap);
      openDialogs -= 1;
      if (root && openDialogs === 0) root.inert = false;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, label]);
  if (!open) return null;
  return createPortal(
    <div className={`dialog-layer ${sheet ? 'dialog-sheet' : ''}`} data-testid={sheet ? 'filter-sheet' : 'modal-overlay'}>
      <div className="absolute inset-0 bg-black/35" onClick={onClose} aria-hidden="true" />
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className={`dialog-content ${sheet ? 'rounded-t-3xl' : 'rounded-3xl'}`}>
        {children}
      </div>
    </div>, document.body,
  );
}
