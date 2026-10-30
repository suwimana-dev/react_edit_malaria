import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cx = (...a) => twMerge(clsx(a));

// Neutral buttons: white with a thin border, 1px lift on hover, one muted accent for the primary action.
const BASE = 'inline-flex min-h-tap select-none items-center justify-center gap-2 rounded-md border px-4 text-[15px] font-medium leading-tight ' +
  'transition-all duration-[135ms] ease-out hover:-translate-y-px active:translate-y-0 ' +
  'disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-line-soft disabled:text-muted disabled:shadow-none';
const OUT = 'border-line bg-surface shadow-soft hover:bg-wash hover:border-muted/40';
const VARIANT = {
  outline: `${OUT} text-ink`,
  primary: 'border-pine bg-pine text-white shadow-soft hover:border-pine-600 hover:bg-pine-600',
  danger: `${OUT} text-danger hover:bg-danger-100`,
  amber: `${OUT} text-amber hover:bg-amber-100`,
  blue: `${OUT} text-ink`,
  ghost: 'min-h-[44px] w-[44px] rounded-full border-0 bg-transparent px-0 text-lg text-muted hover:translate-y-0 hover:bg-wash',
  link: 'min-h-8 border-0 bg-transparent px-1.5 text-sm font-medium text-pine hover:translate-y-0 hover:bg-wash',
};
export function Button({ variant = 'outline', className, type = 'button', ...p }) {
  return <button type={type} className={cx(BASE, VARIANT[variant], className)} {...p} />;
}

export const Card = ({ className, ...p }) => <div className={cx('rounded-card border border-line bg-surface text-ink shadow-card', className)} {...p} />;

export const control = 'min-h-tap w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-100';
export const Input = ({ className, ...p }) => <input className={cx(control, (p.type === 'number' || p.type === 'date') && 'font-mono', className)} {...p} />;
export const Select = ({ className, ...p }) => <select className={cx(control, className)} {...p} />;
export const Lbl = ({ className, ...p }) => <label className={cx('mb-1.5 mt-3 block text-sm font-medium text-muted', className)} {...p} />;
export const Summary = ({ className, ...p }) => <summary className={cx('flex min-h-[44px] cursor-pointer items-center font-semibold text-ink', className)} {...p} />;
