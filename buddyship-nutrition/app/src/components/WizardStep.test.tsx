import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardStep } from './WizardStep.tsx';

describe('WizardStep', () => {
  it('shows one question with progress, a primary action and back', async () => {
    const onPrimary = vi.fn();
    const onBack = vi.fn();
    render(
      <WizardStep
        step={{ current: 2, total: 3 }}
        title="どの食事ですか"
        primaryLabel="次へ"
        onPrimary={onPrimary}
        onBack={onBack}
      >
        <p>本文</p>
      </WizardStep>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('どの食事ですか');
    expect(screen.getByText('3 のうち 2 番目')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '次へ' }));
    await userEvent.click(screen.getByRole('button', { name: '戻る' }));
    expect(onPrimary).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('buttons use the large touch target class', () => {
    render(
      <WizardStep title="t" primaryLabel="次へ" onPrimary={() => {}}>
        x
      </WizardStep>,
    );
    expect(screen.getByRole('button', { name: '次へ' }).className).toContain('min-h-14');
    expect(screen.queryByRole('button', { name: '戻る' })).toBeNull();
  });
});
