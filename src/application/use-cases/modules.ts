import { validateReplacement, type Module, type ModuleGrade } from "@/domain";
import type { ModuleRepository } from "../ports";

export interface ReplaceModuleCommand {
  faulty: Module;
  newSerial: string;
  newGrade: ModuleGrade;
  newInitialSoh: number;
  reason: string;
  workOrderId: string | null;
}

export const makeModuleUseCases = (modules: ModuleRepository) => ({
  /** Swaps a module and keeps full traceability (who, when, SOH in/out, work order). */
  async replaceModule(cmd: ReplaceModuleCommand): Promise<void> {
    const registry = await modules.listModules();
    validateReplacement({ faulty: cmd.faulty, newSerial: cmd.newSerial, newGrade: cmd.newGrade, newInitialSoh: cmd.newInitialSoh, reason: cmd.reason }, registry);
    await modules.replaceModule({
      faultyModuleId: cmd.faulty.id,
      newSerial: cmd.newSerial.trim(),
      newGrade: cmd.newGrade,
      newInitialSoh: cmd.newInitialSoh,
      reason: cmd.reason.trim(),
      workOrderId: cmd.workOrderId,
    });
  },
  markModuleFaulty: (moduleId: string, reason: string) => modules.markModuleFaulty(moduleId, reason),
});
