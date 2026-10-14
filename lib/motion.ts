export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

export function applyMotion(
  node: HTMLElement,
  next: { opacity: number; y: number },
): void {
  node.style.opacity = String(next.opacity);
  node.style.transform = `translate3d(0, ${next.y}px, 0)`;
}

export function animate(options: {
  durationMs: number;
  onFrame: (linearT: number) => void;
  onDone?: () => void;
}): () => void {
  if (options.durationMs <= 0) {
    options.onFrame(1);
    options.onDone?.();
    return () => {};
  }

  let raf = 0;
  let stopped = false;
  const start = performance.now();

  const tick = (now: number) => {
    if (stopped) return;
    const t = Math.min(1, (now - start) / options.durationMs);
    options.onFrame(t);
    if (t < 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    options.onDone?.();
  };

  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
