import { validateInvite, type Region, type Role } from "@/domain";
import type { UserRepository } from "../ports";

export const makeUserUseCases = (users: UserRepository) => ({
  async inviteUser(input: { email: string; full_name: string; role: Role }): Promise<void> {
    validateInvite(input.email, input.full_name);
    await users.inviteUser({ email: input.email.trim().toLowerCase(), full_name: input.full_name.trim(), role: input.role });
  },
  changeRole: (userId: string, role: Role) => users.updateProfile(userId, { role }),
  changeRegion: (userId: string, region: Region | null) => users.updateProfile(userId, { region }),
});
