import React, { useRef } from 'react';
import { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useCoverFocus } from './coverFocus';

function Page({ name }) {
  const ref = useRef(null);
  useCoverFocus(ref);
  return <section ref={ref} tabIndex={-1} aria-label={name}>{name}</section>;
}

test('a full page makes what is under it inert, takes focus, and gives both back', () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const tab = document.createElement('div');
  const opener = document.createElement('button');
  tab.appendChild(opener);
  host.appendChild(tab);
  const slot = document.createElement('div');
  document.body.appendChild(slot);
  opener.focus();
  const root = createRoot(slot);
  // Pages are portalled into the screen, next to the tab they cover.
  act(() => root.render(createPortal(<Page name="Luna" />, host)));
  expect(tab.inert).toBe(true);
  expect(host.querySelector('section').inert).toBe(false);
  expect(document.activeElement.getAttribute('aria-label')).toBe('Luna');
  act(() => root.unmount());
  expect(tab.inert).toBe(false);
  expect(document.activeElement).toBe(opener);
});
