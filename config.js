// Daftari settings.
// googleClientId: the OAuth Client ID from Google Cloud Console (Google Auth Platform > Clients).
// While it is empty, the Google Drive section shows as "not set up".
// authWorker: the Cloudflare Worker address (worker/auth-worker.js). With it, Drive stays
// linked without asking Google again; without it, Google asks about once an hour.
window.DAFTARI_CONFIG = {
  googleClientId: "309872061893-l5h4g0ldu1m7do7cqpih8b1jokk0pce0.apps.googleusercontent.com",
  authWorker: "https://daftari-auth.mohamed-hassan861.workers.dev"
};
