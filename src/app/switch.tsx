import type { ReactNode } from "react";

/** An on/off filter: a checkbox (so forms and screen readers see one) drawn as a square switch. */
export function Switch({
  name,
  isChecked,
  className = "",
  children,
}: {
  name: string;
  isChecked: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 text-sm ${className}`}>
      <input
        type="checkbox"
        role="switch"
        name={name}
        value="1"
        defaultChecked={isChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 border border-zinc-500 bg-white transition-colors peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-hover:border-zinc-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:bg-zinc-500 after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-white"
      />
      {children}
    </label>
  );
}
