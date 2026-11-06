"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { answerAfter, NONE, pickAnswer, type ReviewVerdict, type Task, type VerdictInput, websiteHref } from "@/lib/review";
import { removeVerdict, saveVerdict } from "../actions";
import { OptionsPanel } from "./options-panel";
import { TaskCard } from "./task-card";

export type Option = { value: string; label: string; detail: string; group: string };

const KEY_VERDICTS: Record<string, ReviewVerdict> = { "1": "correct", "2": "wrong", "3": "unsure" };

/**
 * The judging surface: cards, keyboard (1/2/3 richtig/falsch/?, j/k next/previous, o website),
 * "nur offene", a progress bar and the options panel. Every answer is saved at once.
 */
export function Judge({
  gap,
  source,
  fieldLabel,
  reasons,
  options,
  optionsGrouped,
  tasks,
  userId,
}: {
  gap: boolean;
  source: string | null;
  fieldLabel: string;
  reasons: string[];
  options: Option[];
  optionsGrouped: boolean;
  tasks: Task[];
  userId: string;
}) {
  const [answers, setAnswers] = useState<Record<string, VerdictInput | null>>(() =>
    Object.fromEntries(
      tasks.map((t) => [t.id, t.verdict ? { verdict: t.verdict.verdict, reason: t.verdict.reason, correction: t.verdict.correction } : null]),
    ),
  );
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(() => tasks.find((t) => !t.verdict)?.id ?? tasks[0]?.id ?? null);

  const readOnly = useCallback(
    (t: Task) => t.verdict !== null && t.verdict.author_id !== userId,
    [userId],
  );
  const visible = useMemo(
    () => (onlyOpen ? tasks.filter((t) => !answers[t.id] || t.id === activeId) : tasks),
    [tasks, answers, onlyOpen, activeId],
  );
  const labels = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const labelOf = useCallback((value: string) => (value === NONE ? "kein Technologiefeld" : (labels.get(value) ?? value)), [labels]);
  const judged = tasks.filter((t) => answers[t.id]).length;
  const active = tasks.find((t) => t.id === activeId) ?? null;

  const store = useCallback(async (task: Task, next: VerdictInput | null) => {
    const before = answers[task.id] ?? null;
    setAnswers((a) => ({ ...a, [task.id]: next }));
    let ok = false;
    try {
      ok = next ? await saveVerdict(task.id, next.verdict, next.reason, next.correction) : await removeVerdict(task.id);
    } catch {
      ok = false;
    }
    if (!ok) setAnswers((a) => ({ ...a, [task.id]: before }));
    setFailed((f) => {
      const copy = new Set(f);
      if (ok) copy.delete(task.id);
      else copy.add(task.id);
      return copy;
    });
  }, [answers]);

  const answer = useCallback(
    (task: Task, verdict: ReviewVerdict, reason?: string | null, correction?: string | null) => {
      if (readOnly(task)) return;
      const next = answerAfter(answers[task.id] ?? null, verdict, reason, correction);
      // A gap answered "falsch" without a correction says nothing: wait for the correction.
      if (gap && next?.verdict === "wrong" && !next.correction) return;
      void store(task, next);
    },
    [answers, gap, readOnly, store],
  );

  const move = useCallback(
    (step: number) => {
      const index = visible.findIndex((t) => t.id === activeId);
      const next = visible[Math.min(Math.max(index + step, 0), visible.length - 1)];
      if (!next) return;
      setActiveId(next.id);
      document.getElementById(`task-${next.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [visible, activeId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, select")) return;
      if (e.key === "j") move(1);
      else if (e.key === "k") move(-1);
      else if (e.key === "o" && active) {
        const href = websiteHref(active.company?.website ?? null) ?? websiteHref(active.value);
        if (href) window.open(href, "_blank", "noopener,noreferrer");
      } else if (KEY_VERDICTS[e.key] && active) {
        const verdict = KEY_VERDICTS[e.key];
        if (gap && verdict === "wrong") return;
        answer(active, verdict);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, answer, gap, move]);

  const percent = tasks.length ? Math.round((judged / tasks.length) * 100) : 0;

  return (
    <div className={`mt-4 ${options.length ? "grid gap-6 pb-[45vh] lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-0" : ""}`}>
      <div>
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {judged} von {tasks.length} beurteilt
            </span>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              nur offene
            </label>
          </div>
          <div
            role="progressbar"
            aria-label="Fortschritt"
            aria-valuemin={0}
            aria-valuemax={tasks.length}
            aria-valuenow={judged}
            className="mt-1 h-1.5 bg-zinc-200"
          >
            <div className="h-full bg-green-700" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 hidden text-xs text-zinc-500 md:block">
            Tasten: 1 {gap ? "gibt es nicht" : "richtig"}, {gap ? "" : "2 falsch, "}3 ?, j/k nächste/vorige, o Website öffnen
          </p>
        </div>
        <div className="mt-3 space-y-3">
          {visible.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              answer={answers[t.id] ?? null}
              active={t.id === activeId}
              gap={gap}
              source={source}
              fieldLabel={fieldLabel}
              reasons={reasons}
              readOnly={readOnly(t)}
              error={failed.has(t.id)}
              labelOf={labelOf}
              onActivate={() => setActiveId(t.id)}
              onAnswer={(v, r, c) => answer(t, v, r, c)}
            />
          ))}
          {visible.length === 0 && <p className="text-sm text-zinc-600">Alles beurteilt. Danke!</p>}
        </div>
      </div>
      {options.length > 0 && (
        <OptionsPanel
          options={options}
          grouped={optionsGrouped}
          suggested={active ? (gap ? active.suggestion : active.value) : null}
          chosen={active ? (answers[active.id]?.correction ?? null) : null}
          disabled={!active || readOnly(active)}
          onPick={(value) => {
            if (!active || readOnly(active)) return;
            void store(active, pickAnswer(active, gap, answers[active.id] ?? null, value));
          }}
        />
      )}
    </div>
  );
}
