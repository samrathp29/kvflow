export const APP_VIEWS = ["lab", "inspector", "methodology"] as const;

export type AppView = (typeof APP_VIEWS)[number];

export type LabPane = "residency" | "timeline" | "charts";

export function viewFromHash(hash: string): AppView {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  if (id === "inspector" || id === "methodology") return id;
  return "lab";
}

export function hashForView(view: AppView): string {
  return view === "lab" ? "" : `#${view}`;
}
