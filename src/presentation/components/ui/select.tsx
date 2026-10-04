import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/presentation/lib/utils";

/** Native select styled like shadcn — best for mobile & accessibility. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className={cn("relative", className)}>
    <select
      ref={ref}
      className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
  </div>
));
NativeSelect.displayName = "NativeSelect";
