'use client';

import React, { useEffect, useState } from 'react';
import { UsersRound, Loader2, UserPlus, X, LogOut } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

/**
 * Mon équipe (§ F du cahier des charges).
 *
 * L'invitation se fait par NUMÉRO. La personne se connecte avec son propre
 * compte (dont le téléphone est ce numéro), accepte, puis le propriétaire
 * CONFIRME en voyant son nom et son e-mail — le numéro d'un compte n'étant pas
 * vérifié, accepter seul ne suffit pas. Aucun mot de passe partagé.
 */

interface Role { valeur: string; libelle: string; description: string }
interface Membre { id: string; telephone: string; nom: string | null; email: string | null; role: string; statut: string; inviteLe: string }

export default function EquipeFournisseurPage() {
  const { toast } = useToast();
  const [chargement, setChargement] = useState(true);
  const [gestion, setGestion] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [monRole, setMonRole] = useState('proprietaire');
  const [membres, setMembres] = useState<Membre[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [max, setMax] = useState(10);
  const [telephone, setTelephone] = useState('');
  const [role, setRole] = useState('stock');
  const [envoi, setEnvoi] = useState(false);
  const [origine, setOrigine] = useState('https://app.sugubaml.com');

  const charger = React.useCallback(() => fetch('/api/supplier/equipe')
    .then((r) => r.json())
    .then((d) => {
      setGestion(Boolean(d.gestion)); setDisponible(d.disponible !== false);
      setMonRole(d.monRole || 'proprietaire'); setMembres(d.membres || []);
      setRoles(d.roles || []); if (d.max) setMax(d.max);
    })
    .catch(() => undefined)
    .finally(() => setChargement(false)), []);

  useEffect(() => { setOrigine(window.location.origin); charger(); }, [charger]);

  const envoyer = async (corps: Record<string, unknown>, succes: string) => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/equipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Action impossible.', { ton: 'erreur' }); return false; }
      toast(succes, { ton: 'succes' });
      await charger();
      return true;
    } catch {
      toast('Action impossible. Vérifiez votre connexion.', { ton: 'erreur' });
      return false;
    } finally { setEnvoi(false); }
  };

  const libelle = (v: string) => roles.find((r) => r.valeur === v)?.libelle || (v === 'proprietaire' ? 'Propriétaire' : v);
  const messageInvitation = `Je t'ai invité dans l'équipe de ma boutique sur Suguba.\n1. Ouvre ce lien et connecte-toi : ${origine}/login?next=/equipe/invitation\n2. Renseigne ce numéro de téléphone dans ton profil, puis accepte l'invitation.\nJe confirmerai ensuite ton accès.`;

  return (
    <PageReseau titre="Mon équipe" sousTitre="Vos collaborateurs, chacun avec son propre accès." retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}>
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : !gestion ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-700">Vous faites partie de cette équipe en tant que <strong>{libelle(monRole)}</strong>.</p>
          <Button variant="danger" fullWidth disabled={envoi}
            onClick={async () => { if (await envoyer({ action: 'quitter' }, 'Vous avez quitté l’équipe.')) window.location.href = '/'; }}>
            <LogOut className="w-4 h-4" />Quitter l’équipe
          </Button>
        </Card>
      ) : !disponible ? (
        <EmptyState icone={UsersRound} titre="Équipe pas encore disponible" texte="La mise à jour « équipe fournisseur » n’est pas encore appliquée sur la base." />
      ) : (
        <>
          <Card className="space-y-4">
            <div>
              <p className="text-sm font-black text-slate-900">Inviter un collaborateur</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Il se connecte avec son propre compte, accepte, puis vous confirmez. Il n’a accès qu’à ce que son rôle permet.</p>
            </div>
            <Field label="Numéro WhatsApp" htmlFor="tel-collab" requis>
              <Input id="tel-collab" type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="76 12 34 56" />
            </Field>
            <div className="space-y-2" role="radiogroup" aria-label="Rôle">
              {roles.map((r) => (
                <button key={r.valeur} type="button" role="radio" aria-checked={role === r.valeur} onClick={() => setRole(r.valeur)}
                  className={`w-full rounded-2xl border p-3 text-left ${role === r.valeur ? 'border-suguba-brand ring-2 ring-suguba-brand bg-suguba-brand/5' : 'border-slate-200 bg-white'}`}>
                  <span className="block text-xs font-black text-slate-900">{r.libelle}</span>
                  <span className="block text-[11px] text-slate-500">{r.description}</span>
                </button>
              ))}
            </div>
            <Button fullWidth disabled={envoi || telephone.replace(/\D/g, '').length < 8 || membres.length >= max}
              onClick={async () => { if (await envoyer({ telephone, role }, 'Invitation envoyée.')) setTelephone(''); }}>
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Inviter
            </Button>
          </Card>

          {membres.length === 0 ? (
            <EmptyState icone={UsersRound} titre="Vous gérez seul votre boutique" texte={`Invitez jusqu’à ${max} collaborateurs : commercial, gestion du stock, marketing.`} />
          ) : (
            <Card padding="p-0" className="overflow-hidden divide-y divide-slate-100">
              {membres.map((m) => (
                <div key={m.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{m.nom || m.telephone}</p>
                      <p className="text-[11px] text-slate-500">{libelle(m.role)}{m.nom ? ` · ${m.telephone}` : ''}</p>
                    </div>
                    <StatusPill ton={m.statut === 'active' ? 'succes' : m.statut === 'accepted' ? 'info' : 'attente'}>
                      {m.statut === 'active' ? 'Actif' : m.statut === 'accepted' ? 'À confirmer' : 'Invité'}
                    </StatusPill>
                  </div>
                  {m.statut === 'accepted' && (
                    <div className="rounded-2xl bg-sky-50 text-sky-900 p-3 text-xs space-y-1">
                      <p><strong>{m.nom || 'Sans nom'}</strong>{m.email ? ` · ${m.email}` : ''} a accepté votre invitation.</p>
                      <p>Vérifiez que c’est bien la bonne personne avant de lui ouvrir votre catalogue.</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {m.statut === 'accepted' && (
                      <Button size="sm" fullWidth disabled={envoi} onClick={() => envoyer({ action: 'confirmer', id: m.id }, 'Accès ouvert.')}>
                        Confirmer
                      </Button>
                    )}
                    {m.statut === 'invited' && (
                      <Button size="sm" variant="ghost" fullWidth
                        href={`https://api.whatsapp.com/send?phone=${m.telephone.replace(/\D/g, '')}&text=${encodeURIComponent(messageInvitation)}`}
                        target="_blank" rel="noopener noreferrer">
                        Prévenir sur WhatsApp
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={envoi}
                      onClick={() => envoyer({ action: 'retirer', id: m.id }, m.statut === 'active' ? 'Accès retiré.' : 'Invitation annulée.')}>
                      <X className="w-3.5 h-3.5" />{m.statut === 'active' ? 'Retirer' : m.statut === 'accepted' ? 'Refuser' : 'Annuler'}
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </PageReseau>
  );
}
