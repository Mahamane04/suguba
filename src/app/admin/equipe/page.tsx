'use client';

import React, { useEffect, useState } from 'react';
import { UserCog, Loader2, ShieldCheck } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Équipe et permissions (§ 50 des écrans).
 *
 * Deux garde-fous visibles ici :
 *   — un admin sans rôle d'équipe garde TOUS les droits (les administrateurs
 *     existants ne perdent rien le jour de la mise en production) ;
 *   — personne ne peut modifier ses propres droits (voir /api/admin/equipe).
 */

interface RoleEquipe { valeur: string; libelle: string; description: string }
interface Membre {
  id: string; nom: string; contact: string | null;
  teamRole: string | null; permissions: string[]; estMoi: boolean;
}

export default function EquipeAdminPage() {
  const { toast } = useToast();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [roles, setRoles] = useState<RoleEquipe[]>([]);
  const [lectureSeule, setLectureSeule] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});

  const charger = React.useCallback(() => {
    return fetch('/api/admin/equipe')
      .then((r) => r.json())
      .then((data) => {
        setMembres(data.membres || []);
        setRoles(data.roles || []);
        setLectureSeule(Boolean(data.lectureSeule));
        setChoix(Object.fromEntries((data.membres || []).map((m: Membre) => [m.id, m.teamRole || 'support'])));
      })
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (membre: Membre) => {
    setEnCours(membre.id);
    try {
      const reponse = await fetch('/api/admin/equipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: membre.id, teamRole: choix[membre.id] }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Enregistrement impossible.', { ton: 'erreur' }); return; }
      toast('Rôle mis à jour.', { ton: 'succes' });
      await charger();
    } catch {
      toast('Enregistrement impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnCours(null);
    }
  };

  return (
    <PageReseau
      titre="Équipe et permissions"
      sousTitre="Qui a le droit de faire quoi dans le back-office."
      retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}
      large
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : lectureSeule ? (
        <EmptyState
          icone={ShieldCheck}
          titre="Réservé aux super-admins"
          texte="Votre rôle ne permet pas de modifier l’équipe. Demandez à un super-admin."
        />
      ) : membres.length === 0 ? (
        <EmptyState icone={UserCog} titre="Aucun administrateur" texte="Les comptes admin apparaîtront ici avec leur rôle d’équipe." />
      ) : (
        <div className="space-y-3">
          {membres.map((m) => {
            const role = roles.find((r) => r.valeur === (choix[m.id] || m.teamRole));
            return (
              <Card key={m.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{m.nom}</p>
                    <p className="text-[11px] text-slate-500">{m.contact || '—'}</p>
                  </div>
                  <StatusPill ton={m.teamRole ? 'info' : 'succes'}>
                    {m.teamRole ? roles.find((r) => r.valeur === m.teamRole)?.libelle || m.teamRole : 'Tous les droits'}
                  </StatusPill>
                </div>

                {m.estMoi ? (
                  <p className="text-[11px] text-slate-500">
                    C’est votre compte : vous ne pouvez pas modifier vos propres droits.
                  </p>
                ) : (
                  <>
                    <Field label="Rôle d’équipe" htmlFor={`role-${m.id}`} aide={role?.description}>
                      <Select id={`role-${m.id}`} value={choix[m.id] || 'support'} onChange={(e) => setChoix((v) => ({ ...v, [m.id]: e.target.value }))}>
                        {roles.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
                      </Select>
                    </Field>
                    <Button size="sm" fullWidth disabled={enCours === m.id} onClick={() => enregistrer(m)}>
                      {enCours === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                      Appliquer ce rôle
                    </Button>
                    <p className="text-[11px] text-slate-500">
                      {m.permissions.length} permission{m.permissions.length > 1 ? 's' : ''} actuellement.
                    </p>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageReseau>
  );
}
