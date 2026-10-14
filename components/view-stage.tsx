"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, applyMotion, easeInCubic, easeOutQuint } from "@/lib/motion";
import type { AppView } from "@/lib/views";

export function ViewStage({
  view,
  reducedMotion,
  panes,
}: {
  view: AppView;
  reducedMotion: boolean;
  panes: Record<AppView, ReactNode>;
}) {
  const [rendered, setRendered] = useState(view);
  const nodeRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(view);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || reducedMotion || renderedRef.current === "lab") return;
    applyMotion(node, { opacity: 0, y: 42 });
    node.style.willChange = "transform, opacity";
    return animate({
      durationMs: 640,
      onFrame(t) {
        const u = easeOutQuint(t);
        applyMotion(node, { opacity: u, y: 42 * (1 - u) });
      },
      onDone() {
        node.style.willChange = "auto";
      },
    });
  }, [reducedMotion]);

  useEffect(() => {
    if (view === renderedRef.current) return;
    const node = nodeRef.current;

    if (!node || reducedMotion) {
      renderedRef.current = view;
      if (node) applyMotion(node, { opacity: 1, y: 0 });
      return;
    }

    let cancelled = false;
    const stopRef = { current: () => {} };
    node.style.willChange = "transform, opacity";

    stopRef.current = animate({
      durationMs: 300,
      onFrame(t) {
        const u = easeInCubic(t);
        applyMotion(node, { opacity: 1 - u, y: -24 * u });
      },
      onDone() {
        if (cancelled) return;
        renderedRef.current = view;
        setRendered(view);
        applyMotion(node, { opacity: 0, y: 42 });
        requestAnimationFrame(() => {
          if (cancelled) return;
          stopRef.current = animate({
            durationMs: 640,
            onFrame(t) {
              const u = easeOutQuint(t);
              applyMotion(node, { opacity: u, y: 42 * (1 - u) });
            },
            onDone() {
              if (!cancelled) node.style.willChange = "auto";
            },
          });
        });
      },
    });

    return () => {
      cancelled = true;
      stopRef.current();
    };
  }, [view, reducedMotion]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={nodeRef} className="flex min-h-0 flex-1 flex-col">
        {panes[reducedMotion ? view : rendered]}
      </div>
    </div>
  );
}

export function Reveal({
  show,
  reducedMotion,
  children,
}: {
  show: boolean;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!show || !node) return;
    if (reducedMotion) {
      applyMotion(node, { opacity: 1, y: 0 });
      return;
    }
    applyMotion(node, { opacity: 0, y: 36 });
    node.style.willChange = "transform, opacity";
    return animate({
      durationMs: 720,
      onFrame(t) {
        const u = easeOutQuint(t);
        applyMotion(node, { opacity: u, y: 36 * (1 - u) });
      },
      onDone() {
        node.style.willChange = "auto";
      },
    });
  }, [show, reducedMotion]);

  if (!show) return null;
  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-1 flex-col"
      style={reducedMotion ? undefined : { opacity: 0 }}
    >
      {children}
    </div>
  );
}
