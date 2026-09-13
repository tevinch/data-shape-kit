import React, { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
function Counter() {
  const [count, setCount] = useState(0);
  return React.createElement('button', { onClick: () => setCount(count + 1) }, `Count ${count}`);
}
export default { title: 'Config/Counter', component: Counter };
export const ClickOnce = {
  async play({ canvasElement }) {
    await expect(canvasElement.ownerDocument.body.dataset.runner).toBe('config-loaded');
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Count 0' }));
    await expect(canvas.getByRole('button', { name: 'Count 1' })).toBeVisible();
  },
};
export const ClickTwice = {
  async play({ canvasElement }) {
    await expect(canvasElement.ownerDocument.body.dataset.runner).toBe('config-loaded');
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Count 0' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Count 1' }));
    await expect(canvas.getByRole('button', { name: 'Count 2' })).toBeVisible();
  },
};
