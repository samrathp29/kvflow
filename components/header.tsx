import { KvMark } from "./mark";
import type { AppView } from "@/lib/views";

export function Header({
  view,
  onNavigate,
}: {
  view: AppView;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3 md:px-8">
      <button
        type="button"
        onClick={() => onNavigate("lab")}
        className="flex items-center gap-3 text-left"
      >
        <KvMark className="h-7 w-7 text-accent" />
        <div>
          <div className="text-[15px] font-medium tracking-tight">KVFlow</div>
          <div className="text-[10px] tracking-[0.18em] text-mute uppercase">
            Research preview
          </div>
        </div>
      </button>
      <nav className="flex items-center gap-5 text-[13px] text-mute">
        <NavButton
          active={view === "methodology"}
          onClick={() =>
            onNavigate(view === "methodology" ? "lab" : "methodology")
          }
        >
          Methodology
        </NavButton>
        <NavButton
          active={view === "inspector"}
          onClick={() => onNavigate(view === "inspector" ? "lab" : "inspector")}
        >
          Inspector
        </NavButton>
      </nav>
    </header>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`transition-colors duration-200 ${
        active ? "text-ink" : "hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
