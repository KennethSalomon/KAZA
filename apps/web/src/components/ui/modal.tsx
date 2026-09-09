'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// note : modale accessible — focus trap, fermeture Échap, retour du focus
// au déclencheur, scroll bloqué, rôle dialog.
export function Modal({ open, onClose, title, children, wide }: Readonly<ModalProps>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (els.length === 0) {
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    // focus initial dans la modale (si aucun focusable, le panneau lui-même)
    const first = focusable()[0];
    if (first) {
      first.focus();
    } else {
      panelRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[900] flex items-end justify-center bg-kaza-bg/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? 'Fenêtre'}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-kaza-lg border border-kaza-border bg-kaza-surface p-6 shadow-card-hover focus:outline-none sm:rounded-kaza-lg ${
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              {title && <h2 className="font-display text-lg font-semibold text-kaza-text">{title}</h2>}
              <button
                onClick={onClose}
                className="ml-auto rounded-full p-1.5 text-kaza-faint transition-colors hover:bg-kaza-bg hover:text-kaza-text"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}