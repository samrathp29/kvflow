"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, easeInCubic, easeOutQuint } from "@/lib/motion";

export function TuneDrawer({
  open,
  reducedMotion,
  onClose,
  children,
}: {
  open: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const openedOnce = useRef(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) openedOnce.current = true;
    if (!openedOnce.current) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel) return;

    const from = open ? -100 : 0;
    const to = open ? 0 : -100;
    if (reducedMotion) {
      panel.style.transform = `translate3d(${to}%, 0, 0)`;
      if (backdrop) backdrop.style.opacity = open ? "0.45" : "0";
      return;
    }

    panel.style.willChange = "transform";
    return animate({
      durationMs: open ? 560 : 360,
      onFrame(t) {
        const u = open ? easeOutQuint(t) : easeInCubic(t);
        const x = from + (to - from) * u;
        panel.style.transform = `translate3d(${x}%, 0, 0)`;
        if (backdrop) backdrop.style.opacity = String((open ? u : 1 - u) * 0.45);
      },
      onDone() {
        panel.style.willChange = "auto";
      },
    });
  }, [open, reducedMotion]);

  return (
    <div
      className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open || undefined}
    >
      <button
        ref={backdropRef}
        type="button"
        aria-label="Close experiment controls"
        className="absolute inset-0 bg-black"
        style={{ opacity: 0 }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 w-[min(22rem,92vw)] overflow-y-auto border-r border-border bg-background p-5"
        style={{ transform: "translate3d(-100%, 0, 0)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] tracking-[0.16em] text-mute uppercase">
            Tune experiment
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[12px] text-mute hover:text-ink"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
