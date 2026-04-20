"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadHCaptchaScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.hcaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-hcaptcha-script]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load hCaptcha.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.hcaptchaScript = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load hCaptcha."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function HCaptchaWidget({
  siteKey,
  onVerify,
  onExpire,
  resetSignal,
}: {
  siteKey?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  resetSignal?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
  }, [onExpire, onVerify]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    loadHCaptchaScript()
      .then(() => {
        if (cancelled || !window.hcaptcha || !containerRef.current || widgetIdRef.current) return;

        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onVerifyRef.current(token),
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => onExpireRef.current?.(),
        });
      })
      .catch(() => onExpireRef.current?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.hcaptcha?.remove) {
        window.hcaptcha.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (widgetIdRef.current) {
      window.hcaptcha?.reset(widgetIdRef.current);
      onExpireRef.current?.();
    }
  }, [resetSignal]);

  if (!siteKey) {
    return (
      <p className="rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        hCaptcha site key is missing. Add `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` before enabling CAPTCHA.
      </p>
    );
  }

  return <div id={`hcaptcha-${id}`} ref={containerRef} className="min-h-[78px]" />;
}
