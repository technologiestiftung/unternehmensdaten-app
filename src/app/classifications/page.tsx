import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import {
  CLASSIFICATIONS,
  type TechnologyField,
  technologyFieldAnchor,
  type WzDivision,
  wzAnchor,
  wzSections,
} from "@/lib/classifications";
import { formatDate } from "@/lib/format";
import { hasura } from "@/lib/hasura";

export const metadata: Metadata = { title: "Klassifikationen – Unternehmensdaten Berlin" };

/**
 * The two classifications behind a company's Technologiefeld and WZ number, read-only: what each
 * entry means and which words lead to a Technologiefeld. Removed keywords stay listed with their
 * reason, because they explain why a word does not count.
 */
export default async function ClassificationsPage() {
  const session = await requireSession();
  const { technology_fields: fields, wz_divisions: divisions } = await hasura<{
    technology_fields: TechnologyField[];
    wz_divisions: WzDivision[];
  }>(CLASSIFICATIONS, {}, session.accessToken);

  return (
    <div className="mx-auto max-w-4xl">
      <h1>Klassifikationen</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Was das Technologiefeld und die WZ-Nummer eines Unternehmens bedeuten. Ein Technologiefeld wird
        aus Schlagwörtern auf den Seiten des Unternehmens abgeleitet; die WZ-Nummer kommt aus dem
        Register. Nur zum Lesen.
      </p>
      <p className="mt-3 text-sm">
        <a href="#technologiefelder">Technologiefelder ({fields.length})</a> ·{" "}
        <a href="#wz">WZ 2025 ({divisions.length} Abteilungen)</a>
      </p>

      <h2 id="technologiefelder" className="mt-10 mb-3 scroll-mt-4">
        Technologiefelder
      </h2>
      <ul className="list-none divide-y divide-zinc-100 border-t border-zinc-200 p-0">
        {fields.map((field) => {
          const active = field.keywords.filter((k) => !k.removed_at);
          const removed = field.keywords.filter((k) => k.removed_at);
          return (
            <li key={field.name} id={technologyFieldAnchor(field.name_en)} className="scroll-mt-4 py-4 text-sm">
              <h3 className="font-semibold">{field.name_en}</h3>
              <p className="mt-0.5 text-zinc-600">
                {field.name}
                {field.senweb_unit && <> · zuständig: {field.senweb_unit}</>}
              </p>
              {field.related.length > 0 && <p className="mt-1 text-zinc-600">Verwandt: {field.related.join(", ")}</p>}
              <p className="mt-2">
                <span className="text-zinc-500">Schlagwörter: </span>
                {active.length ? active.map((k) => k.keyword).join(", ") : "keine"}
              </p>
              {removed.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900">
                    {removed.length} entfernte{removed.length === 1 ? "s Schlagwort" : " Schlagwörter"}
                  </summary>
                  <ul className="mt-1 list-none space-y-1 p-0">
                    {removed.map((k) => (
                      <li key={k.keyword}>
                        <span className="line-through">{k.keyword}</span>
                        <span className="text-zinc-600">
                          {" "}
                          – {k.removed_reason ?? "ohne Begründung"} ({formatDate(k.removed_at)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <h2 id="wz" className="mt-10 mb-3 scroll-mt-4">
        WZ 2025
      </h2>
      <p className="mb-3 text-sm text-zinc-600">
        Klassifikation der Wirtschaftszweige des Statistischen Bundesamts: Abschnitte und ihre
        Abteilungen. Die ersten zwei Ziffern der WZ-Nummer eines Unternehmens sind seine Abteilung.
      </p>
      {wzSections(divisions).map((section) => (
        <section key={section.section} className="border-t border-zinc-200 py-4 text-sm">
          <h3 className="font-semibold">
            {section.section} – {section.title}
          </h3>
          <ul className="mt-2 list-none space-y-1 p-0">
            {section.divisions.map((d) => (
              <li key={d.division} id={wzAnchor(d.division)} className="scroll-mt-4">
                <span className="inline-block w-8 tabular-nums text-zinc-500">{d.division}</span>
                {d.title}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
