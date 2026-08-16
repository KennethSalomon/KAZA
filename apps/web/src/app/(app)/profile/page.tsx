'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile, deleteMyAccount, ApiError } from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { supabase } from '@/lib/supabase-client';
import { useToast } from '@/components/ui/toast';
import { Trash2, UserRound } from 'lucide-react';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName, phone });
      await refresh();
      toast.success('Profil mis à jour');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      toast.info('Compte supprimé', 'Vos données ont été effacées (RGPD).');
      router.push('/');
    } catch {
      toast.error('Suppression impossible');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-kaza-text">
        <UserRound className="h-6 w-6 text-kaza-brand" aria-hidden />
        Mon profil
      </h1>
      <p className="mt-1 text-sm text-kaza-muted">Vos informations — vous restez maître de vos données.</p>

      <form onSubmit={(e) => void save(e)} className="mt-6 space-y-4">
        <Input label="Nom complet" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Téléphone" type="tel" value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} hint="Utilisé pour les alertes de relance et la connexion par code." />
        <Input label="Email" value={user?.email ?? ''} disabled hint="Immutable — contactez le support en cas de changement." />
        <Button type="submit" loading={saving}>
          Enregistrer
        </Button>
      </form>

      <section className="mt-12 rounded-kaza border border-kaza-danger/25 bg-kaza-danger/[0.06] p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-kaza-danger">
          <Trash2 className="h-4 w-4" aria-hidden />
          Supprimer mon compte
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-kaza-muted">
          Suppression définitive : profils, baux, messages et photos seront effacés (droit à
          l’effacement — Loi 2017-20 & règlement APDP). Cette action est irréversible.
        </p>
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmDelete(true)}>
          Supprimer définitivement
        </Button>
      </section>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Confirmer la suppression">
        <p className="text-sm text-kaza-muted">
          Toutes vos données seront définitivement effacées. Confirmez-vous la suppression de votre compte ?
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Annuler
          </Button>
          <Button variant="danger" className="flex-1" loading={deleting} onClick={() => void deleteAccount()}>
            Oui, supprimer
          </Button>
        </div>
      </Modal>
    </div>
  );
}