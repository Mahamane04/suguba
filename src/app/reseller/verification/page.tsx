'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Check, Clock, X, Upload, Phone, MapPin } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card, Skeleton, StatusPill } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { compresserImage } from '@/lib/compression-image';
import { badge } from '@/lib/reseau/badges';

/**
 * Vérification du compte (§ 5 des écrans).
 *
 * L'utilisateur doit comprendre EN UN COUP D'ŒIL ce qui est validé et ce
 * qu'il lui reste à faire — d'où la barre de pourcentage et la liste d'états
 * plutôt qu'un formulaire de plus.
 */

type Etat = 'absent' | 'pending' | 'approved' | 'rejected';

interface Etape { valeur: string; libelle: string; poids: number; aide: string }

export default function VerificationPage() {
  const { toast } = useToast();
  const [etats, setEtats] = useState<Record<string, Etat>>({});
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [pourcentage, setPourcentage] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [quartier, setQuartier] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reseller/me').then((r) => (r.ok ? r.json() : null)).then((d) => setQuartier(d?.reseller?.neighborhood || null)).catch(() => undefined);
  }, []);

  const charger = React.useCallback(() => {
    return fetch('/api/reseau/verification')
      .then((r) => r.json())
      .then((data) => {
        setEtats(data.etats || {});
        setEtapes(data.etapes || []);
        setPourcentage(data.pourcentage || 0);
        setBadges(data.badges || []);
      })
      .catch(() => { /* état vide */ })
      .finally(() => setChargement(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const deposer = async (type: string, fichier: File) => {
    setEnvoi(type);
    try {
      // La photo est compressée AVANT l'envoi : une pièce d'identité prise au
      // téléphone pèse 4 à 8 Mo, inenvoyable sur un réseau malien.
      const compressee = await compresserImage(fichier);
      const formulaire = new FormData();
      formulaire.append('file', compressee);
      // Stockage PRIVÉ : la pièce n'a jamais d'adresse publique.
      const envoiImage = await fetch('/api/reseau/upload?usage=document', { method: 'POST', body: formulaire });
      const image = await envoiImage.json();
      if (!envoiImage.ok || !image.ref) {
        toast(image.error || 'Envoi de la photo impossible.', { ton: 'erreur' });
        return;
      }

      const reponse = await fetch('/api/reseau/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, document: image.ref }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Dépôt impossible.', { ton: 'erreur' }); return; }
      toast('Document envoyé. Suguba l’examine sous 48 h.', { ton: 'succes' });
      await charger();
    } catch {
      toast('Dépôt impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(null);
    }
  };

  /** Vérifications sans photo : appel pour le téléphone, quartier déclaré pour la localisation. */
  const demander = async (type: 'phone' | 'location', extra: Record<string, unknown> = {}) => {
    setEnvoi(type);
    try {
      const reponse = await fetch('/api/reseau/verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...extra }),
      });
      const data = await reponse.json();
      if (!reponse.ok) { toast(data.error || 'Demande impossible.', { ton: 'erreur' }); return; }
      toast(type === 'phone' ? 'Demande envoyée. Suguba vous appelle pour confirmer votre numéro.' : 'Quartier envoyé pour vérification.', { ton: 'succes' });
      await charger();
    } catch {
      toast('Demande impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(null);
    }
  };

  const pastille = (etat: Etat) => {
    if (etat === 'approved') return <StatusPill ton="succes"><Check className="w-3 h-3" />Validé</StatusPill>;
    if (etat === 'pending') return <StatusPill ton="attente"><Clock className="w-3 h-3" />En examen</StatusPill>;
    if (etat === 'rejected') return <StatusPill ton="danger"><X className="w-3 h-3" />À refaire</StatusPill>;
    return <StatusPill ton="neutre">À faire</StatusPill>;
  };

  return (
    <PageReseau
      titre="Mon profil vérifié"
      sousTitre="Un profil vérifié rassure vos clients et débloque plus de fonctions."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}
    >
      {chargement ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex items-end justify-between">
              <p className="text-sm font-black text-slate-900">Profil vérifié</p>
              <p className="text-2xl font-black text-suguba-brand tabular-nums">{pourcentage} %</p>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-suguba-brand transition-all" style={{ width: `${pourcentage}%` }} />
            </div>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {badges.map((b) => (
                  <StatusPill key={b} ton="succes"><ShieldCheck className="w-3 h-3" />{badge(b).libelle}</StatusPill>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-3">
            {etapes.map((etape) => {
              const etat = etats[etape.valeur] || 'absent';
              const modifiable = etat === 'absent' || etat === 'rejected';
              // L'e-mail est prouvé par la connexion ; le téléphone se vérifie par un
              // appel de l'équipe, sans photo à envoyer.
              const automatique = etape.valeur === 'email';
              const parAppel = etape.valeur === 'phone';
              const parQuartier = etape.valeur === 'location';
              return (
                <Card key={etape.valeur} className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{etape.libelle}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{etape.aide}</p>
                    </div>
                    {pastille(etat)}
                  </div>

                  {modifiable && parAppel && (
                    <Button variant="ghost" fullWidth disabled={envoi === etape.valeur} onClick={() => demander('phone')}>
                      {envoi === etape.valeur ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      Demander un appel de vérification
                    </Button>
                  )}

                  {modifiable && parQuartier && (
                    quartier ? (
                      <Button variant="ghost" fullWidth disabled={envoi === etape.valeur} onClick={() => demander('location', { quartier })}>
                        {envoi === etape.valeur ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        Faire vérifier mon quartier ({quartier})
                      </Button>
                    ) : (
                      <Button variant="ghost" fullWidth href="/reseller/demarrer">
                        <MapPin className="w-4 h-4" />Renseigner mon quartier
                      </Button>
                    )
                  )}

                  {automatique && etat !== 'approved' && (
                    <p className="text-[11px] text-slate-500">Validée automatiquement quand vous vous connectez avec votre e-mail ou Google.</p>
                  )}

                  {modifiable && !automatique && !parAppel && !parQuartier && (
                    <label className="block">
                      <span className="sr-only">Envoyer une photo pour {etape.libelle}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={envoi === etape.valeur}
                        onChange={(e) => {
                          const fichier = e.target.files?.[0];
                          if (fichier) deposer(etape.valeur, fichier);
                          e.target.value = '';
                        }}
                      />
                      <span className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-800 cursor-pointer active:scale-[0.98]">
                        {envoi === etape.valeur ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {envoi === etape.valeur ? 'Envoi…' : 'Envoyer une photo'}
                      </span>
                    </label>
                  )}
                </Card>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 px-1">
            Vos documents ne sont visibles que par l’équipe Suguba chargée des vérifications.
            Ils ne sont jamais affichés sur votre boutique ni communiqués aux clients.
          </p>
        </>
      )}
    </PageReseau>
  );
}
