'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronIcon } from './chevron-icon';

export type SelectOption = { value: string; label: string };

/**
 * A dropdown drawn by us rather than by the browser.
 *
 * A native `<select>` is the one control on these screens the theme can't reach:
 * iPad Safari draws its own popup - system font, system blue, its own rounding -
 * so a screen otherwise built from `--color-*` gets a grey OS widget in the
 * middle of it. This is a button and a listbox, so it looks like everything
 * beside it, and the options can be sized for a six-year-old's thumb.
 *
 * The button is sized to its *widest* option, not its current one: every label
 * is rendered into the same grid cell and all but the chosen one hidden, so
 * picking "Year 3" after "Kindergarten" doesn't shrink the control and shift
 * whatever sits next to it.
 *
 * Sizes follow the two scales in the app: `lg` for the child's screens, `sm`/`md`
 * for a parent reading a report on a laptop.
 */
export function Select({
  id,
  value,
  options,
  onChange,
  label,
  size = 'sm',
  className = '',
}: {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name, when there is no visible `<label htmlFor>`. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, indexOf(options, value)));
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const style = SIZES[size];

  // A tap anywhere else closes the list. Pointerdown rather than click so the
  // list is gone before whatever was tapped reacts.
  useEffect(() => {
    if (!open) return;

    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  // Keep the highlighted option in view when the list is longer than its box.
  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    setActive(Math.max(0, indexOf(options, value)));
    setOpen(true);
  };

  const choose = (next: string) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
      return;
    }

    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        show();
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => wrap(current + step, options.length));
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option.value);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open}
        aria-label={label}
        aria-activedescendant={open ? optionId(listId,active) : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`no-select flex items-center gap-2 border-(--color-line) bg-(--color-card) text-left font-medium transition ${style.trigger} ${open ? 'border-(--color-brand)' : ''} ${className}`}
      >
        {/* Every label in one grid cell, so the width is the widest of them. */}
        <span className="grid">
          {options.map((option) => (
            <span
              key={option.value}
              aria-hidden={option.value !== value}
              className={`col-start-1 row-start-1 ${option.value === value ? '' : 'invisible'}`}
            >
              {option.label}
            </span>
          ))}
          {!selected && <span className="col-start-1 row-start-1" />}
        </span>
        <ChevronIcon className={`ml-auto shrink-0 transition ${style.chevron} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          className={`no-select absolute z-30 mt-1 max-h-[60vh] min-w-full overflow-y-auto border border-(--color-line) bg-(--color-card) shadow-lg ${style.list}`}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={optionId(listId,index)}
              role="option"
              aria-selected={option.value === value}
              onPointerEnter={() => setActive(index)}
              onClick={() => choose(option.value)}
              className={`cursor-pointer whitespace-nowrap ${style.option} ${
                option.value === value
                  ? 'bg-(--color-brand-soft) text-(--color-brand)'
                  : index === active
                    ? 'bg-(--color-paper)'
                    : ''
              }`}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SIZES = {
  sm: {
    trigger: 'rounded-lg border px-3 py-1.5 text-sm',
    list: 'rounded-lg p-1 text-sm',
    option: 'rounded-md px-3 py-1.5',
    chevron: 'h-3.5 w-3.5',
  },
  md: {
    trigger: 'rounded-lg border px-3 py-1.5 text-base',
    list: 'rounded-lg p-1 text-base',
    option: 'rounded-md px-3 py-1.5',
    chevron: 'h-4 w-4',
  },
  lg: {
    trigger: 'rounded-2xl border-2 px-5 py-3 text-2xl',
    list: 'rounded-2xl p-2 text-2xl',
    option: 'rounded-xl px-4 py-3',
    chevron: 'h-6 w-6',
  },
} as const;

function indexOf(options: SelectOption[], value: string) {
  return options.findIndex((option) => option.value === value);
}

/** Wraps at both ends: the lists here are short enough that running off the
 *  bottom is quicker than arrowing back up. */
function wrap(index: number, length: number) {
  return (index + length) % length;
}

/** Keyed off `useId` rather than the caller's `id`, which two selects on the
 *  same screen may both do without. */
function optionId(listId: string, index: number) {
  return `${listId}-option-${index}`;
}
