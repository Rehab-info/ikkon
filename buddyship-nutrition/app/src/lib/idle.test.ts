import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdleTimeout } from './idle.ts';

describe('useIdleTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the idle period', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(true, 1000, onIdle));
    vi.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('activity resets the timer', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(true, 1000, onIdle));
    vi.advanceTimersByTime(800);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(800);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('does nothing when disabled (member devices)', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(false, 1000, onIdle));
    vi.advanceTimersByTime(10_000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
