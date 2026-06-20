/**
 * Register the offline shell cache service worker.
 *
 * FCM push notification support was deferred to a future implementation.
 * When re-enabled, the SW registration should send an INIT_FIREBASE
 * postMessage with the Firebase config so background push works.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app remains online-first if service worker registration is unavailable.
    })
  })
}
