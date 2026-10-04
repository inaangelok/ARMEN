import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

export function ChartCard({ title, subtitle, loading, children, height = 200, action }: { title: string; subtitle?: string; loading?: boolean; children: ReactNode; height?: number; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        <div style={{ height }}>{loading ? <Skeleton className="h-full w-full" /> : children}</div>
      </CardContent>
    </Card>
  );
}

export const AXIS = { fontSize: 11, fill: "hsl(155 8% 40%)" };
export const GRID = "hsl(150 12% 91%)";
export const TOOLTIP_STYLE = { borderRadius: 10, border: "1px solid hsl(150 12% 89%)", fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,.06)" };
