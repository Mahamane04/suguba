'use client';

import SugubaLoader from '@/components/ui/SugubaLoader';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserCog, UserPlus, ShieldCheck, Search, UserMinus, AlertTriangle, Check } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import Sheet from '@/components/ui/Sheet';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { MIN_MOTIF_RETRAIT } from '@/lib/admin/equipe';
import { FORMAT_DATE } from '@/lib/montant';

/**
 * Équipe et permissions (§ 50 des écrans ; refonte U1 du 2026-09-27).
 *
 * « Ajouter un membre » cherche un compte EXISTANT (e-mail, nom ou
 * téléphone) et lui donne son rôle en une seule étape. On ne crée jamais de
 * compte ici : la personne s'inscrit d'abord sur Suguba, par e-mail ou Google.
 *
 * Garde-fous (voir /api/admin/equipe) : personne ne modifie ses propres
 * droits ; le dernier Super Admin ne peut être ni rétrogradé ni retiré ; un
 * retrait exige un motif, inscrit au journal.
 */

interface RoleEquipe { valeur: string; libelle: string; description: string }
interface Membre {
  id: string; nom: string; contact: string | null; teamRole: string | null;
  permissions: string[]; depuis: string | null; mfa: boolean | null; estMoi: boolean;
}
interface Candidat { id: string; nom: string; contact: string | null; profils: string; dejaMembre: boolean; suspendu: boolean }

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', FORMAT_DATE.complet) : '—');

function EtatMfa({ mfa }: { mfa: boolean | null }) {
  if (mfa === true) return <StatusPill ton="succes">Activée</StatusPill>;
  if (mfa === false) return <StatusPill ton="attente">Non activée</StatusPill>;
  return <span className="text-xs text-slate-500">Inconnue</span>;
}

