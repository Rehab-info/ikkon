import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils.ts';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section data-slot="card" className={cn('rounded-2xl border-2 border-line bg-surface p-5', className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('mb-3 text-xl font-bold', className)} {...props} />;
}
