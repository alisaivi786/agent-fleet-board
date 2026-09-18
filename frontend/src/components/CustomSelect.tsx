import { useEffect, useId, useRef, useState } from 'react';

export interface CustomSelectOption {
  value: string;
  label: string;
}

export function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select...',
  className = '',
  title,
}: {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  title?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`custom-select ${className} ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        title={title}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? 'custom-select-value' : 'custom-select-placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <span className="custom-select-arrow" aria-hidden="true" />
      </button>

      {open && (
        <div id={id} className="custom-select-menu" role="listbox">
          {options.filter((option) => option.value !== value).map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="custom-select-option"
              key={option.value}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
