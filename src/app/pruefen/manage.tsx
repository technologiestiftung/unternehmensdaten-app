import { formatDate, formatNumber } from "@/lib/format";
import { KIND_LABELS, MODE_LABELS, type Round } from "@/lib/review";
import { DEFAULT_SIZE, KNOWN_FIELDS, MAX_SIZE, STATUS_LABELS, type RoundRequest } from "@/lib/review-manage";
import { fieldLabel } from "@/lib/sources";
import { deleteRound, renameRound, requestRound } from "./actions";

const LABEL = "flex flex-col gap-1.5 text-xs font-medium text-zinc-500";

/** "Neue Runde": anyone signed in asks for a round; plain form, works without JavaScript. */
export function NewRoundForm() {
  return (
    <details className="mt-6 max-w-3xl border border-zinc-200 p-4">
      <summary className="cursor-pointer font-medium">Neue Runde</summary>
      <form action={requestRound} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Feld
          <input name="field_name" required list="review-fields" placeholder="z. B. technology_field" aria-describedby="field-hint" />
          <datalist id="review-fields">
            {KNOWN_FIELDS.map((field) => (
              <option key={field} value={field}>
                {fieldLabel(field)}
              </option>
            ))}
          </datalist>
        </label>
        <label className={LABEL}>
          Art
          <select name="kind" defaultValue="shown">
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Quelle
          <input name="source_key" placeholder="z. B. website_discovery" aria-describedby="field-hint" />
        </label>
        <label className={LABEL}>
          Modus
          <select name="mode" defaultValue="measure">
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Größe
          <input name="size" type="number" min={1} max={MAX_SIZE} defaultValue={DEFAULT_SIZE} required />
        </label>
        <label className={LABEL}>
          Titel (optional)
          <input name="title" maxLength={200} />
        </label>
        <p id="field-hint" className="text-xs text-zinc-500 sm:col-span-2">
          Feld und Quelle wie in der Datenbank (Quellen-Seite). Lücken brauchen keine Quelle. Die Runde wird
          innerhalb von 5 Minuten gezogen; findet sich nichts, steht der Grund unten.
        </p>
        <div className="sm:col-span-2">
          <button type="submit">Runde anfragen</button>
        </div>
      </form>
    </details>
  );
}

/** Open and failed requests, so everyone sees what is coming and why one failed. */
export function RequestList({ requests }: { requests: RoundRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="mt-6 max-w-3xl" aria-labelledby="requests-heading">
      <h2 id="requests-heading" className="text-lg font-semibold">
        Angefragte Runden
      </h2>
      <ul className="mt-2 space-y-2 text-sm">
        {requests.map((r) => (
          <li key={r.id}>
            <span className="font-medium">{r.title ?? `${fieldLabel(r.field_name)} · ${KIND_LABELS[r.kind]}`}</span>
            {" · "}
            {formatDate(r.requested_at)} · {STATUS_LABELS[r.status]}
            {r.error && <div className="text-red-700">Grund: {r.error}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Rename and delete for one round. Deleting asks once more and names what goes. */
export function RoundActions({ round }: { round: Round }) {
  const judged = round.results?.judged ?? 0;
  return (
    <div className="flex flex-col gap-2">
      <details>
        <summary className="cursor-pointer whitespace-nowrap">
          Umbenennen<span className="sr-only">: {round.title}</span>
        </summary>
        <form action={renameRound} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={round.id} />
          <label className={LABEL}>
            Neuer Titel
            <input name="title" required maxLength={200} defaultValue={round.title} />
          </label>
          <button type="submit">Speichern</button>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer whitespace-nowrap">
          Löschen<span className="sr-only">: {round.title}</span>
        </summary>
        <form action={deleteRound} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={round.id} />
          <p className="max-w-xs text-xs text-zinc-600">
            {judged > 0
              ? `Löscht die Runde mit ${formatNumber(judged)} Antworten. Ihre Stimmen werden zurückgenommen, auch Korrekturen, die nur aus dieser Runde kommen.`
              : "Löscht die Runde. Noch niemand hat geantwortet."}
          </p>
          <button type="submit">Endgültig löschen</button>
        </form>
      </details>
    </div>
  );
}
