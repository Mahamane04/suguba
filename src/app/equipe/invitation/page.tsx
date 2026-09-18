'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound, Loader2, Check, X, LogIn } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Invitation à rejoindre l'équipe d'un fournisseur.
 *
 * Page ouverte à tout compte connecté (client, revendeur, nouveau compte) :
 * l'invitation est retrouvée par le numéro du profil. Accepter ne donne aucun
 * droit : le fournisseur confirme ensuite, et c'est seulement alors que
 * l'espace fournisseur s'ouvre (session rafraîchie pour y entrer).
 */

interface Invitation { id: string; fournisseur: string; libelleRole: string; inviteLe: string }
interface Adhesion { fournisseur: string; libelleRole: string; statut: 'accepted' | 'active' }

export default function InvitationEquipePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [chargement, setChargement] = useState(true);
  const [connecte, setConnecte] = useState(false);
  const [telephoneConnu, setTelephoneConnu] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [adhesion, setAdhesion] = useState<Adhesion | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = React.useCallback(() => fetch('/api/reseau/invitations')
    .then((r) => r.json())
    .then((d) => { setConnecte(Boolean(d.connecte)); setTelephoneConnu(d.telephoneConnu !== false); setInvitations(d.invitations || []); setAdhesion(d.adhesion || null); })
    .catch(() => undefined)
    .finally(() => setChargement(false)), []);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirEspace = async () => {
    // Le rôle accordé doit entrer dans la session avant d'ouvrir l'espace.
    await fetch('/api/auth/refresh-session', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/supplier';
  };

  const repondre = async (id: string, accepter: boolean) => {
    setEnCours(id);
    try {
      const r = await fetch('/api/reseau/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitationId: id, accepter }) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Réponse impossible.', { ton: 'erreur' }); return; }
      toast(accepter ? 'Invitation acceptée. Le fournisseur doit maintenant confirmer.' : 'Invitation refusée.', { ton: accepter ? 'succes' : 'info' });
      await charger();
    } catch {
      toast('Réponse impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally { setEnCours(null); }
  };

  return (
    <PageReseau titre="Invitation d’équipe" sousTitre="Rejoindre l’équipe d’un fournisseur sur Suguba.">
      {chargement ? (
        <Skeleton className="h-32" />
      ) : !connecte ? (
        <EmptyState icone={LogIn} titre="Connectez-vous d’abord"
          texte="Connectez-vous avec le compte dont le numéro de téléphone est celui qui a été invité."
          action={<Button onClick={() => router.push('/login?next=/equipe/invitation')}>Se connecter</Button>} />
      ) : !telephoneConnu ? (
        <EmptyState icone={UsersRound} titre="Numéro de téléphone requis"
          texte="Vous êtes connecté par e-mail. Complétez votre profil avec votre numéro, puis revenez ici."
          action={<Button href="/register/complete">Compléter mon profil</Button>} />
      ) : adhesion ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-700">
            Équipe de <strong className="text-slate-900">{adhesion.fournisseur}</strong> · {adhesion.libelleRole}
          </p>
          {adhesion.statut === 'active' ? (
            <Button fullWidth onClick={ouvrirEspace}><Check className="w-4 h-4" />Ouvrir l’espace fournisseur</Button>
          ) : (
            <p className="text-xs text-slate-500">
              En attente de confirmation par le fournisseur. Vous serez prévenu dès qu’il aura confirmé.
            </p>
          )}
        </Card>
      ) : invitations.length === 0 ? (
        <EmptyState icone={UsersRound} titre="Aucune invitation en attente"
          texte="Demandez au fournisseur de vous inviter avec le numéro de ce compte." />
      ) : (
        <div className="space-y-3">
          {invitations.map((i) => (
            <Card key={i.id} className="space-y-3">
              <p className="text-sm text-slate-700"><strong className="text-slate-900">{i.fournisseur}</strong> vous invite comme <strong>{i.libelleRole}</strong>.</p>
              <div className="flex gap-2">
                <Button variant="ghost" fullWidth disabled={enCours === i.id} onClick={() => repondre(i.id, false)}><X className="w-4 h-4" />Refuser</Button>
                <Button fullWidth disabled={enCours === i.id} onClick={() => repondre(i.id, true)}>
                  {enCours === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Accepter
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageReseau>
  );
}
