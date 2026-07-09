'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type AdminFilterSelectOption<TValue extends string> = {
  value: TValue;
  label: string;
  description?: string;
};

type AdminFilterSelectProps<TValue extends string> = {
  label: string;
  value: TValue;
  options: Array<AdminFilterSelectOption<TValue>>;
  onChange: (value: TValue) => void;
};

export function AdminFilterSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: AdminFilterSelectProps<TValue>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={wrapperRef} className="admin-filter-select relative block text-sm">
      <span className="font-semibold">{label}</span>
      <button
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="mt-2 flex h-10 w-full items-center justify-between rounded-md border border-[var(--admin-line)] bg-white px-3 text-left shadow-[0_1px_0_rgba(16,24,40,0.03)] transition hover:border-[var(--admin-line-strong)] focus:outline-none focus:ring-2 focus:ring-[rgba(15,118,110,0.18)]"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <span
          aria-hidden="true"
          className={[
            'ml-3 text-xs text-[var(--admin-muted)] transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        >
          v
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-md border border-[var(--admin-line)] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
          <div
            id={listboxId}
            role="listbox"
            className="pm-scrollbar max-h-64 overflow-y-auto p-1"
          >
            {options.map((option) => {
              const selectedOption = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selectedOption}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={[
                    'relative flex min-h-10 w-full items-center rounded-[6px] px-3 py-2 text-left text-sm transition',
                    selectedOption
                      ? 'bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]'
                      : 'text-[var(--admin-ink)] hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full',
                      selectedOption ? 'bg-[var(--admin-accent)]' : 'bg-transparent',
                    ].join(' ')}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block truncate text-xs text-[var(--admin-muted)]">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
