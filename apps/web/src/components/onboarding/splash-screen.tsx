'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Building2 } from 'lucide-react';
import Image from 'next/image';

const FULL_TEXT = 'Trouvez votre logement sans démarcheur ni commission.';

export function SplashScreen({ onFinished }: { readonly onFinished: () => void }) {
  const [showLogo, setShowLogo] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [showLoader, setShowLoader] = useState(false);
  const [imgError, setImgError] = useState(false);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const startLogo = window.setTimeout(() => setShowLogo(true), 100);
    const startTitle = window.setTimeout(() => setShowTitle(true), 400);

    const startText = window.setTimeout(() => {
      if (prefersReducedMotion) {
        setDisplayedText(FULL_TEXT);
        setShowLoader(true);
        timeoutRef.current = window.setTimeout(() => {
          onFinishedRef.current();
        }, 1400);
        return;
      }

      let index = 0;
      intervalRef.current = window.setInterval(() => {
        index += 1;
        setDisplayedText(FULL_TEXT.slice(0, index));
        if (index >= FULL_TEXT.length) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          setShowLoader(true);
          timeoutRef.current = window.setTimeout(() => {
            onFinishedRef.current();
          }, 1400);
        }
      }, 30);
    }, 650);

    return () => {
      window.clearTimeout(startLogo);
      window.clearTimeout(startTitle);
      window.clearTimeout(startText);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [prefersReducedMotion]);

  const cursorVisible = displayedText.length < FULL_TEXT.length && !prefersReducedMotion;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-kaza-bg px-6 py-12 text-kaza-text select-none">
      <div className="flex-1" />

      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {/* Container du Logo KAZA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: showLogo ? 1 : 0, scale: showLogo ? 1 : 0.85, y: showLogo ? 0 : 20 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 flex h-24 w-24 items-center justify-center rounded-[28px] border border-kaza-border bg-kaza-surface p-3 shadow-card"
        >
          {!imgError ? (
            <Image
              src="/icons/kaza.svg"
              alt="KAZA Logo"
              width={64}
              height={64}
              className="h-16 w-16 object-contain rounded-2xl"
              onError={() => setImgError(true)}
              priority
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-kaza-brand text-white shadow-sm">
              <Building2 className="h-8 w-8 text-kaza-peach" />
            </div>
          )}
        </motion.div>

        {/* Titre Kaza */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: showTitle ? 1 : 0, y: showTitle ? 0 : 16 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-5xl font-extrabold tracking-tight text-kaza-brand sm:text-6xl"
        >
          Kaza
        </motion.h1>

        {/* Texte dactylo d'accroche */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
          className="mt-5 min-h-[64px] max-w-md font-sans text-base leading-relaxed text-kaza-muted sm:text-lg"
        >
          {displayedText}
          <span
            className={`ml-0.5 inline-block font-semibold text-kaza-brand ${
              cursorVisible ? 'animate-pulse opacity-100' : 'opacity-0'
            }`}
          >
            |
          </span>
        </motion.p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-end gap-6">
        {/* Spinner de chargement */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: showLoader ? 1 : 0, scale: showLoader ? 1 : 0.8 }}
          transition={{ duration: 0.3 }}
          className="flex h-8 w-8 items-center justify-center"
        >
          <Loader2 className="h-7 w-7 animate-spin text-kaza-brand" aria-label="Chargement en cours" />
        </motion.div>

        <p className="font-sans text-xs font-medium tracking-wide text-kaza-faint">
          v1.0 · Cotonou, Bénin
        </p>
      </div>
    </div>
  );
}
