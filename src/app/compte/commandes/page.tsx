'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, PackageCheck, Plus, ShoppingBag } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, EmptyState, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { devisAccessKey, devisSurCetAppareil, orderAccessKey, recusSurCetAppareil } from '@/lib/order-access-client';

interface Commande { numero: string; produit: string; image: string | null; quantite: number; total: number; statut: string; creeLe: string; livreeLe: string | null }
interface Devis { numero: string; produit: string; statut: string; creeLe: string; commande: string | null }

const STATUT: Record<string, [string, 'succes' | 'attente' | 'neutre' | 'danger' | 'info']> = {
  pending_call: ['À confirmer', 'attente'], confirmed: ['Confirmée', 'info'], dispatched: ['En préparation', 'info'],
  in_transit: ['En route', 'info'], delivered: ['Livrée', 'succes'], cancelled: ['Annulée', 'neutre'], returned: ['Retournée', 'neutre'],
};
const STATUT_DEVIS: Record<string, string> = {
  demande: 'En attente de réponse', proposee: 'Prix proposé', acceptee: 'Accepté', refusee_client: 'Refusé', refusee_fournisseur: 'Sans suite',
};
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const jour = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Mes commandes (2026-09-26, compte client — C1) : commandes et devis du
 * compte, sur n'importe quel téléphone. Les achats faits sans compte depuis
 * CE téléphone peuvent y être ajoutés : la clé de leur reçu en est la preuve.
 */
export default function MesCommandesPage() {
  const { toast } = useToast();
  const [etat, setEtat] = useState<'chargement' | 'deconnecte' | 'ok' | 'erreur'>('chargement');
  const [erreur, setErreur] = useState('');
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [migration, setMigration] = useState(false);
  const [locaux, setLocaux] = useState<{ commandes: string[]; devis: string[] }>({ commandes: [], devis: [] });
  const [ajout, setAjout] = useState(false);

  const charger = useCallback(async () => {
    try {
      const r = await fetch('/api/compte/commandes', { cache: 'no-store' });
      if (r.status === 401) { setEtat('deconnecte'); return; }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Commandes indisponibles.');
      setCommandes(j.commandes || []); setDevis(j.devis || []); setMigration(Boolean(j.migrationRequise));
      setEtat('ok');
    } catch (e) { setErreur((e as Error).message); setEtat('erreur'); }
  }, []);
  useEffect(() => {
    charger();
    setLocaux({ commandes: recusSurCetAppareil().map((x) => x.orderNumber), devis: devisSurCetAppareil().map((x) => x.numero) });
  }, [charger]);

  // Achats gardés sur ce téléphone mais pas encore dans le compte.
  const aAjouter = useMemo(() => ({
    commandes: locaux.commandes.filter((n) => !commandes.some((c) => c.numero === n)),
    devis: locaux.devis.filter((n) => !devis.some((d) => d.numero === n)),
  }), [locaux, commandes, devis]);
  const nbAAjouter = aAjouter.commandes.length + aAjouter.devis.length;

  const ajouter = async () => {
    setAjout(true);
    try {
      const r = await fetch('/api/compte/commandes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rattacher',
          commandes: aAjouter.commandes.map((numero) => ({ numero, cle: orderAccessKey(numero) })).filter((x) => x.cle),
          devis: aAjouter.devis.map((numero) => ({ numero, cle: devisAccessKey(numero) })).filter((x) => x.cle),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { toast(j?.error || 'Ajout impossible.', { ton: 'erreur' }); return; }
      toast(j.ajoutes ? `${j.ajoutes} achat${j.ajoutes > 1 ? 's' : ''} ajouté${j.ajoutes > 1 ? 's' : ''} à votre compte.` : 'Ces achats sont déjà rattachés à un compte.', { ton: j.ajoutes ? 'succes' : 'info' });
      await charger();
    } catch {
      toast('Connexion interrompue. Réessayez.', { ton: 'erreur' });
    } finally { setAjout(false); }
  };

  if (etat === 'deconnecte') {
    return (
      <PageReseau titre="Mes commandes" sousTitre="Vos achats sur tous vos téléphones." retour={{ href: '/', libelle: 'Accueil' }}>
        <EmptyState icone={ShoppingBag} titre="Connectez-vous pour retrouver vos commandes"
          texte="Avec un compte client, vos commandes, reçus et devis vous suivent sur tous vos téléphones. Acheter reste possible sans compte."
          action={<div className="grid gap-2 w-full max-w-xs">
            <Button href="/login?next=%2Fcompte%2Fcommandes">Me connecter</Button>
            <Button variant="ghost" href="/register?role=customer">Créer mon compte client</Button>
          </div>} />
      </PageReseau>
    );
  }

  return (
    <PageReseau titre="Mes commandes" sousTitre="Vos achats sur tous vos téléphones." retour={{ href: '/', libelle: 'Accueil' }}>
      {etat === 'chargement' ? <Skeleton className="h-48" />
        : etat === 'erreur' ? <EmptyState icone={ShoppingBag} titre="Commandes indisponibles" texte={erreur} />
        : migration ? <EmptyState icone={ShoppingBag} titre="Bientôt disponible" texte="Le compte client sera disponible après la mise à jour de Suguba." />
        : (
          <>
            {nbAAjouter > 0 && (
              <Card className="space-y-2">
                <p className="text-sm font-bold text-slate-900">{nbAAjouter} achat{nbAAjouter > 1 ? 's' : ''} sur ce téléphone, pas encore dans votre compte</p>
                <p className="text-xs text-slate-600">Ajoutez-les pour les retrouver sur tous vos téléphones.</p>
                <Button fullWidth onClick={ajouter} disabled={ajout}>
                  {ajout ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Ajouter à mon compte
                </Button>
              </Card>
            )}

            {commandes.length === 0 && devis.length === 0 ? (
              <EmptyState icone={PackageCheck} titre="Aucune commande pour l’instant"
                texte="Les commandes que vous passez connecté apparaissent ici, avec leur reçu."
                action={<Button href="/">Découvrir le catalogue</Button>} />
            ) : (
              <>
                {commandes.length > 0 && (
                  <Card>
                    <ul className="divide-y divide-slate-100">
                      {commandes.map((c) => {
                        const [libelle, ton] = STATUT[c.statut] || [c.statut, 'neutre'];
                        return (
                          <li key={c.numero}>
                            <Link href={`/recu/${encodeURIComponent(c.numero)}`} className="flex items-center gap-3 py-3 min-h-11">
                              {c.image
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={c.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-slate-100 shrink-0" />
                                : <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />}
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-900 truncate">{c.produit}</span>
                                <span className="block text-xs text-slate-500 font-mono">{c.numero} · {jour(c.creeLe)} · {fcfa(c.total)}</span>
                              </span>
                              <StatusPill ton={ton}>{libelle}</StatusPill>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                )}
                {devis.length > 0 && (
                  <Card className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">Mes devis</p>
                    <ul className="divide-y divide-slate-100">
                      {devis.map((d) => (
                        <li key={d.numero}>
                          <Link href={`/devis/${encodeURIComponent(d.numero)}`} className="flex items-center gap-3 py-3 min-h-11">
                            <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-900 truncate">{d.produit}</span>
                              <span className="block text-xs text-slate-500 font-mono">{d.numero} · {jour(d.creeLe)}</span>
                            </span>
                            <StatusPill ton="neutre">{STATUT_DEVIS[d.statut] || d.statut}</StatusPill>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            )}
          </>
        )}
    </PageReseau>
  );
}
