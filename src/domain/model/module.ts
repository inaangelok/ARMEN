export type ModuleGrade = "A" | "B" | "C";

export type ModuleStatus = "active" | "faulty" | "replaced" | "spare";

export interface Module {
  id: string;
  serial: string;
  station_id: string | null;
  row: number | null; // 1-based
  slot: number | null; // 1-based
  grade: ModuleGrade;
  status: ModuleStatus;
  install_date: string | null;
  manufacture_date: string;
  origin: string; // e.g. donor EV pack for second-life modules
  initial_soh: number;
}

export interface ModuleAssignment {
  id: string;
  module_id: string;
  station_id: string;
  row: number;
  slot: number;
  installed_at: string;
  removed_at: string | null;
  grade_at_install: ModuleGrade;
  soh_at_install: number;
  soh_at_removal: number | null;
  removal_reason: string | null;
  work_order_id: string | null;
}
