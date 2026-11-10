import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScopeSwitch } from './ScopeSwitch.tsx';

describe('ScopeSwitch', () => {
  it('exposes state as an accessible switch with text, not only color', () => {
    render(<ScopeSwitch staffName="山田" scope="meals:read" granted={false} onChange={() => {}} />);
    const sw = screen.getByRole('switch', { name: /食事の記録を見る/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveTextContent('見せない');
  });

  it('asks for confirmation before revoking and explains it cannot undo past views', async () => {
    const onChange = vi.fn();
    render(<ScopeSwitch staffName="山田" scope="meals:read" granted onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('すでに見た内容は取り消せません');
    await userEvent.click(screen.getByRole('button', { name: '変えない' }));
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('switch'));
    await userEvent.click(await screen.findByRole('button', { name: 'やめる' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('granting proxy entry is a separate, explicit choice', async () => {
    const onChange = vi.fn();
    render(<ScopeSwitch staffName="山田" scope="meals:write" granted={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: /食事を代わりに記録する/ }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('影響しません');
    await userEvent.click(screen.getByRole('button', { name: '任せる' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
