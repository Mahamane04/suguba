'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Check, X, ExternalLink, Phone } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { VERIFICATIONS } from '@/lib/reseau/badges';

/** File d'attente des vérifications (§ 42 des écrans). */

interface Demande {
  id: string;
  profileId: string;
  type: string;
  document: string | null;
  creeLe: string;
  nom: string | null;
  telephone: string | null;
}

function libelleType(type: string): string {
  return VERIFICATIONS.find((v) => v.valeur === type)?.libelle || type;
}

export default function VerificationsAdminPage() {
  const { toast } = useToast();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = React.useCallback(() => {
    return fetch('/api/admin/verifications')
      .then((r) => r.json())
      .then((data) => setDemandes(data.demandes || []))
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const decider = async (demandeId: string, decision: 'approved' | 'rejected') => {
    setEnCours(demandeId);
    try {
      const reponse = await fetch('/api/admin/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandeId, decision }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Décision impossible.', { ton: 'erreur' }); return; }
      toast(decision === 'approved' ? 'Vérification validée.' : 'Vérification refusée.', { ton: 'succes' });
      setRefus(null);
      await charger();
    } catch {
      toast('Décision impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
    }
  };

  return (
    <PageReseau
      titre="Vérifications"
      sousTitre="Pièces déposées par les comptes, en attente d’examen."
      retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}
      large
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : demandes.length === 0 ? (
        <EmptyState icone={ShieldCheck} titre="File d’attente vide" texte="Aucune pièce en attente. Les nouveaux dépôts apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {demandes.map((d) => (
            <Card key={d.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{d.nom || 'Compte sans nom'}</p>
                  <p className="text-xs text-slate-500">
                    {d.telephone || '—'} · déposé le{' '}
                    {new Date(d.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <StatusPill ton="attente">{libelleType(d.type)}</StatusPill>
              </div>

              {d.type === 'phone' && d.telephone && (
                <a href={`tel:${d.telephone}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900">
                  <Phone className="w-3.5 h-3.5" />
                  Appeler {d.telephone} pour confirmer
                </a>
              )}

              {d.document && (
                <a
                  href={d.document}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir le document
                </a>
              )}

              {refus === d.id ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" fullWidth onClick={() => setRefus(null)}>Annuler</Button>
                  <Button variant="danger" size="sm" fullWidth disabled={enCours === d.id} onClick={() => decider(d.id, 'rejected')}>
                    {enCours === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Confirmer le refus
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" fullWidth onClick={() => setRefus(d.id)}>
                    <X className="w-4 h-4" />Refuser
                  </Button>
                  <Button size="sm" fullWidth disabled={enCours === d.id} onClick={() => decider(d.id, 'approved')}>
                    {enCours === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Valider
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
