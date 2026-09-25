'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Copy, Check, Send } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import { useToast } from '@/components/ui/Toast';

/**
 * Diffusion au réseau — refaite le 2026-09-24.
 *
 * L'ancienne page était une maquette : « Diffuser » n'envoyait rien et les
 * nombres de destinataires (142 / 18 / 12) étaient écrits en dur. Désormais
 * les nombres sont lus en base et l'envoi écrit une notification dans
 * l'application de chaque compte actif du groupe (voir /api/admin/diffusion).
 *
 * WhatsApp : copier le texte, puis le poster soi-même dans les groupes ou le
 * statut. Aucun envoi automatique en masse (risque de bannissement du numéro).
 */

type Cible = 'reseller' | 'supplier' | 'driver' | 'tous';

const CIBLES: [Cible, string][] = [
  ['reseller', 'Revendeurs'],
  ['supplier', 'Fournisseurs'],
  ['driver', 'Livreurs'],
  ['tous', 'Tout le réseau'],
];

const LIENS: [string, string][] = [
  ['', 'Aucun lien'],
  ['/reseller/catalog', 'Catalogue revendeur'],
  ['/reseller/missions', 'Missions revendeur'],
  ['/supplier/products/new', 'Ajouter un produit (fournisseur)'],
  ['/supplier/sponsorisation', 'Sponsorisation (fournisseur)'],
  ['/driver', 'Espace livreur'],
  ['/', 'Accueil de la boutique'],
];

const MODELES: { titre: string; cible: Cible; texte: string; lien: string }[] = [
  {
    titre: 'Nouveaux produits à partager',
    cible: 'reseller',
    texte: 'De nouveaux articles viennent d’arriver dans le catalogue. Partagez-les dès aujourd’hui sur vos statuts WhatsApp.',
    lien: '/reseller/catalog',
  },
  {
    titre: 'Ajoutez vos nouveautés',
    cible: 'supplier',
    texte: 'Les revendeurs cherchent des nouveautés. Ajoutez vos articles avec de bonnes photos pour qu’ils les partagent.',
    lien: '/supplier/products/new',
  },
  {
    titre: 'Livreurs : restez disponibles',
    cible: 'driver',
    texte: 'Beaucoup de commandes attendues ce week-end. Gardez votre téléphone chargé et l’application ouverte.',
    lien: '/driver',
  },
];

export default function DiffusionPage() {
  const { toast, confirmer } = useToast();
  const [comptes, setComptes] = useState<Record<Cible, number> | null>(null);
  const [cible, setCible] = useState<Cible>('reseller');
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [lien, setLien] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    fetch('/api/admin/diffusion')
      .then((r) => r.json())
      .then((d) => { if (d.error) toast(d.error, { ton: 'erreur' }); else setComptes(d.comptes); })
      .catch(() => toast('Impossible de compter les destinataires.', { ton: 'erreur' }));
  }, [toast]);

  const nb = comptes ? comptes[cible] : null;
  const libelleCible = CIBLES.find(([c]) => c === cible)?.[1] || '';

  const envoyer = async () => {
    if (titre.trim().length < 3) { toast('Écrivez un titre d’au moins 3 caractères.', { ton: 'erreur' }); return; }
    const ok = await confirmer({
      titre: `Envoyer à ${nb ?? '?'} compte(s) ?`,
      message: `« ${titre.trim()} » apparaîtra dans les notifications de chaque compte du groupe « ${libelleCible} ». Un envoi ne peut pas être annulé.`,
      confirmer: 'Envoyer',
    });
    if (!ok) return;
    setEnvoi(true);
    try {
      const r = await fetch('/api/admin/diffusion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cible, titre, texte, lien: lien || null }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Envoi impossible.', { ton: 'erreur' }); return; }
      toast(`Notification envoyée à ${d.envoyes} compte(s).`, { ton: 'succes' });
      setTitre(''); setTexte(''); setLien('');
    } catch {
      toast('Erreur réseau : rien n’a été envoyé.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  const texteWhatsApp = [titre.trim() && `*${titre.trim()}*`, texte.trim(), lien && `https://app.sugubaml.com${lien}`].filter(Boolean).join('\n\n');
  const copier = async () => {
    try { await navigator.clipboard.writeText(texteWhatsApp); setCopie(true); setTimeout(() => setCopie(false), 2000); }
    catch { toast('Copie impossible sur cet appareil.', { ton: 'erreur' }); }
  };

  return (
    <PageReseau titre="Diffusion" sousTitre="Prévenir tout un groupe du réseau en une fois." retour={{ href: '/admin/backoffice', libelle: 'Back-office' }}>
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">À qui ?</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Destinataires">
            {CIBLES.map(([c, libelle]) => {
              const actif = cible === c;
              return (
                <button key={c} type="button" role="radio" aria-checked={actif} onClick={() => setCible(c)}
                  className={`rounded-2xl border p-3 text-left ${actif ? 'border-suguba-profond bg-suguba-menthe ring-1 ring-suguba-profond' : 'border-slate-200 bg-white'}`}>
                  <span className="block text-sm font-semibold text-slate-900">{libelle}</span>
                  <span className="block text-xs text-slate-600">{comptes ? `${comptes[c]} compte(s) actif(s)` : 'Comptage…'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">Partir d’un modèle</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
            {MODELES.map((m) => (
              <button key={m.titre} type="button"
                onClick={() => { setCible(m.cible); setTitre(m.titre); setTexte(m.texte); setLien(m.lien); }}
                className="shrink-0 min-h-[36px] px-3.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-suguba-profond">
                {m.titre}
              </button>
            ))}
          </div>
        </div>

        <Field label="Titre" htmlFor="diff-titre" requis>
          <Input id="diff-titre" value={titre} maxLength={140} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Nouveaux produits à partager" />
        </Field>
        <Field label="Message" htmlFor="diff-texte" aide={`${texte.length}/400 caractères`}>
          <Textarea id="diff-texte" rows={4} value={texte} maxLength={400} onChange={(e) => setTexte(e.target.value)} />
        </Field>
        <Field label="Lien ouvert en touchant la notification" htmlFor="diff-lien">
          <ChoicePicker id="diff-lien" valeur={lien} onChange={setLien}
            choix={LIENS.map(([v, l]) => ({ valeur: v, libelle: l }))} />
        </Field>

        {titre.trim() && (
          <div className="rounded-2xl bg-suguba-sauge p-3 flex gap-3">
            <span className="w-9 h-9 rounded-full bg-suguba-menthe text-suguba-profond flex items-center justify-center shrink-0"><Bell className="w-4 h-4" /></span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Aperçu de la notification</p>
              <p className="text-sm font-semibold text-slate-900">{titre.trim()}</p>
              {texte.trim() && <p className="text-xs text-slate-600 whitespace-pre-line">{texte.trim()}</p>}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={envoyer} disabled={envoi || !titre.trim() || !nb} fullWidth>
            <Send className="w-4 h-4" />{envoi ? 'Envoi…' : `Envoyer la notification${nb ? ` (${nb})` : ''}`}
          </Button>
          <Button variant="ghost" onClick={copier} disabled={!texteWhatsApp} fullWidth>
            {copie ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copie ? 'Copié' : 'Copier pour WhatsApp'}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          La notification apparaît dans la cloche de chaque compte actif du groupe. Pour WhatsApp, copiez le texte et
          publiez-le vous-même dans vos groupes ou votre statut : un envoi automatique en masse ferait bannir le numéro.
        </p>
      </Card>
    </PageReseau>
  );
}
