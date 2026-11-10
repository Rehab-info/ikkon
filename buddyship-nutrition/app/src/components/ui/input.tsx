import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils.ts';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'min-h-14 w-full rounded-xl border-2 border-line bg-surface px-4 text-lg text-ink placeholder:text-ink-muted',
        className,
      )}
      {...props}
    />
  );
}
