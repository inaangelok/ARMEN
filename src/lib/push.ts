/** Requests notification permission and (in Supabase mode, with a VAPID key) registers a Web Push subscription. */
export async function enablePush(saveSubscription?: (s: PushSubscriptionJSON) => Promise<void>): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  const perm = await Notification.requestPermission();
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (perm !== "granted" || !vapid || !("serviceWorker" in navigator) || !saveSubscription) return perm;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const key = Uint8Array.from(atob(vapid.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(vapid.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await saveSubscription(sub.toJSON());
  } catch (e) {
    console.warn("Push subscription failed", e);
  }
  return perm;
}
