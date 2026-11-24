import { useEffect } from 'react';

// A full page (an animal, a chat) covers the screen. While it is the top
// page, everything under it is inert, so a screen reader cannot wander into
// the hidden tab behind it, and focus moves to the page so its name is read
// out. When it closes, the page underneath comes back and focus returns to
// the button that opened it.
const covers = [];

const sync = () => {
  const top = covers[covers.length - 1];
  const hosts = new Set(covers.map(element => element.parentElement).filter(Boolean));
  hosts.forEach(host => [...host.children].forEach(child => {
    child.inert = Boolean(top) && child !== top && !child.contains(top) && host === top.parentElement;
  }));
};

export function useCoverFocus(ref) {
  useEffect(() => {
    const element = ref.current;
    if (!element?.parentElement) return undefined;
    const host = element.parentElement;
    const previous = document.activeElement;
    covers.push(element);
    sync();
    element.focus({ preventScroll: true });
    return () => {
      covers.splice(covers.indexOf(element), 1);
      if (covers.length) sync();
      else [...host.children].forEach(child => { child.inert = false; });
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [ref]);
}
