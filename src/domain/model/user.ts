export type Role = "owner" | "technician" | "admin";

export type Lang = "hy" | "en" | "ru";

export type Region = "Aragatsotn" | "Yerevan";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  language: Lang;
  region: Region | null;
  notify_email: boolean;
  notify_push: boolean;
  notify_warning: boolean;
  notify_info: boolean;
}
