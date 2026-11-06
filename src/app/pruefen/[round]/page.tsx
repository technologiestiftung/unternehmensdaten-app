import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { CLASSIFICATIONS, type TechnologyField, type WzDivision } from "@/lib/classifications";
import { UUID } from "@/lib/format";
import { hasura } from "@/lib/hasura";
import { KIND_LABELS, MODE_LABELS, optionsFor, reasonsFor, REVIEW_PATH, reviewEnabled, ROUND, type Round, type Task } from "@/lib/review";
import { fieldLabel } from "@/lib/sources";
import { Judge, type Option } from "./judge";

/** Judging one round: one card per company, answers saved at once. */
export default async function ReviewRoundPage({ params }: { params: Promise<{ round: string }> }) {
  const { round: id } = await params;
  const session = await requireSession();
  if (!UUID.test(id) || !(await reviewEnabled(session.accessToken))) notFound();
  const { review_rounds } = await hasura<{ review_rounds: (Round & { tasks: Task[] })[] }>(
    ROUND,
    { id },
    session.accessToken,
  );
  const round = review_rounds[0];
  if (!round) notFound();

  const list = optionsFor(round.feedback_field ?? round.field_name);
  let options: Option[] = [];
  if (list) {
    const data = await hasura<{ technology_fields: TechnologyField[]; wz_divisions: WzDivision[] }>(
      CLASSIFICATIONS,
      {},
      session.accessToken,
    );
    options =
      list === "technology_field"
        ? data.technology_fields.map((f) => ({
            value: f.name_en,
            label: f.name,
            detail: f.keywords.filter((k) => !k.removed_at).map((k) => k.keyword).join(", "),
            group: f.name_en,
          }))
        : data.wz_divisions.map((d) => ({
            value: d.division,
            label: `${d.division} ${d.title}`,
            detail: "",
            group: `${d.section} ${d.section_title}`,
          }));
  }

  return (
    <>
      <Link href={REVIEW_PATH} className="text-sm text-zinc-500 hover:text-zinc-900 hover:no-underline">
        ← alle Runden
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{round.title}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {fieldLabel(round.field_name)} · {round.source_key ?? "alle Quellen"} · {KIND_LABELS[round.kind]} ·{" "}
        {MODE_LABELS[round.mode]}
        {round.version ? ` · Version ${round.version}` : ""}
        {" · "}
        <Link href={`${REVIEW_PATH}/${round.id}/ergebnis`}>Ergebnis</Link>
      </p>
      <Judge
        gap={round.kind === "gap"}
        source={round.source_key}
        fieldLabel={fieldLabel(round.feedback_field ?? round.field_name)}
        reasons={reasonsFor(round.feedback_field ?? round.field_name)}
        options={options}
        optionsGrouped={list === "wz"}
        tasks={round.tasks}
        userId={session.userId ?? ""}
      />
    </>
  );
}
