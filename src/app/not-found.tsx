import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import Header from '@/components/common/Header';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';

export const metadata: Metadata = { title: 'Page introuvable | Suguba' };

/**
 * Page « introuvable » (PUB-05, audit UI/UX du 2026-10-02). Sans elle, un lien
 * de vitrine périmé partagé sur WhatsApp (/s/…, /r/…, /boutique/…) affichait
 * la page par défaut de Next.js, en anglais, sans logo ni issue.
 */
export default function PageIntrouvable() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-12 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Cette page n’existe plus</h1>
          <p className="text-base text-slate-700">
            Le lien est peut-être ancien ou incomplet. Les produits, eux, sont toujours là.
          </p>
        </div>

        <form action="/recherche" method="get" role="search" className="flex gap-2">
          <label htmlFor="recherche-404" className="sr-only">Rechercher un produit</label>
          <input
            id="recherche-404"
            name="q"
            type="search"
            placeholder="Rechercher un produit"
            className="flex-1 min-w-0 h-12 px-4 rounded-full border border-slate-300 bg-white text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-suguba-profond"
          />
          <Button type="submit" variant="ghost" size="lg" aria-label="Rechercher" className="!px-4">
            <Search className="w-5 h-5" />
          </Button>
        </form>

        <div className="grid gap-3">
          <Button href="/" size="lg" fullWidth>Voir le catalogue</Button>
          <Button href="/track" variant="ghost" size="lg" fullWidth>Suivre une commande</Button>
        </div>

        <a
          href="https://wa.me/22389460000?text=Bonjour%20Suguba%2C%20un%20lien%20ne%20fonctionne%20plus."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-suguba-brand-dark hover:underline"
        >
          <WhatsAppIcon className="w-5 h-5" />
          Prévenir Suguba sur WhatsApp
        </a>
      </main>
    </div>
  );
}
