'use client';

import { useCallback, useRef } from 'react';

/**
 * hCaptcha (widget invisible) — KAZA.
 *
 * Le sitekey est PUBLIC par design (embarqué dans le bundle navigateur).
 * Un seul script chargé pour toute l'app ; le widget est rendu à la
 * première exécution, puis le token est obtenu à la demande.
 *
 * Usage :
 *   const { execute } = useHcaptcha();
 *   const token = await execute(); // jette si hCaptcha indisponible
 */

export interface HcaptchaExecuteOptions {
  sitekey: string;
}

interface HcaptchaRenderOptions {
  sitekey: string;
  size: 'invisible';
  'error-callback'?: () => void;
}

interface HcaptchaApi {
  render(container: HTMLElement, options: HcaptchaRenderOptions): string;
  execute(widgetId: string): Promise<string>;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    hcaptcha?: HcaptchaApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadHcaptchaScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-kaza-hcaptcha]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Échec du chargement hCaptcha')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.kazaHcaptcha = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => {
      script.remove();
      scriptPromise = null;
      reject(new Error('Échec du chargement hCaptcha'));
    }, { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Exécute le captcha invisible et résout avec le token (ou jette). */
export function useHcaptcha() {
  const widgetId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const execute = useCallback(async (options: HcaptchaExecuteOptions): Promise<string> => {
    if (!options.sitekey) {
      throw new Error('CAPTCHA non configuré (NEXT_PUBLIC_HCAPTCHA_SITEKEY manquant)');
    }
    await loadHcaptchaScript();
    const api = window.hcaptcha;
    if (!api) throw new Error('hCaptcha indisponible');

    if (!widgetId.current) {
      if (!containerRef.current) {
        const host = document.createElement('div');
        host.style.display = 'none';
        document.body.appendChild(host);
        containerRef.current = host;
      }
      widgetId.current = api.render(containerRef.current, {
        sitekey: options.sitekey,
        size: 'invisible',
        'error-callback': () => {
          widgetId.current = null;
        },
      });
    }

    const token = await api.execute(widgetId.current);
    if (!token) throw new Error('Vérification anti-robot requise — réessayez');
    return token;
  }, []);

  const reset = useCallback(() => {
    if (widgetId.current && window.hcaptcha) {
      window.hcaptcha.reset(widgetId.current);
    }
  }, []);

  return { execute, reset };
}