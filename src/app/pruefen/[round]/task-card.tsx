"use client";

import { useState } from "react";
import { NONE, type ReviewVerdict, type Task, VERDICT_LABELS, type VerdictInput, websiteHref } from "@/lib/review";

const TONE: Record<ReviewVerdict, string> = {
  correct: "border-green-700 bg-green-700 text-white",
  wrong: "border-red-700 bg-red-700 text-white",
  unsure: "border-zinc-800 bg-zinc-800 text-white",
};
const KEYS: Record<ReviewVerdict, string> = { correct: "1", wrong: "2", unsure: "3" };

/** One company's value: richtig / falsch / ?, and on falsch a reason and the right answer. */
export function TaskCard({
  task,
  answer,
  active,
  gap,
  source,
  fieldLabel,
  reasons,
  readOnly,
  error,
  labelOf,
  onActivate,
  onAnswer,
}: {
  task: Task;
  answer: VerdictInput | null;
  active: boolean;
  gap: boolean;
  source: string | null;
  fieldLabel: string;
  reasons: string[];
  readOnly: boolean;
  error: boolean;
  labelOf: (value: string) => string;
  onActivate: () => void;
  onAnswer: (verdict: ReviewVerdict, reason?: string | null, correction?: string | null) => void;
}) {
  const [draft, setDraft] = useState(answer?.correction ?? "");
  // A correction picked in the options panel replaces what is typed here.
  const [savedCorrection, setSavedCorrection] = useState(answer?.correction ?? null);
  if ((answer?.correction ?? null) !== savedCorrection) {
    setSavedCorrection(answer?.correction ?? null);
    setDraft(answer?.correction ?? "");
  }
  const website = websiteHref(task.company?.website ?? null);
  const valueHref = websiteHref(task.value);
  const verdictButton = (v: ReviewVerdict, label = VERDICT_LABELS[v]) => {
    const on = answer?.verdict === v;
    return (
      <button
        type="button"
        disabled={readOnly}
        aria-pressed={on}
        title={`${label} (Taste ${KEYS[v]})${on ? " – nochmal klicken zum Zurücknehmen" : ""}`}
        onClick={() => onAnswer(v)}
        className={`min-w-16 border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          on ? TONE[v] : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
        }`}
      >
        {label}
      </button>
    );
  };
  const saveDraft = () => onAnswer("wrong", answer?.reason ?? null, draft);

  return (
    <article
      id={`task-${task.id}`}
      onClick={onActivate}
      aria-current={active}
      className={`border bg-white p-4 ${active ? "border-blue-600 ring-2 ring-blue-600" : "border-zinc-200"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          <span className="mr-2 text-sm font-normal text-zinc-500">{task.position}.</span>
          <a href={`/companies/${task.company_id}`} target="_blank" rel="noopener noreferrer">
            {task.company?.name ?? "Unbekannt"}
          </a>
        </h2>
        {website ? (
          <a href={website} target="_blank" rel="noopener noreferrer" className="text-sm">
            Website ↗
          </a>
        ) : (
          <span className="text-sm text-zinc-500">keine Website</span>
        )}
      </div>

      {!gap && (
        <p className="mt-2 text-sm">
          <span className="text-zinc-600">{fieldLabel}: </span>
          {valueHref ? (
            <a href={valueHref} target="_blank" rel="noopener noreferrer" className="font-medium break-all">
              {task.value} ↗
            </a>
          ) : (
            <span className="font-medium break-all">{labelOf(task.value)}</span>
          )}
          <span className="text-zinc-600"> · Quelle {source ?? "–"}</span>
          {task.confidence != null && <span className="text-zinc-600"> · Sicherheit {task.confidence.toFixed(2)}</span>}
        </p>
      )}
      {task.evidence.length > 0 && <p className="mt-1 text-xs text-zinc-500">Belege: {task.evidence.join(", ")}</p>}
      {task.suggestion && (
        <p className="mt-2 text-sm">
          <span className="bg-yellow-100 px-1">Vorschlag: {labelOf(task.suggestion)}</span>
          {gap && !readOnly && (
            <button
              type="button"
              className="ml-2 border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-800 hover:bg-zinc-100"
              // "NONE": the AI found no field, so taking it means "gibt es nicht".
              onClick={() => (task.suggestion === NONE ? onAnswer("correct", null, null) : onAnswer("wrong", null, task.suggestion))}
            >
              übernehmen
            </button>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {gap ? (
          <>
            {verdictButton("correct", "gibt es nicht")}
            {verdictButton("unsure")}
          </>
        ) : (
          <>
            {verdictButton("correct")}
            {verdictButton("wrong")}
            {verdictButton("unsure")}
          </>
        )}
      </div>

      {!gap && answer?.verdict === "wrong" && (
        <fieldset className="mt-3" disabled={readOnly}>
          <legend className="text-sm text-zinc-600">Warum falsch?</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {reasons.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={answer.reason === r}
                onClick={() => onAnswer("wrong", answer.reason === r ? null : r, answer.correction)}
                className={`border px-2 py-0.5 text-xs ${
                  answer.reason === r ? "border-red-700 bg-red-50 text-red-900" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {(gap || answer?.verdict === "wrong") && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveDraft();
          }}
        >
          <label className="text-sm text-zinc-600" htmlFor={`correction-${task.id}`}>
            {gap ? `${fieldLabel}:` : "Richtig wäre (optional):"}
          </label>
          <input
            id={`correction-${task.id}`}
            value={draft}
            maxLength={500}
            disabled={readOnly}
            onChange={(e) => setDraft(e.target.value)}
            className={`min-w-0 flex-1 border px-2 py-1 text-sm ${
              answer?.correction ? "border-blue-600 bg-blue-50" : "border-zinc-300"
            }`}
          />
          {answer?.correction && labelOf(answer.correction) !== answer.correction && (
            <span className="text-sm text-blue-800">{labelOf(answer.correction)}</span>
          )}
          <button type="submit" disabled={readOnly} className="border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100">
            speichern
          </button>
        </form>
      )}
      {readOnly && <p className="mt-2 text-xs text-zinc-500">Von einer anderen Person beurteilt.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          Nicht gespeichert. Bitte nochmal versuchen.
        </p>
      )}
    </article>
  );
}
