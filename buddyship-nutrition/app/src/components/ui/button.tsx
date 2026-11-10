import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils.ts';

// 高さ 56px 以上(min-h-14 = 3.5rem。ルート文字サイズ 18px 以上なので 63px 以上)、文字は太く大きく
const buttonVariants = cva(
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-5 py-3 text-lg font-bold leading-snug select-none disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand-strong',
        secondary: 'border-2 border-brand bg-surface text-brand hover:bg-surface-muted',
        quiet: 'border-2 border-line bg-surface text-ink hover:bg-surface-muted',
        danger: 'border-2 border-alert bg-surface text-alert hover:bg-surface-muted',
      },
      width: { full: 'w-full', auto: '' },
    },
    defaultVariants: { variant: 'primary', width: 'full' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, width, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, width }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}
