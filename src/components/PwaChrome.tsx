"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaChrome({
  onFlash,
}: {
  onFlash?: (msg: string) => void;
}) {
  const [offline, setOffline] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferred(null);
      onFlash?.("Discipline o‘rnatildi");
    });

    try {
      setDismissed(localStorage.getItem("distipline-install-dismiss") === "1");
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, [onFlash]);

  async function install() {
    if (!deferred) {
      setShowHelp(true);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") onFlash?.("O‘rnatish boshlandi");
    setDeferred(null);
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem("distipline-install-dismiss", "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {offline ? (
        <div className="offline-banner" role="status">
          Oflayn rejim — saqlangan sahifa va ikonkalar ishlaydi. API yangilanmaydi.
        </div>
      ) : null}

      {!installed && !dismissed ? (
        <div className="install-banner">
          <div>
            <strong>Discipline ilovasini o‘rnating</strong>
            <p>Bosh ekranga qo‘shing — tezkor ochiladi, oflayn ishlaydi.</p>
          </div>
          <div className="install-actions">
            <button className="btn btn-primary" type="button" onClick={() => void install()}>
              O‘rnatish
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowHelp(true)}>
              Qanday?
            </button>
            <button className="icon-btn" type="button" aria-label="Yopish" onClick={dismiss}>
              ×
            </button>
          </div>
        </div>
      ) : null}

      {showHelp ? (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-label="PWA o‘rnatish">
          <button className="sheet-backdrop" type="button" onClick={() => setShowHelp(false)} />
          <div className="sheet-panel install-help">
            <div className="sheet-head">
              <h3>Discipline — o‘rnatish</h3>
              <button className="icon-btn" type="button" onClick={() => setShowHelp(false)}>
                ×
              </button>
            </div>
            <ol className="install-steps">
              <li>
                <strong>Android (Chrome):</strong> menyu → «Add to Home screen» / «Ilovani o‘rnatish».
              </li>
              <li>
                <strong>iPhone (Safari):</strong> Ulashish → «Add to Home Screen».
              </li>
              <li>
                <strong>Desktop (Chrome/Edge):</strong> manzil qatori o‘ngida o‘rnatish ikonkasi.
              </li>
            </ol>
            <p className="muted">
              O‘rnatilgach ilova alohida oynada (standalone) ochiladi. Forest-yashil splash va ikonka
              ko‘rinadi.
            </p>
            {deferred ? (
              <button className="btn btn-primary" type="button" onClick={() => void install()}>
                Brauzer o‘rnatish oynasini ochish
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export async function requestBrowserNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export function sendLocalNotify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "distipline-local",
    });
  } catch {
    /* ignore */
  }
}
