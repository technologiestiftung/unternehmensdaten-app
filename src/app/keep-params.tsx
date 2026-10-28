import type { ListParams } from "@/lib/query";

/** The list params as hidden fields, so a small GET form changes one thing and keeps the rest. */
export function KeepParams({ params, except }: { params: ListParams; except: (keyof ListParams)[] }) {
  return Object.entries(params)
    .filter(([key, value]) => value && !except.includes(key as keyof ListParams))
    .map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />);
}
