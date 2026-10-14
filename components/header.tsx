import { KvMark } from "./mark";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border px-5 py-3 md:px-8">
      <div className="flex items-center gap-3">
        <KvMark className="h-7 w-7 text-accent" />
        <div>
          <div className="text-[15px] font-medium tracking-tight">KVFlow</div>
          <div className="text-[10px] tracking-[0.18em] text-mute uppercase">
            Research preview
          </div>
        </div>
      </div>
      <nav className="flex items-center gap-5 text-[13px] text-mute">
        <a className="transition-colors hover:text-ink" href="#methodology">
          Methodology
        </a>
        <a className="transition-colors hover:text-ink" href="#inspector">
          Inspector
        </a>
      </nav>
    </header>
  );
}
