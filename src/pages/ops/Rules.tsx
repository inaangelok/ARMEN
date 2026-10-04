import { useEffect, useState } from "react";
import { Lock, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/StatusBadge";
import { useRules } from "@/hooks/data";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ago } from "@/lib/format";
import type { AlertRule } from "@/lib/types";

function RuleRow({ rule, editable }: { rule: AlertRule; editable: boolean }) {
  const { t } = useTranslation();
  const [w, setW] = useState(rule.warning_threshold ?? 0);
  const [c, setC] = useState(rule.critical_threshold ?? 0);
  useEffect(() => {
    setW(rule.warning_threshold ?? 0);
    setC(rule.critical_threshold ?? 0);
  }, [rule]);
  const dirty = w !== rule.warning_threshold || c !== rule.critical_threshold;
  const invalid = rule.operator === ">" ? c <= w : c >= w;
  const save = async () => {
    await api.updateRule(rule.id, { warning_threshold: w, critical_threshold: c });
    toast.success(t("rules.saved"));
  };
  return (
    <tr className="align-middle">
      <td className="px-3 py-3">
        <div className="font-semibold">{t(`alertCode.${rule.code}.title`)}</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {rule.code}
          {rule.metric && ` · ${rule.metric}`}
        </div>
      </td>
      {rule.kind === "threshold" ? (
        <>
          <td className="px-3 py-3">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm">{rule.operator}</span>
              <Input type="number" step="any" value={w} disabled={!editable} onChange={(e) => setW(Number(e.target.value))} className="h-9 w-24" aria-label={`${t("severity.warning")} ${rule.code}`} />
              <span className="text-xs text-muted-foreground">{rule.unit}</span>
            </div>
          </td>
          <td className="px-3 py-3">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm">{rule.operator}</span>
              <Input type="number" step="any" value={c} disabled={!editable} onChange={(e) => setC(Number(e.target.value))} className="h-9 w-24" aria-label={`${t("severity.critical")} ${rule.code}`} />
              <span className="text-xs text-muted-foreground">{rule.unit}</span>
            </div>
            {invalid && <div className="mt-1 text-xs text-crit-fg">{t("rules.invalid")}</div>}
          </td>
        </>
      ) : (
        <td className="px-3 py-3" colSpan={2}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("rules.event")} <SeverityBadge severity={rule.event_severity ?? "warning"} />
          </div>
        </td>
      )}
      <td className="px-3 py-3">
        <Switch checked={rule.enabled} disabled={!editable} onCheckedChange={async (v) => api.updateRule(rule.id, { enabled: v })} aria-label={t("rules.enabled")} />
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{ago(rule.updated_at)}</td>
      <td className="px-3 py-3">
        {editable && rule.kind === "threshold" && (
          <Button size="sm" disabled={!dirty || invalid} onClick={save}>
            <Save /> {t("common.save")}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function Rules() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const rules = useRules();
  const editable = user?.role === "admin";
  return (
    <div>
      <PageHeader title={t("rules.title")} subtitle={t("rules.subtitle")} />
      {!editable && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted p-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden /> {t("rules.readOnly")}
        </div>
      )}
      <Card className="overflow-hidden">
        {rules.isLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">{t("rules.rule")}</th>
                  <th className="px-3 py-2.5">{t("severity.warning")}</th>
                  <th className="px-3 py-2.5">{t("severity.critical")}</th>
                  <th className="px-3 py-2.5">{t("rules.enabled")}</th>
                  <th className="px-3 py-2.5">{t("rules.updated")}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {(rules.data ?? []).map((r) => (
                  <RuleRow key={r.id} rule={r} editable={editable} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">{t("rules.note")}</p>
    </div>
  );
}
