'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateProfile, deleteMyAccount, ApiError } from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import { Modal } from '@/components/ui/modal';
import { supabase } from '@/lib/supabase-client';
import { useToast } from '@/components/ui/toast';

export default function ProfilePage() {
  const { user, role, refresh, signOut } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName, phone });
      await refresh();
      toast.success('Profil mis à jour');
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
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
    <div className="bg-background text-on-background min-h-screen flex flex-col pb-24 md:pb-0 -mx-4 -my-8 sm:mx-0 sm:my-0">
      {/* Desktop TopAppBar */}
      <header className="bg-surface shadow-sm w-full top-0 md:fixed z-40 hidden md:flex items-center justify-between px-margin-desktop py-base">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary font-title-lg text-title-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            location_on
          </span>
          <span className="font-display-lg text-display-lg font-bold text-primary">Casa</span>
        </div>
        <button
          aria-label="Notifications"
          className="material-symbols-outlined text-on-surface-variant font-title-lg text-title-lg hover:bg-surface-container-low transition-colors active:scale-95 duration-100 p-2 rounded-full cursor-pointer"
        >
          notifications
        </button>
      </header>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-surface shadow-sm w-full top-0 flex items-center justify-between px-margin-mobile py-base sticky z-30">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">Profil</h1>
        <button
          onClick={() => setIsEditing(!isEditing)}
          aria-label="Paramètres"
          className="material-symbols-outlined text-on-surface-variant p-2 cursor-pointer active:scale-95 transition-transform"
        >
          settings
        </button>
      </header>

      <main className="flex-grow flex flex-col items-center w-full max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg gap-stack-lg md:pt-20">
        {/* Header Profile Card */}
        <section className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.08)] p-4 flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-variant flex-shrink-0 relative shadow-sm flex items-center justify-center text-primary font-bold text-2xl">
            {user?.full_name ? (
              user.full_name.slice(0, 2).toUpperCase()
            ) : (
              <span className="material-symbols-outlined text-3xl">person</span>
            )}
          </div>
          <div className="flex flex-col flex-grow justify-center">
            <h2 className="font-title-lg text-title-lg text-on-surface mb-stack-sm">
              {user?.full_name || 'Utilisateur KAZA'}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-2">
              {user?.phone || user?.email || '+229 97 00 00 00'}
            </p>
            <div className="inline-flex items-center self-start bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-label-md text-label-md capitalize">
              {role || 'Locataire'}
            </div>
          </div>
        </section>

        {/* Edition Form (si ouvert) */}
        {isEditing && (
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.08)] p-4 space-y-4"
          >
            <h3 className="font-title-lg text-title-lg text-on-surface">Modifier mon profil</h3>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Nom complet</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-outline px-4 py-2.5 bg-surface text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-outline px-4 py-2.5 bg-surface text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg border border-outline text-on-surface font-label-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-lg"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {/* Pass Status Banner */}
        <section className="w-full max-w-md bg-tertiary-container/10 border border-tertiary-container rounded-lg p-4 flex items-start gap-3 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #004d47 0, #004d47 1px, transparent 1px, transparent 8px)',
            }}
          />
          <span
            className="material-symbols-outlined text-tertiary-container z-10 pt-1"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <div className="z-10 flex-grow">
            <h3 className="font-label-lg text-label-lg text-on-surface font-semibold mb-1">
              Pass Locataire : {user?.is_premium ? 'Premium' : 'Actif'}
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {user?.is_premium ? 'Bénéficiez de toutes les fonctionnalités premium' : 'Expire dans 18 jours'}
            </p>
          </div>
          <button className="z-10 text-primary font-label-md text-label-md hover:underline bg-transparent">
            Renouveler
          </button>
        </section>

        {/* Menu Options List (Bento-style list) */}
        <section className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-[0px_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          <nav className="flex flex-col">
            {/* Option 1 */}
            <Link
              href="/chat"
              className="flex items-center gap-4 p-4 border-b border-surface-variant hover:bg-surface-container-low transition-colors active:bg-surface-container group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                <span className="material-symbols-outlined">history</span>
              </div>
              <span className="font-body-lg text-body-lg text-on-surface flex-grow">
                Historique des numéros débloqués
              </span>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                chevron_right
              </span>
            </Link>

            {/* Option 2 */}
            <Link
              href="/favorites"
              className="flex items-center gap-4 p-4 border-b border-surface-variant hover:bg-surface-container-low transition-colors active:bg-surface-container group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                <span className="material-symbols-outlined">bookmark</span>
              </div>
              <span className="font-body-lg text-body-lg text-on-surface flex-grow">
                Mes recherches sauvegardées
              </span>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                chevron_right
              </span>
            </Link>

            {/* Option 3 */}
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-4 p-4 border-b border-surface-variant hover:bg-surface-container-low transition-colors active:bg-surface-container group text-left w-full"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                <span className="material-symbols-outlined">settings</span>
              </div>
              <span className="font-body-lg text-body-lg text-on-surface flex-grow">Paramètres du compte</span>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                chevron_right
              </span>
            </button>

            {/* Option 4 */}
            <Link
              href="/confidentialite"
              className="flex items-center gap-4 p-4 border-b border-surface-variant hover:bg-surface-container-low transition-colors active:bg-surface-container group"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                <span className="material-symbols-outlined">help_outline</span>
              </div>
              <span className="font-body-lg text-body-lg text-on-surface flex-grow">Centre d'aide / FAQ</span>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                chevron_right
              </span>
            </Link>

            {/* Option 5 Logout */}
            <button
              onClick={() => void signOut()}
              className="flex items-center gap-4 p-4 hover:bg-error-container/20 transition-colors active:bg-error-container/40 group text-left w-full"
            >
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error group-hover:bg-error group-hover:text-on-error transition-colors">
                <span className="material-symbols-outlined">logout</span>
              </div>
              <span className="font-body-lg text-body-lg text-error font-medium flex-grow">Déconnexion</span>
            </button>
          </nav>
        </section>

        {/* Account Deletion Danger Zone */}
        <div className="w-full max-w-md pt-4 text-center">
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-error hover:underline"
          >
            Supprimer définitivement mon compte
          </button>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Confirmer la suppression">
        <p className="text-sm text-on-surface-variant">
          Toutes vos données seront définitivement effacées conformément à la législation APDP. Confirmez-vous la
          suppression ?
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setConfirmDelete(false)}
            className="flex-1 py-2 rounded-lg border border-outline font-label-lg"
          >
            Annuler
          </button>
          <button
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg bg-error text-on-error font-label-lg"
          >
            {deleting ? 'Suppression...' : 'Oui, supprimer'}
          </button>
        </div>
      </Modal>

      {/* BottomNavBar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-2 bg-surface-container shadow-[0px_-1px_3px_rgba(0,0,0,0.08)] z-50">
        <Link
          href="/explorer"
          className="flex flex-col items-center justify-center text-on-surface-variant px-5 py-1 hover:bg-surface-container-high transition-all active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined mb-1">home</span>
          <span className="font-label-md text-label-md">Accueil</span>
        </Link>
        <Link
          href="/explorer"
          className="flex flex-col items-center justify-center text-on-surface-variant px-5 py-1 hover:bg-surface-container-high transition-all active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined mb-1">map</span>
          <span className="font-label-md text-label-md">Carte</span>
        </Link>
        <Link
          href="/favorites"
          className="flex flex-col items-center justify-center text-on-surface-variant px-5 py-1 hover:bg-surface-container-high transition-all active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined mb-1">favorite</span>
          <span className="font-label-md text-label-md">Favoris</span>
        </Link>
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-5 py-1 hover:bg-surface-container-high transition-all active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
            person
          </span>
          <span className="font-label-md text-label-md">Profil</span>
        </Link>
      </nav>
    </div>
  );
}