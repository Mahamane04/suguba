'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus, Loader2, Gift, Users } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import CarteLien from '@/components/reseau/CarteLien';
import Button from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatCard, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { useCodeRevendeur } from '@/lib/partage';

/**
 * Parrainages (§ 16 des écrans).
 *
 * Deux chemins volontairement complémentaires : le lien (le filleul arrive
 * seul, tout est automatique) et l'ajout manuel d'un numéro (le revendeur a
 * convaincu quelqu'un de vive voix, au marché — le cas le plus fréquent ici).
 */

interface Parrainage {
  id: string;
  type: 'customer' | 'reseller' | 'supplier';
  telephone: string | null;
  statut: 'pending' | 'converted' | 'rewarded' | 'rejected';
  recompense: number;
  creeLe: string;
}

const LIBELLE_TYPE: Record<string, string> = {
  customer: 'Client',
  reseller: 'Revendeur',
  supplier: 'Fournisseur',
};

export default function ParrainagesPage() {
  const { toast } = useToast();
  const code = useCodeRevendeur();
  const [parrainages, setParrainages] = useState<Parrainage[]>([]);
  const [totaux, setTotaux] = useState({ invitations: 0, clients: 0, revendeurs: 0, gains: 0 });
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [telephone, setTelephone] = useState('');
  const [type, setType] = useState<'customer' | 'reseller'>('customer');
  const [origine, setOrigine] = useState('https://app.sugubaml.com');

  useEffect(() => { setOrigine(window.location.origin); }, []);

  const charger = React.useCallback(() => {
    return fetch('/api/reseller/parrainages')
      .then((r) => r.json())
      .then((data) => {
        setParrainages(data.parrainages || []);
        if (data.totaux) setTotaux(data.totaux);
      })
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const inviter = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    try {
      const reponse = await fetch('/api/reseller/parrainages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telephone, type }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      toast('Filleul enregistré.', { ton: 'succes' });
      setTelephone('');
      await charger();
    } catch {
      toast('Enregistrement impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  const lienParrainage = `${origine}/rejoindre${code ? `?ref=${encodeURIComponent(code)}` : ''}`;

  return (
    <PageReseau
      titre="Mes parrainages"
      sousTitre="Invitez des clients et d’autres revendeurs."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
    >
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Invitations" valeur={totaux.invitations} icone={UserPlus} />
        <StatCard label="Revendeurs" valeur={totaux.revendeurs} icone={Users} />
        <StatCard label="Clients" valeur={totaux.clients} />
        <StatCard label="Gains" valeur={`${totaux.gains.toLocaleString('fr-FR')} F`} icone={Gift} accent />
      </div>

      <CarteLien
        titre="Mon lien de parrainage"
        url={lienParrainage}
        aide="Celui qui s’inscrit par ce lien vous est rattaché automatiquement."
        texteWhatsApp={`Rejoins Suguba avec moi : tu vends des produits sans stock et tu gagnes une commission sur chaque vente.\n\n👉 ${lienParrainage}`}
      />

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-900">Ajouter un filleul</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Vous avez convaincu quelqu’un de vive voix ? Enregistrez son numéro ici pour ne pas perdre le parrainage.
          </p>
        </div>
        <form onSubmit={inviter} className="space-y-3">
          <Field label="Numéro WhatsApp du filleul" htmlFor="tel-filleul" requis>
            <Input
              id="tel-filleul"
              type="tel"
              inputMode="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="76 12 34 56"
              required
            />
          </Field>
          <Field label="Il rejoint Suguba comme" htmlFor="type-filleul">
            <Select id="type-filleul" value={type} onChange={(e) => setType(e.target.value as 'customer' | 'reseller')}>
              <option value="customer">Client</option>
              <option value="reseller">Revendeur</option>
            </Select>
          </Field>
          <Button type="submit" disabled={envoi} fullWidth>
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Enregistrer le filleul
          </Button>
        </form>
      </Card>

      {chargement ? (
        <Skeleton className="h-24" />
      ) : parrainages.length === 0 ? (
        <EmptyState icone={UserPlus} titre="Aucun filleul pour l’instant" texte="Partagez votre lien : chaque inscription passée par lui apparaîtra ici." />
      ) : (
        <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
          {parrainages.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{LIBELLE_TYPE[p.type] || p.type}</p>
                <p className="text-xs text-slate-500">
                  {p.telephone ? `${p.telephone.slice(0, -4)}••` : 'Par lien'} ·{' '}
                  {new Date(p.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <StatusPill ton={p.statut === 'rewarded' ? 'succes' : p.statut === 'converted' ? 'info' : p.statut === 'rejected' ? 'danger' : 'attente'}>
                {p.statut === 'rewarded' ? `${p.recompense.toLocaleString('fr-FR')} F` :
                  p.statut === 'converted' ? 'Converti' : p.statut === 'rejected' ? 'Refusé' : 'En attente'}
              </StatusPill>
            </div>
          ))}
        </Card>
      )}
    </PageReseau>
  );
}
