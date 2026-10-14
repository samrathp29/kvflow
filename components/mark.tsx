export function KvMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="5" height="20" rx="1.2" fill="currentColor" />
      <rect
        x="11"
        y="11"
        width="5"
        height="15"
        rx="1.2"
        fill="currentColor"
        opacity="0.72"
      />
      <rect
        x="19"
        y="8"
        width="5"
        height="18"
        rx="1.2"
        fill="currentColor"
        opacity="0.5"
      />
      <rect x="27" y="16" width="3" height="10" rx="1" fill="#de987c" />
    </svg>
  );
}
