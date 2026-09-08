/* Firebase Auth (Google Sign-In) untuk Akun Instan.
   Nilai config di bawah bersifat publik (memang dipakai di browser). */
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyAPH3s4C7MTBN0P8OXbwk8fuyblT91Mqtg",
  authDomain: "project-akuninstan.firebaseapp.com",
  projectId: "project-akuninstan",
  storageBucket: "project-akuninstan.firebasestorage.app",
  messagingSenderId: "155550064054",
  appId: "1:155550064054:web:efffda279d7fb8ff18b517",
  measurementId: "G-V4G1LJN6PD",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* Popup dulu; kalau diblokir browser (atau WebView Android) pakai redirect. */
export async function signInWithGoogle() {
  try {
    await setPersistence(firebaseAuth, browserLocalPersistence);
  } catch (_) {}
  try {
    const cred = await signInWithPopup(firebaseAuth, provider);
    return await cred.user.getIdToken();
  } catch (error) {
    const code = (error && error.code) || "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment" ||
      code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(firebaseAuth, provider);
      return null; // browser pindah halaman; hasil diambil saat kembali
    }
    if (code === "auth/popup-closed-by-user") {
      const err = new Error("Login Google dibatalkan");
      err.silent = true;
      throw err;
    }
    throw new Error(error && error.message ? error.message : "Login Google gagal");
  }
}

/* Dipanggil sekali saat app dibuka, untuk menangkap hasil signInWithRedirect. */
export async function consumeGoogleRedirect() {
  try {
    const result = await getRedirectResult(firebaseAuth);
    if (!result || !result.user) return null;
    return await result.user.getIdToken();
  } catch (_) {
    return null;
  }
}

export async function signOutGoogle() {
  try {
    const { signOut } = await import("firebase/auth");
    await signOut(firebaseAuth);
  } catch (_) {}
}
