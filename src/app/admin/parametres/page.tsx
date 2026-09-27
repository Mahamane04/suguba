'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Trash2 } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import EconomicSettingsPanel from '@/components/admin/EconomicSettingsPanel';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { sugubaStore, definirApercuAdmin } from '@/lib/store';
import { usePermission } from '@/components/admin/contexte';
import type { UserRole } from '@/types';

/**
 * Paramètres et commissions (lot U2, 2026-09-27) — sortis de l'ancienne vue
 * d'ensemble, où ils s'affichaient en plein milieu des files de travail (le
 * menu pointait vers une ancre #reglages). Ici aussi : « Tester un profil »
 * et le nettoyage de l'affichage de CET appareil (jamais la base).
 */

/** Rôles que l'admin peut prévisualiser (voir /api/admin/preview-role). */
const ROLES_APERCU: { role: string; libelle: string; chemin: string }[] = [
  { role: 'customer', libelle: 'Client', chemin: '/' },
  { role: 'reseller', libelle: 'Revendeur', chemin: '/reseller' },
  { role: 'supplier', libelle: 'Fournisseur', chemin: '/supplier' },
  { role: 'diaspora', libelle: 'Diaspora', chemin: '/diaspora' },
];

export default function ParametresAdminPage() {
  const router = useRouter();
  const { toast, confirmer } = useToast();
  const peutApercu = usePermission('plateforme.parametres');
  const [apercuEnCours, setApercuEnCours] = useState<string | null>(null);

  // « Tester un profil » (2026-09-11) : identité de test dédiée, jamais celle
  // de l'admin (voir la route). Un bandeau rappelle qu'on est en aperçu.
  const ouvrirApercu = async (role: string, chemin: string) => {
    setApercuEnCours(role);
    try {
      const res = await fetch('/api/admin/preview-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast(json.error || 'Impossible d’ouvrir l’aperçu.', { ton: 'erreur' }); return; }
      sugubaStore.definirUtilisateur({ id: `apercu-${role}`, fullName: '', phone: '', role: role as UserRole, city: 'Bamako' });
      definirApercuAdmin(true);
      router.push(chemin);
    } catch {
      toast('Erreur réseau.', { ton: 'erreur' });
    } finally {
      setApercuEnCours(null);
    }
  };

  const vider = async (garderProduits: boolean) => {
    const ok = await confirmer({
      titre: garderProduits ? 'Vider l’affichage de cet appareil ?' : 'Vider aussi l’affichage du catalogue ?',
      message: 'Seul ce navigateur est concerné. La base n’est pas touchée : les vraies commandes, retraits et produits réapparaissent au prochain chargement.',
      confirmer: 'Vider', danger: true,
    });
    if (!ok) return;
    sugubaStore.purgeAllGhostData({ keepProducts: garderProduits });
    toast('Affichage de cet appareil vidé. La base est inchangée.', { ton: 'succes' });
  };

  return (
    <PageReseau titre="Paramètres et commissions" large sousTitre="Coûts, marge minimale, commissions, livraison. Chaque changement est inscrit au journal.">
      <EconomicSettingsPanel ouvertParDefaut />

      <div className="grid lg:grid-cols-2 gap-4">
        {peutApercu && (
          <Card className="!bg-amber-50 !border-amber-200 space-y-3" padding="p-5">
            <div className="flex items-start gap-2.5">
              <Eye className="w-5 h-5 text-amber-900 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-amber-950">Tester un profil</h2>
                <p className="text-xs text-amber-900">Ouvre l’espace choisi avec un compte de test dédié (jamais le vôtre). ⚠️ Les actions faites en aperçu écrivent pour de vrai : à nettoyer vous-même ensuite.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ROLES_APERCU.map(({ role, libelle, chemin }) => (
                <Button key={role} variant="ghost" size="sm" disabled={apercuEnCours !== null} onClick={() => ouvrirApercu(role, chemin)}>
                  {apercuEnCours === role ? 'Ouverture…' : libelle}
                </Button>
              ))}
            </div>
          </Card>
        )}

        <Card className="space-y-3" padding="p-5">
          <div className="flex items-start gap-2.5">
            <Trash2 className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Affichage de cet appareil</h2>
              <p className="text-xs text-slate-600">Efface les données de démonstration gardées par ce navigateur, pour repartir d’un écran propre. Ne supprime rien en base.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => vider(true)}>Vider (garder les produits)</Button>
            <Button variant="ghost" size="sm" onClick={() => vider(false)}>Vider aussi le catalogue</Button>
          </div>
        </Card>
      </div>
    </PageReseau>
  );
}
