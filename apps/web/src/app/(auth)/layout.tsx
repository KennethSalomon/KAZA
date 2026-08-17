import type { Metadata } from 'next';
import { Building2, MapPin, ReceiptText, Smartphone } from 'lucide-react';

export const metadata: Metadata = { title: 'Connexion' };

const FEATURES = [
  { icon: MapPin, title: 'Recherche géolocalisée', text: 'Trouvez un logement libre près de vous, sur carte.' },
  { icon: Smartphone, title: 'Mobile money', text: 'MTN MoMo, Moov Money, Celtiis — payez votre loyer en 30 secondes.' },
  { icon: ReceiptText, title: 'Quittances signées', text: 'PDF horodaté, valable légalement au Bénin.' },
];

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Panneau de marque */}
      <aside className="relative hidden overflow-hidden border-r border-kaza-border bg-gradient-to-br from-kaza-brand via-[#0C3E25] to-[#082C1A] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(700px 400px at 20% 10%, rgba(242,176,145,0.22), transparent 60%), radial-gradient(600px 500px at 90% 90%, rgba(255,255,255,0.06), transparent 60%)',
          }}
        />
        <div className="relative">
          <p className="font-display text-2xl font-bold tracking-tight text-white">
            KAZA
          </p>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-balance text-white">
            Louer au Bénin, <span className="text-kaza-peach">simplement</span> et en sécurité.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            La plateforme de gestion locative qui connecte locataires et bailleurs à Cotonou et
            ailleurs.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-kaza-peach">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{f.title}</p>
                  <p className="text-xs leading-relaxed text-white/65">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} KAZA — Cotonou, Bénin. Données protégées (APDP).
        </p>
      </aside>

      {/* Zone formulaire */}
      <main className="flex items-center justify-center bg-kaza-bg px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <p className="mb-8 flex items-center gap-2 font-display text-xl font-bold text-kaza-text lg:hidden">
            <Building2 className="h-5 w-5 text-kaza-brand" aria-hidden />
            KAZA
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}