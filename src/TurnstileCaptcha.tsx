import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        theme?: 'auto' | 'light' | 'dark';
      }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileCaptchaProps = {
  siteKey: string;
  onVerify: (token: string) => void;
};

const SCRIPT_ID = 'cloudflare-turnstile-script';

export default function TurnstileCaptcha({ siteKey, onVerify }: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    let script: HTMLScriptElement | null = null;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: token => onVerifyRef.current(token),
        'expired-callback': () => onVerifyRef.current(''),
        'error-callback': () => onVerifyRef.current(''),
      });
    };

    const handleScriptError = () => {
      onVerifyRef.current('');
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
      }

      // Register listeners before inserting a new script so its load event cannot be missed.
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', handleScriptError);
      if (!script.isConnected) document.head.appendChild(script);

      // If another part of the page loaded the API between the first check and listener setup,
      // render immediately instead of waiting for an event that may already have fired.
      if (window.turnstile) renderWidget();
    }

    return () => {
      cancelled = true;
      script?.removeEventListener('load', renderWidget);
      script?.removeEventListener('error', handleScriptError);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={containerRef} aria-label="Cloudflare Turnstile verification" />;
}
