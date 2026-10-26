"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getAirport, searchAirports } from "@/lib/airports";
import { getDictionary } from "@/i18n";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import type { Airport } from "@/data/airports";

type AirportComboboxProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (iata: string) => void;
  exclude?: string;
  invalid?: boolean;
  disabled?: boolean;
};

export function AirportCombobox({
  id,
  label,
  value,
  placeholder,
  onChange,
  exclude,
  invalid = false,
  disabled = false,
}: AirportComboboxProps) {
  const t = getDictionary();
  const selected = value ? getAirport(value) : undefined;
  const selectedLabel = selected ? `${selected.city} (${selected.iata})` : "";
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = disabled ? "" : (draft ?? selectedLabel);

  const options = useMemo(() => {
    const term = query.trim();
    const base =
      term.length === 0 || term === selectedLabel
        ? searchAirports("", 12)
        : searchAirports(term, 8);

    return base.filter((airport) => airport.iata !== exclude);
  }, [query, selectedLabel, exclude]);

  function selectAirport(airport: Airport) {
    onChange(airport.iata);
    setDraft(null);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleChange(nextQuery: string) {
    setDraft(nextQuery);
    setOpen(true);
    setActiveIndex(0);

    if (selected && nextQuery !== selectedLabel) {
      onChange("");
    }
  }

  function clear() {
    onChange("");
    setDraft("");
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(options.length - 1, current + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (event.key === "Enter") {
      const option = options[activeIndex];
      if (open && option) {
        event.preventDefault();
        selectAirport(option);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setDraft(null);
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const listboxId = `${id}-listbox`;

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>

      <div
        className={`flex items-center gap-2 rounded-xl border bg-surface px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-brand/25 ${
          invalid ? "border-danger/70" : "border-border focus-within:border-brand/60"
        } ${disabled ? "opacity-60" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
            setDraft(null);
          }
        }}
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[activeIndex] ? `${id}-option-${options[activeIndex].iata}` : undefined
          }
          aria-invalid={invalid}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted/80 disabled:cursor-not-allowed"
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t.search.clearAirport}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-black/5">
          {options.length > 0 ? (
            <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
              {options.map((airport, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    key={airport.iata}
                    id={`${id}-option-${airport.iata}`}
                    role="option"
                    aria-selected={isActive}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectAirport(airport)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                        isActive ? "bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-brand-soft font-mono text-xs font-bold text-brand">
                        {airport.iata}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {airport.city}, {airport.country}
                        </span>
                        <span className="block truncate text-xs text-muted">{airport.name}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium text-foreground">{t.search.noAirportResults}</p>
              <p className="mt-0.5 text-xs text-muted">{t.search.noAirportHint}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
