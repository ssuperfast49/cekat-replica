import { useEffect, useRef } from 'react';

declare global {
  interface Window { hcaptcha?: any }
}

interface HCaptchaProps {
  sitekey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  className?: string;
}

export function HCaptcha({ sitekey, onVerify, onExpire, className }: HCaptchaProps) {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    const ensureScript = () => {
      return new Promise<void>((resolve) => {
        if (window.hcaptcha) return resolve();
        const s = document.createElement('script');
        s.src = 'https://js.hcaptcha.com/1/api.js';
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    };

    ensureScript().then(() => {
      if (!widgetRef.current) return;
      if (widgetIdRef.current !== null) return;
      widgetIdRef.current = window.hcaptcha.render(widgetRef.current, {
        sitekey,
        callback: (token: string) => onVerify(token),
        'expired-callback': () => onExpire && onExpire(),
      });
    });

    return () => {
      try {
        if (widgetIdRef.current !== null && window.hcaptcha) {
          window.hcaptcha.remove(widgetIdRef.current);
        }
      } catch {}
    };
  }, [sitekey]);

  return <div className={className}><div ref={widgetRef} /></div>;
}



