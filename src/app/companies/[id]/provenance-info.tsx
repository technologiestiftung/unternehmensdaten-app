"use client";

import { useId, useRef } from "react";
import { formatDate } from "@/lib/format";
import { evidenceList, isRegisterDate, methodLabel, type Provenance } from "@/lib/provenance";

// Time to move the pointer from the ⓘ into the open panel before it closes.
const HIDE_DELAY_MS = 200;

/**
 * The ⓘ next to a value: where it came from. Opens on hover and on click/Enter (a native popover,
 * so Esc and clicking elsewhere close it). The popover sits in the top layer, so a scrolling table
 * cannot clip it; CSS anchor positioning keeps it next to the ⓘ. Nothing is shown when nothing is
 * known.
 */
export function ProvenanceInfo({ label, rows }: { label: string; rows: Provenance[] }) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Opened by a click: stays open when the pointer leaves.
  const isPinned = useRef(false);
  if (rows.length === 0) return null;

  const anchor = `--provenance-${id.replace(/[^\w-]/g, "")}`;
  const show = () => {
    clearTimeout(hideTimer.current);
    if (!popover.current?.matches(":popover-open")) popover.current?.showPopover();
  };
  const hideSoon = () => {
    clearTimeout(hideTimer.current);
    if (!isPinned.current) hideTimer.current = setTimeout(() => popover.current?.hidePopover(), HIDE_DELAY_MS);
  };

  return (
    <span className="ml-1 inline-block align-middle" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        type="button"
        popoverTarget={id}
        popoverTargetAction="show"
        onClick={() => (isPinned.current = true)}
        aria-label={`Herkunft: ${label}`}
        title="Herkunft"
        style={{ anchorName: anchor }}
        className="inline-flex size-4 items-center justify-center rounded-full border border-zinc-300 bg-white p-0 text-[10px] leading-none font-normal text-zinc-500 hover:bg-zinc-100"
      >
        i
      </button>
      <div
        ref={popover}
        id={id}
        popover="auto"
        onToggle={(event) => event.newState === "closed" && (isPinned.current = false)}
        style={{ positionAnchor: anchor, positionArea: "bottom span-right", positionTryFallbacks: "flip-block, flip-inline" }}
        className="m-0 mt-1 w-72 border border-zinc-200 bg-white p-3 text-left text-xs font-normal whitespace-normal text-zinc-700 shadow-sm"
      >
        {rows.map((row, index) => {
          const method = methodLabel(row);
          const evidence = evidenceList(row.evidence);
          return (
            <dl key={index} className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5 [&+&]:mt-2 [&+&]:border-t [&+&]:border-zinc-100 [&+&]:pt-2">
              <dt className="text-zinc-500">Quelle</dt>
              <dd className="m-0">{row.source_name ?? row.source_key}</dd>
              {method && (
                <>
                  <dt className="text-zinc-500">Methode</dt>
                  <dd className="m-0">{method}</dd>
                </>
              )}
              {row.confidence != null && (
                <>
                  <dt className="text-zinc-500">Konfidenz</dt>
                  <dd className="m-0">{Math.round(row.confidence * 100)} %</dd>
                </>
              )}
              {row.observed_at && (
                <>
                  <dt className="text-zinc-500">{isRegisterDate(row) ? "Registerstand" : "Erfasst"}</dt>
                  <dd className="m-0">{formatDate(row.observed_at)}</dd>
                </>
              )}
              {evidence.length > 0 && (
                <>
                  <dt className="text-zinc-500">Belege</dt>
                  <dd className="m-0">{evidence.join(", ")}</dd>
                </>
              )}
              {row.link && (
                <>
                  <dt className="text-zinc-500">Geprüft an</dt>
                  <dd className="m-0 break-all">
                    <a href={row.link} rel="noopener noreferrer nofollow" target="_blank">
                      {row.link}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          );
        })}
      </div>
    </span>
  );
}
