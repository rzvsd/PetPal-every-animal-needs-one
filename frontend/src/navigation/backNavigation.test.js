import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { dismissTopLayer, useBackHandler } from './backNavigation';

global.IS_REACT_ACT_ENVIRONMENT = true;

test('Back closes the top dialog before the detail and unregisters unmounted layers', () => {
  const detailClose = jest.fn(); const dialogClose = jest.fn();
  function Layers({ dialog }) {
    useBackHandler(true, detailClose);
    useBackHandler(dialog, dialogClose, 20);
    return null;
  }
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Layers dialog />));
  expect(dismissTopLayer()).toBe(true);
  expect(dialogClose).toHaveBeenCalledTimes(1);
  expect(detailClose).not.toHaveBeenCalled();
  act(() => root.render(<Layers dialog={false} />));
  dismissTopLayer();
  expect(detailClose).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
  expect(dismissTopLayer()).toBe(false);
});
