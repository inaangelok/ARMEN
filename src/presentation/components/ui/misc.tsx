import * as React from "react";
import { cn } from "@/presentation/lib/utils";

export const Separator = ({ className }: { className?: string }) => <div role="separator" className={cn("h-px w-full bg-border", className)} />;

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;

export function Progress({ value, className, indicatorClassName, label }: { value: number; className?: string; indicatorClassName?: string; label?: string }) {
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label} className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full bg-primary transition-all", indicatorClassName)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
      {icon}
      <p className="font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}
