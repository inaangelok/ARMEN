export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="#22382F" />
      <rect x="11" y="12" width="18" height="21" rx="3" fill="none" stroke="#fff" strokeWidth="2.2" />
      <rect x="16" y="8.5" width="8" height="3.5" rx="1.2" fill="#fff" />
      <path d="M21.5 15.5 16.5 23h4l-1.5 6.5 5.5-8h-4z" fill="#7EE0A6" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <Logo />
      <div className="leading-none">
        <div className="text-[15px] font-extrabold tracking-tight text-brand-700">ARMEN Care</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Energy storage</div>
      </div>
    </div>
  );
}