export default function EquipeAdminPage() {
  const { toast, demander } = useToast();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [roles, setRoles] = useState<RoleEquipe[]>([]);
  const [lectureSeule, setLectureSeule] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [ajout, setAjout] = useState(false);

  const charger = useCallback(() => {
    setErreur('');
    return fetch('/api/admin/equipe', { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Lecture impossible.'); return d; })
      .then((data) => {
        setMembres(data.membres || []);
        setRoles(data.roles || []);
        setLectureSeule(Boolean(data.lectureSeule));
        setChoix(Object.fromEntries((data.membres || []).map((m: Membre) => [m.id, m.teamRole || ''])));
      })
      .catch((e) => setErreur((e as Error).message))
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const envoyer = async (corps: Record<string, unknown>, cle: string): Promise<boolean> => {
    setEnCours(cle);
    try {
      const r = await fetch('/api/admin/equipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Action impossible.', { ton: 'erreur', duree: 7000 }); return false; }
      toast(d.message || 'Enregistré.', { ton: 'succes', duree: 6000 });
      await charger();
      return true;
    } catch {
      toast('Action non confirmée. Vérifiez votre connexion.', { ton: 'erreur' });
      return false;
    } finally {
      setEnCours(null);
    }
  };

  const retirer = async (m: Membre) => {
    const motif = await demander({
      titre: `Retirer ${m.nom} de l’équipe ?`,
      message: 'Ses droits sont retirés tout de suite et ses sessions fermées. Son compte (client, revendeur…) reste intact.',
      libelle: 'Motif du retrait', min: MIN_MOTIF_RETRAIT, placeholder: 'Ex. : fin de contrat', confirmer: 'Retirer', danger: true,
    });
    if (motif) await envoyer({ action: 'retirer', profileId: m.id, motif }, m.id);
  };

  const sansRole = membres.filter((m) => !m.teamRole && !m.estMoi).length;
  const libelleRole = (v: string | null) => roles.find((r) => r.valeur === v)?.libelle || v;

  return (
    <PageReseau titre="Équipe et permissions" large
      sousTitre="Qui fait partie de l’équipe, et ce que chacun a le droit de faire."
      action={!lectureSeule && !chargement && !erreur ? <Button size="sm" onClick={() => setAjout(true)}><UserPlus className="w-4 h-4" />Ajouter un membre</Button> : undefined}>
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>
      ) : erreur ? (
        <EmptyState icone={AlertTriangle} titre="Équipe illisible" texte={erreur} action={<Button variant="ghost" onClick={() => charger()}>Réessayer</Button>} />
      ) : lectureSeule ? (
        <EmptyState icone={ShieldCheck} titre="Réservé aux Super Admins" texte="Votre rôle ne permet pas de modifier l’équipe. Demandez à un Super Admin." />
      ) : (
        <>
          {sansRole > 0 && (
            <Card className="!bg-amber-50 !border-amber-200 flex gap-2 text-sm text-amber-900" padding="p-4">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{sansRole} compte{sansRole > 1 ? 's' : ''} sans rôle d’équipe : {sansRole > 1 ? 'ils ne voient' : 'il ne voit'} aucun menu tant qu’un rôle n’est pas choisi.</span>
            </Card>
          )}

          {membres.length === 0 ? (
            <EmptyState icone={UserCog} titre="Personne dans l’équipe" texte="Ajoutez un membre : il doit d’abord avoir créé son compte Suguba."
              action={<Button onClick={() => setAjout(true)}><UserPlus className="w-4 h-4" />Ajouter un membre</Button>} />
          ) : (
            <Card padding="p-0" className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="hidden md:table-header-group bg-slate-50 text-left text-xs font-bold text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Membre</th>
                    <th scope="col" className="px-4 py-3 w-72">Rôle d’équipe</th>
                    <th scope="col" className="px-4 py-3">Double authentification</th>
                    <th scope="col" className="px-4 py-3">Membre depuis</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {membres.map((m) => {
                    const change = Boolean(choix[m.id]) && choix[m.id] !== m.teamRole;
                    const role = roles.find((r) => r.valeur === choix[m.id]);
                    return (
                      <tr key={m.id} className="block md:table-row p-4 md:p-0 space-y-3 md:space-y-0 align-top">
                        <td className="block md:table-cell md:px-4 md:py-3">
                          <p className="font-bold text-slate-900">{m.nom}{m.estMoi && <span className="ml-2 text-xs font-semibold text-slate-500">(vous)</span>}</p>
                          <p className="text-xs text-slate-500 break-all">{m.contact || '—'}</p>
                        </td>
                        <td className="block md:table-cell md:px-4 md:py-3">
                          {m.estMoi ? (
                            <StatusPill ton="info">{libelleRole(m.teamRole) || 'Sans rôle'}</StatusPill>
                          ) : (
                            <div className="space-y-1.5">
                              <ChoicePicker ariaLabel={`Rôle de ${m.nom}`} valeur={choix[m.id] || ''} placeholder="Choisir un rôle…"
                                onChange={(v) => setChoix((s) => ({ ...s, [m.id]: v }))}
                                choix={roles.map((r) => ({ valeur: r.valeur, libelle: r.libelle, detail: r.description }))} />
                              {!m.teamRole && !change && <StatusPill ton="attente">Affectation requise</StatusPill>}
                              {change && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button size="sm" disabled={enCours === m.id}
                                    onClick={() => envoyer({ action: 'role', profileId: m.id, teamRole: choix[m.id] }, m.id)}>
                                    {enCours === m.id ? <SugubaLoader className="w-4 h-4" /> : <Check className="w-4 h-4" />}Enregistrer
                                  </Button>
                                  <button type="button" onClick={() => setChoix((s) => ({ ...s, [m.id]: m.teamRole || '' }))} className="text-xs font-semibold text-slate-600 hover:underline min-h-[40px]">Annuler</button>
                                  {role && <p className="w-full text-xs text-slate-500">{role.description}</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="flex md:table-cell items-center justify-between gap-2 md:px-4 md:py-3">
                          <span className="md:hidden text-xs font-bold text-slate-600">Double authentification</span>
                          <EtatMfa mfa={m.mfa} />
                        </td>
                        <td className="flex md:table-cell items-center justify-between gap-2 md:px-4 md:py-3 text-slate-600 tabular-nums">
                          <span className="md:hidden text-xs font-bold text-slate-600">Membre depuis</span>
                          {date(m.depuis)}
                        </td>
                        <td className="block md:table-cell md:px-4 md:py-3 md:text-right">
                          {!m.estMoi && (
                            <Button variant="danger" size="sm" disabled={enCours === m.id} onClick={() => retirer(m)}>
                              <UserMinus className="w-4 h-4" />Retirer
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          <p className="text-xs text-slate-500">
            Double authentification obligatoire, déconnexion à distance et dernières connexions :{' '}
            <Link href="/admin/securite" className="font-semibold text-suguba-profond hover:underline">Sécurité de l’équipe</Link>.
          </p>
        </>
      )}

      <AjoutMembre ouvert={ajout} onFermer={() => setAjout(false)} roles={roles}
        onAjouter={async (profileId, teamRole) => { const ok = await envoyer({ action: 'ajouter', profileId, teamRole }, profileId); if (ok) setAjout(false); }}
        enCours={enCours} />
    </PageReseau>
  );
}

/** Fenêtre « Ajouter un membre » : chercher un compte existant, choisir son rôle, confirmer. */
function AjoutMembre({ ouvert, onFermer, roles, onAjouter, enCours }: {
  ouvert: boolean; onFermer: () => void; roles: RoleEquipe[];
  onAjouter: (profileId: string, teamRole: string) => Promise<void>; enCours: string | null;
}) {
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<Candidat[] | null>(null);
  const [message, setMessage] = useState('');
  const [recherche, setRecherche] = useState(false);
  const [choisi, setChoisi] = useState<Candidat | null>(null);
  const [role, setRole] = useState('support');
  const derniere = useRef(0);

  useEffect(() => {
    if (!ouvert) { setQ(''); setResultats(null); setMessage(''); setChoisi(null); setRole('support'); }
  }, [ouvert]);

  useEffect(() => {
    const texte = q.trim();
    if (texte.length < 3) { setResultats(null); setMessage(''); setRecherche(false); return; }
    const id = ++derniere.current;
    setRecherche(true);
    const minuterie = setTimeout(() => {
      fetch(`/api/admin/equipe?candidats=${encodeURIComponent(texte)}`, { cache: 'no-store' })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Recherche indisponible.'); return d; })
        .then((d) => { if (id !== derniere.current) return; setResultats(d.candidats || []); setMessage(d.erreur || ''); })
        .catch((e) => { if (id === derniere.current) { setResultats([]); setMessage((e as Error).message); } })
        .finally(() => { if (id === derniere.current) setRecherche(false); });
    }, 300);
    return () => clearTimeout(minuterie);
  }, [q]);

  const roleChoisi = roles.find((r) => r.valeur === role);

  return (
    <Sheet ouvert={ouvert} onFermer={onFermer} large titre="Ajouter un membre"
      sousTitre="La personne doit déjà avoir un compte Suguba (e-mail ou Google)."
      pied={choisi ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => setChoisi(null)}>Choisir un autre compte</Button>
          <Button disabled={enCours === choisi.id} onClick={() => onAjouter(choisi.id, role)}>
            {enCours === choisi.id ? <SugubaLoader className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            Ajouter comme {roleChoisi?.libelle || 'membre'}
          </Button>
        </div>
      ) : undefined}>
      {!choisi ? (
        <div className="space-y-3">
          <label htmlFor="recherche-membre" className="block text-sm font-semibold text-slate-800">E-mail, nom ou téléphone</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input id="recherche-membre" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
              placeholder="ex. : awa@exemple.com" className="w-full h-12 pl-10 pr-10 rounded-2xl border border-slate-300 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-suguba-profond" />
            {recherche && <SugubaLoader className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />}
          </div>
          {message && <p className="text-sm text-slate-600">{message}</p>}
          {resultats && resultats.length === 0 && !message && (
            <p className="text-sm text-slate-600">Aucun compte trouvé. Demandez à la personne de créer son compte sur Suguba, puis cherchez-la à nouveau.</p>
          )}
          {resultats && resultats.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden" aria-label="Comptes trouvés">
              {resultats.map((c) => {
                const bloque = c.dejaMembre || c.suspendu;
                return (
                  <li key={c.id}>
                    <button type="button" disabled={bloque} onClick={() => setChoisi(c)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900 truncate">{c.nom}</span>
                        <span className="block text-xs text-slate-500 truncate">{c.contact || '—'} · {c.profils}</span>
                      </span>
                      {c.dejaMembre ? <StatusPill ton="info">Déjà dans l’équipe</StatusPill>
                        : c.suspendu ? <StatusPill ton="danger">Compte suspendu</StatusPill>
                        : <span className="text-sm font-semibold text-suguba-profond shrink-0">Choisir</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Card padding="p-4" className="!bg-slate-50">
            <p className="text-sm font-bold text-slate-900">{choisi.nom}</p>
            <p className="text-xs text-slate-500">{choisi.contact || '—'} · {choisi.profils}</p>
          </Card>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 mb-1">Rôle dans l’équipe</legend>
            {roles.map((r) => (
              <label key={r.valeur} className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer ${role === r.valeur ? 'border-suguba-profond bg-suguba-menthe' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="role-equipe" value={r.valeur} checked={role === r.valeur} onChange={() => setRole(r.valeur)} className="mt-1 accent-suguba-profond" />
                <span>
                  <span className="block text-sm font-bold text-slate-900">{r.libelle}</span>
                  <span className="block text-xs text-slate-600">{r.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-slate-600">
            Ses sessions ouvertes seront fermées : à sa prochaine connexion, il arrive directement sur « À traiter », avec le menu de son rôle.
            Son compte client ou partenaire reste intact.
          </p>
        </div>
      )}
    </Sheet>
  );
}
