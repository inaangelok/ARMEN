import { DomainError, RuleValidationError, validateThresholds, type AlertRule } from "@/domain";
import type { AlertRepository } from "../ports";

export const makeAlertUseCases = (alerts: AlertRepository) => ({
  acknowledgeAlert: (id: string) => alerts.setAlertStatus(id, "acknowledged"),
  resolveAlert: (id: string) => alerts.setAlertStatus(id, "resolved"),

  /** Admin changes the warning / critical levels of a threshold rule. */
  async updateThresholds(rule: Pick<AlertRule, "id" | "kind" | "operator">, warning: number, critical: number): Promise<void> {
    if (rule.kind !== "threshold") throw new DomainError("THRESHOLD_NOT_NUMBER");
    try {
      validateThresholds(rule.operator, warning, critical);
    } catch (e) {
      if (e instanceof RuleValidationError) throw new DomainError(e.code);
      throw e;
    }
    await alerts.updateRule(rule.id, { warning_threshold: warning, critical_threshold: critical });
  },
  setRuleEnabled: (id: string, enabled: boolean) => alerts.updateRule(id, { enabled }),
});
