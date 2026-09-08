/* Google Sign-In langsung (Google Identity Services), tanpa perantara Firebase.
   Karena memakai OAuth Client milik akuninstan.com, popup Google tidak lagi
   menampilkan tulisan "Lanjutkan ke project-akuninstan.firebaseapp.com". */

export const GOOGLE_CLIENT_ID =
  "838919285407-5jla1ha1huh7ljpuo68b6spl68ri3uh9.apps.googleusercontent.com";

const GSI_SRC = "https://accounts.google.com/gsi/client";

let gsiPromise = null;

function loadGis() {
  if (typeof window === "undefined") return Promise.reject(new Error("Butuh browser"));
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    return Promise.resolve(window.google);
  }
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    const script = existing || document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.accounts) resolve(window.google);
      else reject(new Error("Google Sign-In tidak bisa dimuat"));
    };
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error("Koneksi ke Google gagal. Cek internet lalu coba lagi."));
    };
    if (!existing) document.head.appendChild(script);
  });
  return gsiPromise;
}

/* Buka popup Google saat tombol diklik dan kembalikan access token.
   Token ini diverifikasi ulang di server sebelum dipakai membuat sesi. */
export async function signInWithGoogle() {
  const google = await loadGis();
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      prompt: "select_account",
      callback: (res) => {
        settled = true;
        if (res && res.access_token) resolve(res.access_token);
        else {
          const err = new Error("Login Google dibatalkan");
          err.silent = true;
          reject(err);
        }
      },
      error_callback: (err) => {
        settled = true;
        const code = (err && err.type) || "";
        const e = new Error(
          code === "popup_closed" || code === "popup_failed_to_open"
            ? "Login Google dibatalkan"
            : "Login Google gagal, coba lagi"
        );
        if (code === "popup_closed") e.silent = true;
        reject(e);
      },
    });
    try {
      client.requestAccessToken();
    } catch (err) {
      if (!settled) reject(new Error("Login Google gagal, coba lagi"));
    }
  });
}

/* Tidak ada lagi alur redirect: popup langsung memberi hasilnya. */
export async function consumeGoogleRedirect() {
  return null;
}

export function signOutGoogle() {
  try {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch (_) {}
}
