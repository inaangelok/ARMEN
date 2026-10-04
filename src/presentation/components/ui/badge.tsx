import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/presentation/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground",
      ok: "border-ok/20 bg-ok-soft text-ok-fg",
      warn: "border-warn/25 bg-warn-soft text-warn-fg",
      crit: "border-crit/20 bg-crit-soft text-crit-fg",
      info: "border-info/20 bg-info-soft text-info-fg",
      muted: "border-transparent bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
