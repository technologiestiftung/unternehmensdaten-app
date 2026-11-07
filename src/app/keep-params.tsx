import type { ListParams } from "@/lib/query";

/** The list params as hidden fields, so a small GET form changes one thing and keeps the rest. */
export function KeepParams({
  params,
  except,
}: {
  params: ListParams;
  except: (keyof ListParams)[];
}) {
  return Object.entries(params)
    .filter(([key]) => !except.includes(key as keyof ListParams))
    .flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value])
        .filter(Boolean)
        .map((v, i) => (
          <input key={`${key}-${i}`} type="hidden" name={key} value={v} />
        )),
    );
}
