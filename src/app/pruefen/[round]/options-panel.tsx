"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Option } from "./judge";

/**
 * Every option of the field, always in view (a side panel; a bottom sheet on phones), with a search
 * box. Yellow: what the source or the AI said. Blue: the person's correction.
 */
export function OptionsPanel({
  options,
  grouped,
  suggested,
  chosen,
  disabled,
  onPick,
}: {
  options: Option[];
  grouped: boolean;
  suggested: string | null;
  chosen: string | null;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const list = useRef<HTMLUListElement>(null);
  // Bring the suggestion of the active card into view.
  useEffect(() => {
    if (!suggested) return;
    list.current?.querySelector(`[data-value="${CSS.escape(suggested)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [suggested]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.value} ${o.label} ${o.detail} ${o.group}`.toLowerCase().includes(q));
  }, [options, query]);
  const groups = useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const o of shown) map.set(grouped ? o.group : "", [...(map.get(grouped ? o.group : "") ?? []), o]);
    return [...map.entries()];
  }, [shown, grouped]);

  return (
    <aside
      aria-label="Alle Optionen"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-300 bg-white shadow-lg lg:sticky lg:top-4 lg:inset-auto lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:border lg:shadow-none"
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 p-2">
        <label className="sr-only" htmlFor="option-search">
          Optionen durchsuchen
        </label>
        <input
          id="option-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${options.length} Optionen durchsuchen`}
          className="min-w-0 flex-1 border border-zinc-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 hover:bg-zinc-100 lg:hidden"
        >
          {open ? "Optionen ausblenden" : "Optionen"}
        </button>
      </div>
      <ul ref={list} className={`${open ? "" : "hidden"} max-h-[40vh] overflow-y-auto p-2 text-sm lg:block lg:max-h-[calc(100vh-6rem)]`}>
        {groups.map(([group, items]) => (
          <li key={group}>
            {group && <div className="mt-2 px-1 text-xs font-semibold text-zinc-500">{group}</div>}
            <ul>
              {items.map((o) => {
                const isChosen = o.value === chosen;
                const isSuggested = o.value === suggested;
                return (
                  <li key={o.value} data-value={o.value}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick(o.value)}
                      aria-pressed={isChosen}
                      className={`w-full px-2 py-1 text-left font-normal text-zinc-900 disabled:opacity-50 ${
                        isChosen ? "bg-blue-100 ring-1 ring-blue-600 hover:bg-blue-200" : isSuggested ? "bg-yellow-100 hover:bg-yellow-200" : "bg-white hover:bg-zinc-100"
                      }`}
                    >
                      <span className="font-medium">{o.label}</span>
                      {isSuggested && <span className="ml-1 text-xs text-yellow-800">(Vorschlag)</span>}
                      {isChosen && <span className="ml-1 text-xs text-blue-800">(deine Korrektur)</span>}
                      {o.detail && <span className="block text-xs text-zinc-500">{o.detail}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        {shown.length === 0 && <li className="p-2 text-zinc-500">Keine Option passt.</li>}
      </ul>
    </aside>
  );
}
