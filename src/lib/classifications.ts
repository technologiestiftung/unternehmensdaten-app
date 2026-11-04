/** One of Berlin's 77 Technologiefelder (Hasura: `technology_fields`), with its keywords. */
export type TechnologyField = {
  /** Berlin's official German name. */
  name: string;
  /** Our English name: what a company's `technology_field` stores and the app shows. */
  name_en: string;
  senweb_unit: string | null;
  related: string[];
  keywords: { keyword: string; removed_at: string | null; removed_reason: string | null }[];
};

/** One WZ 2025 division (Hasura: `wz_divisions`): the first two digits of a WZ code. */
export type WzDivision = { division: string; title: string; section: string; section_title: string };

export const CLASSIFICATIONS = `
  query Classifications {
    technology_fields(order_by: { name_en: asc }) {
      name name_en senweb_unit related
      keywords(order_by: { keyword: asc }) { keyword removed_at removed_reason }
    }
    wz_divisions(order_by: { division: asc }) { division title section section_title }
  }`;

export const CLASSIFICATIONS_PATH = "/classifications";

/** The anchor of a Technologiefeld on the page, from the English name a company shows. */
export const technologyFieldAnchor = (nameEn: string) =>
  `tf-${nameEn.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** The anchor of a WZ code's division ("62.01" → "wz-62"); undefined when it has no two leading digits. */
export const wzAnchor = (code: string) => (/^\d{2}/.exec(code) ? `wz-${code.slice(0, 2)}` : undefined);

/** The divisions grouped by section, in the order they come (sorted by division). */
export function wzSections(divisions: WzDivision[]): { section: string; title: string; divisions: WzDivision[] }[] {
  const sections = new Map<string, { section: string; title: string; divisions: WzDivision[] }>();
  for (const d of divisions) {
    const entry = sections.get(d.section) ?? { section: d.section, title: d.section_title, divisions: [] };
    entry.divisions.push(d);
    sections.set(d.section, entry);
  }
  return [...sections.values()].sort((a, b) => a.section.localeCompare(b.section));
}
