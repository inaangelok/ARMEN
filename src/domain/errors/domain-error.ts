/**
 * A business rule was broken. `code` is stable and language-neutral; the presentation layer
 * turns it into a translated message (i18n key `errors.<code>`).
 */
export type DomainErrorCode =
  | "SERIAL_REQUIRED"
  | "SERIAL_IN_USE"
  | "SERIAL_SAME_AS_REMOVED"
  | "MODULE_NOT_INSTALLED"
  | "SOH_OUT_OF_RANGE"
  | "REASON_REQUIRED"
  | "THRESHOLD_ORDER"
  | "THRESHOLD_NOT_NUMBER"
  | "RESERVE_OUT_OF_RANGE"
  | "TITLE_REQUIRED"
  | "DATE_IN_PAST"
  | "INVALID_TRANSITION"
  | "COMPLETE_IN_DIALOG"
  | "SIGNATURE_REQUIRED"
  | "CHECKLIST_INCOMPLETE"
  | "WORK_ORDER_CLOSED"
  | "EMAIL_INVALID"
  | "NAME_REQUIRED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly params: Record<string, string | number>;
  constructor(code: DomainErrorCode, params: Record<string, string | number> = {}) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.params = params;
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;
