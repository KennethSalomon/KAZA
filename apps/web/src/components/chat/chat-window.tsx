'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckCheck, Paperclip, Send, ShieldCheck, X } from 'lucide-react';
import {
  listMessages,
  sendMessage,
  markConversationRead,
  agreeVisit,
  getConversation,
  getSignedStorageUrl,
} from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import type { Conversation, Message } from '@/lib/types';
import { timeAgo, formatXof } from '@/lib/format';
import { apiToast } from '@/lib/api-toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

const STORAGE_MAX = 8 * 1024 * 1024;

export function ChatWindow() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [visitModal, setVisitModal] = useState(false);
  const [isLandlord, setIsLandlord] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [list, conv] = await Promise.all([listMessages(id), getConversation(id)]);
      setMessages(list);
      setConversation(conv);
    } catch {
      toast.error('Chargement de la conversation impossible');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // note : temps réel Supabase — les messages arrivent sans rechargement
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user?.id) {
            void markConversationRead(id).catch(() => undefined);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  // marquer lu + défilement en bas
  useEffect(() => {
    if (user && messages.length > 0) {
      void markConversationRead(id).catch(() => undefined);
    }
  }, [id, user, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // URLs signées pour les pièces jointes (bucket privé) — mises en cache
  // Résolues en parallèle par lots de 6 (pas de round-trip séquentiel).
  const [signedAttachments, setSignedAttachments] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const todo: string[] = [];
      for (const m of messages) {
        for (const a of m.attachments ?? []) {
          if (a in signedAttachments) continue;
          todo.push(a);
        }
      }
      if (todo.length === 0) return;
      const pending: Record<string, string> = {};
      for (let i = 0; i < todo.length; i += 6) {
        const batch = todo.slice(i, i + 6);
        const settled = await Promise.all(
          batch.map((a) => getSignedStorageUrl('chat-files', a).catch(() => null)),
        );
        if (cancelled) return;
        settled.forEach((signed, j) => {
          if (signed) pending[batch[j]] = signed;
        });
      }
      setSignedAttachments((prev) => ({ ...prev, ...pending }));
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, signedAttachments]);

  useEffect(() => {
    void getConversation(id)
      .then((c) => setIsLandlord(c?.landlord_id === user?.id))
      .catch(() => undefined);
  }, [id, user?.id]);

  async function handleSend(e: React.FormEvent, files: File[] = []) {
    e.preventDefault();
    const text = body.trim();
    if (!text && files.length === 0) return;
    setSending(true);
    try {
      const attachments = await uploadFiles(files);
      await sendMessage(id, {
        body: text || null,
        kind: attachments.length > 0 && !text ? (attachments[0].includes('.pdf') ? 'document' : 'image') : 'text',
        attachments,
      });
      setBody('');
      setPendingFiles([]);
      void load();
    } catch (err) {
      apiToast(toast, err, 'Envoi impossible');
    } finally {
      setSending(false);
    }
  }

  async function uploadFiles(files: File[]): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      if (file.size > STORAGE_MAX) {
        toast.error('Fichier trop volumineux (max 8 Mo)');
        continue;
      }
      const path = `${user?.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await supabase.storage.from('chat-files').upload(path, file, {
        contentType: file.type,
      });
      if (error) throw error;
      urls.push(path);
    }
    return urls;
  }

  async function handleVisit(agreed: boolean) {
    setVisitModal(false);
    try {
      await agreeVisit(id, agreed);
      toast.success(agreed ? 'Visite confirmée' : 'Visite refusée');
      setBody(agreed ? '✅ Visite confirmée par le bailleur.' : '❌ Visite refusée.');
    } catch {
      toast.error('Action impossible');
    }
  }

  const isOwn = (m: Message) => m.sender_id === user?.id;

  return (
    <div className="flex flex-col h-full min-h-0 max-h-[calc(100dvh-4rem)] rounded-kaza-lg border border-kaza-border bg-kaza-surface shadow-card md:max-h-[calc(100dvh-5rem)]">
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b border-kaza-border px-4 py-3">
        <button
          onClick={() => router.push('/chat')}
          className="rounded-lg p-1.5 text-kaza-muted transition-colors hover:bg-kaza-bg hover:text-kaza-text md:hidden"
          aria-label="Retour à la liste"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="grid h-9 w-9 place-items-center rounded-full border border-kaza-brand/25 bg-kaza-brand/10 text-xs font-bold text-kaza-brand">
          {conversation?.peer?.full_name
            ?.split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() ?? 'KZ'}
        </span>
        <div>
          <p className="text-sm font-semibold text-kaza-text">
            {conversation?.peer?.full_name ?? 'Conversation'}
          </p>
          <p className="text-xs text-kaza-faint">
            {conversation?.residence?.title ?? 'Chat privé sécurisé'}{conversation?.residence ? ` · ${formatXof(conversation.residence.price_monthly)}/mois` : ' · pièces jointes acceptées'}
          </p>
        </div>
        {isLandlord && (
          <Button variant="success" size="sm" className="ml-auto" onClick={() => setVisitModal(true)}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Valider une visite
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {loading && <p className="text-center text-sm text-kaza-faint">Chargement…</p>}
        {!loading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-kaza-faint">
            Dites bonjour et négociez votre visite en toute confiance.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', isOwn(m) ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[82%] rounded-kaza px-3.5 py-2.5 text-sm leading-relaxed',
                isOwn(m) ? 'bg-kaza-brand/15 text-kaza-text' : 'bg-kaza-bg text-kaza-text',
                m.kind === 'visit_agreed' && 'border border-kaza-brand/40 bg-kaza-brand/10',
              )}
            >
              {m.attachments.map((a, i) => {
                const url = signedAttachments[a];
                const isPdf = a.endsWith('.pdf') || a.includes('application/pdf');
                if (!url) {
                  return (
                    <span key={i} className="mb-1.5 flex items-center gap-2 rounded-kaza border border-kaza-border bg-kaza-raised px-3 py-2 text-xs text-kaza-muted">
                      <Paperclip className="h-3.5 w-3.5" aria-hidden /> {isPdf ? 'Document' : 'Image'} joint
                    </span>
                  );
                }
                return isPdf ? (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1.5 flex items-center gap-2 rounded-kaza border border-kaza-border bg-kaza-raised px-3 py-2 text-xs text-kaza-brand hover:border-kaza-brand/50"
                  >
                    <Paperclip className="h-3.5 w-3.5" aria-hidden /> Document joint
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="Pièce jointe" className="mb-1.5 max-h-56 rounded-kaza border border-kaza-border object-cover" />
                );
              })}
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              <p className={cn('mt-1 flex items-center gap-1 text-[10px]', isOwn(m) ? 'justify-end text-kaza-faint' : 'text-kaza-faint')}>
                {timeAgo(m.created_at)}
                {isOwn(m) && (m.read_at ? <CheckCheck className="h-3 w-3 text-kaza-brand" aria-label="Lu" /> : <Check className="h-3 w-3" aria-label="Envoyé" />)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Pièces jointes en attente */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-kaza-border px-4 pt-3">
          {pendingFiles.map((f, i) => (
            <span key={i} className="relative flex items-center gap-2 rounded-kaza border border-kaza-border bg-kaza-bg px-3 py-1.5 text-xs text-kaza-muted">
              {f.name.slice(0, 24)}
              <button onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))} className="text-kaza-faint hover:text-kaza-danger" aria-label="Retirer le fichier">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Saisie */}
      <form onSubmit={(e) => void handleSend(e, pendingFiles)} className="flex items-center gap-2 border-t border-kaza-border p-3">
        <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-kaza text-kaza-muted transition-colors hover:bg-kaza-bg hover:text-kaza-brand" title="Joindre une photo ou un document">
          <Paperclip className="h-4.5 w-4.5" aria-hidden />
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            className="sr-only"
            aria-label="Joindre un fichier"
            onChange={(e) => setPendingFiles([...pendingFiles, ...Array.from(e.target.files ?? [])])}
          />
        </label>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écrivez votre message…"
          aria-label="Message"
          className="kaza-input flex-1"
          maxLength={4000}
        />
        <Button type="submit" size="icon" loading={sending} disabled={!body.trim() && pendingFiles.length === 0} aria-label="Envoyer">
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </form>

      {/* Modale de validation de visite (bailleur) */}
      <Modal open={visitModal} onClose={() => setVisitModal(false)} title="Valider une visite">
        <p className="text-sm leading-relaxed text-kaza-muted">
          Confirmez au locataire que vous acceptez la visite. Le bien passera en statut « En visite »
          jusqu’à votre décision.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => void handleVisit(false)}>
            Refuser
          </Button>
          <Button className="flex-1" onClick={() => void handleVisit(true)}>
            Confirmer la visite
          </Button>
        </div>
      </Modal>
    </div>
  );
}