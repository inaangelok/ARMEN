import type { PushPermission, PushRegistrar, WebPushSubscription } from "@/application/ports";

/** Browser adapter for push notifications: permission prompt + service worker + Web Push subscription. */
export function createWebPushRegistrar(vapidPublicKey: string | undefined): PushRegistrar {
  return {
    async enable(save: (s: WebPushSubscription) => Promise<void>): Promise<PushPermission> {
      if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
      const perm = await Notification.requestPermission();
      if (perm !== "granted" || !vapidPublicKey || !("serviceWorker" in navigator)) return perm;
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const v = vapidPublicKey;
        const key = Uint8Array.from(atob(v.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(v.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await save(sub.toJSON());
      } catch (e) {
        console.warn("Push subscription failed", e);
      }
      return perm;
    },
  };
}
