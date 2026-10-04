import { DomainError } from "../errors/domain-error";

export function validateInvite(email: string, fullName: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new DomainError("EMAIL_INVALID");
  if (!fullName.trim()) throw new DomainError("NAME_REQUIRED");
}
