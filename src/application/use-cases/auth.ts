import type { Lang, Profile } from "@/domain";
import type { AuthPort, PushRegistrar, PushSubscriptionStore } from "../ports";

export const makeAuthUseCases = (auth: AuthPort, push: PushRegistrar, pushStore: PushSubscriptionStore) => ({
  /** Signs in and keeps the language the person chose on the login screen. */
  async signIn(email: string, password: string, uiLanguage?: Lang): Promise<Profile> {
    const profile = await auth.signIn(email.trim(), password);
    if (uiLanguage && profile.language !== uiLanguage) return auth.updateMyProfile({ language: uiLanguage });
    return profile;
  },
  signOut: () => auth.signOut(),
  getSession: () => auth.getSession(),
  changeLanguage: (language: Lang) => auth.updateMyProfile({ language }),
  updateNotificationPreferences: (patch: Partial<Pick<Profile, "notify_email" | "notify_push" | "notify_warning" | "notify_info">>) => auth.updateMyProfile(patch),
  /** Turns on push notifications on this device and remembers the choice. */
  async enablePushNotifications(): Promise<{ permission: Awaited<ReturnType<PushRegistrar["enable"]>>; profile: Profile | null }> {
    const permission = await push.enable((s) => pushStore.savePushSubscription(s));
    const profile = permission === "granted" ? await auth.updateMyProfile({ notify_push: true }) : null;
    return { permission, profile };
  },
});
