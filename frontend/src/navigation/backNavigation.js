import { useEffect, useRef } from 'react';

const handlers = [];

export function dismissTopLayer() {
  const top = [...handlers].sort((a, b) => b.priority - a.priority || b.order - a.order)[0];
  if (!top) return false;
  top.close();
  return true;
}

let order = 0;
export function useBackHandler(active, onClose, priority = 10) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return undefined;
    const handler = { close: () => close.current(), priority, order: ++order };
    handlers.push(handler);
    return () => { handlers.splice(handlers.indexOf(handler), 1); };
  }, [active, priority]);
}
