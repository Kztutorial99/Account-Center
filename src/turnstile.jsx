import { useEffect, useRef, useState } from "react";

/* Site key Turnstile bersifat publik (aman ada di bundel frontend). */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAEwdBVG7PVHDybxk";

let scriptPromise = null;

function loadTurnstile() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("captcha")));
      script.onerror = () => { scriptPromise = null; reject(new Error("captcha")); };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/* Hook widget captcha: pasang <Captcha state={captcha} /> lalu kirim
   captcha.token bersama request, dan captcha.reset() setelah gagal. */
export function useTurnstile() {
  const holder = useRef(null);
  const widgetId = useRef(null);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !holder.current || widgetId.current !== null) return;
        widgetId.current = ts.render(holder.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          size: "flexible",
          callback: (value) => { setToken(value); setReady(true); setFailed(false); },
          "expired-callback": () => setToken(""),
          "timeout-callback": () => setToken(""),
          "error-callback": () => { setToken(""); setFailed(true); },
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch (_) {}
      }
      widgetId.current = null;
    };
  }, []);

  const reset = () => {
    setToken("");
    if (widgetId.current !== null && window.turnstile) {
      try { window.turnstile.reset(widgetId.current); } catch (_) {}
    }
  };

  return { holder, token, reset, ready, failed };
}

export function Captcha({ state }) {
  return (
    <div className="cx-captcha">
      <div className="cx-captcha-box" ref={state.holder} />
      {state.failed && (
        <p className="cx-captcha-note">Captcha gagal dimuat. Periksa koneksi lalu muat ulang halaman.</p>
      )}
    </div>
  );
}
