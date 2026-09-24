'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, ArrowLeft, ArrowRight, MapPin, PartyPopper, Phone } from 'lucide-react';
import Header from '@/components/common/Header';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import CarteLien from '@/components/reseau/CarteLien';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Card } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { FAMILLES_CATEGORIES } from '@/lib/product-categories';

/**
 * Démarrage du revendeur (§ 4 des écrans) — huit étapes courtes, UNE question
 * par écran : informations, téléphone, ville, adresse, localisation, boutique,
 * catégories, finalisation.
 *
 * Rien n'est bloquant : chaque étape s'enregistre dès « Continuer », et le
 * revendeur peut quitter à tout moment pour vendre — le cahier des charges
 * demande que le compte soit utilisable dès les étapes minimales, la
 * vérification avancée ne conditionnant que certaines fonctions.
 */

const ETAPES = ['Vous', 'Téléphone', 'Ville', 'Adresse', 'Localisation', 'Boutique', 'Catégories', 'C’est parti'];
const VILLES = ['Bamako', 'Kati', 'Sikasso', 'Ségou', 'Kayes', 'Mopti', 'Koutiala', 'Autre'];

export default function DemarrerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [etape, setEtape] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [origine, setOrigine] = useState('https://app.sugubaml.com');

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [ville, setVille] = useState('Bamako');
  const [quartier, setQuartier] = useState('');
  const [adresse, setAdresse] = useState('');
  const [localisationEnvoyee, setLocalisationEnvoyee] = useState(false);
  const [nomBoutique, setNomBoutique] = useState('');
  const [slugBoutique, setSlugBoutique] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    setOrigine(window.location.origin);
    fetch('/api/reseller/me').then((r) => r.json()).then((d) => {
      const r = d.reseller;
      if (!r) return;
      setNom(r.fullName || '');
      setTelephone(r.phone || '');
      if (r.city) setVille(r.city);
      setQuartier(r.neighborhood || '');
      setAdresse(r.address || '');
      setCategories(r.categories || []);
    }).catch(() => undefined);
    fetch('/api/reseller/boutique').then((r) => r.json()).then((d) => {
      if (d.boutique) { setNomBoutique(d.boutique.nom || ''); setSlugBoutique(d.boutique.slug); }
    }).catch(() => undefined);
  }, []);

  const enregistrerProfil = async (champs: Record<string, unknown>) => {
    const reponse = await fetch('/api/reseller/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(champs),
    });
    if (!reponse.ok) throw new Error((await reponse.json()).error || 'Enregistrement impossible.');
  };

  /** Enregistre l'étape en cours puis avance. */
  const continuer = async () => {
    setEnvoi(true);
    try {
      if (etape === 0) await enregistrerProfil({ fullName: nom });
      if (etape === 2) await enregistrerProfil({ city: ville });
      if (etape === 3) await enregistrerProfil({ neighborhood: quartier, address: adresse });
      if (etape === 5 && nomBoutique.trim()) {
        const r = await fetch('/api/reseller/boutique', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: nomBoutique }),
        });
        const d = await r.json();
        if (r.ok && d.boutique) setSlugBoutique(d.boutique.slug);
      }
      if (etape === 6) {
        await enregistrerProfil({ categories });
        await fetch('/api/reseller/boutique', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories }),
        }).catch(() => undefined);
      }
      if (etape === 7) {
        await enregistrerProfil({ onboardingDone: true });
        router.push('/reseller');
        return;
      }
      setEtape((e) => Math.min(ETAPES.length - 1, e + 1));
    } catch (erreur) {
      toast((erreur as Error).message, { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  const envoyerLocalisation = async () => {
    setEnvoi(true);
    try {
      const r = await fetch('/api/reseau/verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'location', quartier }),
      });
      const d = await r.json();
      if (!r.ok && !/déjà en cours/.test(d.error || '')) { toast(d.error || 'Envoi impossible.', { ton: 'erreur' }); return; }
      setLocalisationEnvoyee(true);
      toast('Localisation envoyée pour vérification.', { ton: 'succes' });
    } catch {
      toast('Envoi impossible. Vérifiez votre connexion.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  const peutContinuer =
    (etape === 0 && nom.trim().length >= 2) ||
    (etape === 3 && quartier.trim().length > 0) ||
    (etape === 5 && nomBoutique.trim().length >= 2) ||
    [1, 2, 4, 6, 7].includes(etape);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Étape {etape + 1} sur {ETAPES.length}</span>
            <button type="button" onClick={() => router.push('/reseller')} className="underline min-h-[32px]">Terminer plus tard</button>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {ETAPES.map((e, i) => (
              <span key={e} className={`h-1.5 flex-1 rounded-full ${i <= etape ? 'bg-suguba-brand' : 'bg-slate-200'}`} />
            ))}
          </div>
          <h1 className="text-xl font-bold text-slate-900 pt-1">{ETAPES[etape]}</h1>
        </div>

        <Card className="space-y-4">
          {etape === 0 && (
            <Field label="Votre nom complet" htmlFor="nom" aide="Seuls votre prénom et l’initiale du nom apparaissent sur votre boutique." requis>
              <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" autoFocus />
            </Field>
          )}

          {etape === 1 && (
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><Phone className="w-5 h-5" /></span>
              <div>
                <p className="text-sm font-bold text-slate-900">{telephone || 'Numéro non renseigné'}</p>
                <p className="text-xs text-slate-500">C’est à ce numéro que Suguba vous appelle et vous verse vos gains. Vous pourrez le faire vérifier dans « Mon profil vérifié ».</p>
              </div>
            </div>
          )}

          {etape === 2 && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ville">
              {VILLES.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={ville === v} onClick={() => setVille(v)}
                  className={`h-12 rounded-2xl border text-sm font-bold ${ville === v ? 'border-suguba-brand ring-2 ring-suguba-brand bg-suguba-brand/5 text-slate-900' : 'border-slate-200 bg-white text-slate-700'}`}>
                  {v}
                </button>
              ))}
            </div>
          )}

          {etape === 3 && (
            <>
              <Field label="Votre quartier" htmlFor="quartier" requis>
                {ville === 'Bamako' ? (
                  <NeighborhoodPicker id="quartier" value={quartier} onChange={setQuartier} placeholder="Choisir mon quartier" />
                ) : (
                  <Input id="quartier" value={quartier} onChange={(e) => setQuartier(e.target.value)} />
                )}
              </Field>
              <Field label="Repère (facultatif)" htmlFor="adresse" aide="Ex. : près de la mosquée, rue 312.">
                <Input id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={200} />
              </Field>
            </>
          )}

          {etape === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Confirmez votre quartier ({quartier || 'non renseigné'}) pour obtenir le badge <strong>Localisation vérifiée</strong>.
                C’est facultatif, et ça rassure vos clients.
              </p>
              <Button variant={localisationEnvoyee ? 'ghost' : 'secondary'} fullWidth disabled={envoi || localisationEnvoyee || !quartier} onClick={envoyerLocalisation}>
                {localisationEnvoyee ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                {localisationEnvoyee ? 'Envoyée pour vérification' : 'Faire vérifier ma localisation'}
              </Button>
            </div>
          )}

          {etape === 5 && (
            <Field label="Nom de votre boutique" htmlFor="boutique" aide="Ex. : « Chez Awa — Électroménager ». Modifiable plus tard." requis>
              <Input id="boutique" value={nomBoutique} onChange={(e) => setNomBoutique(e.target.value)} maxLength={60} />
            </Field>
          )}

          {etape === 6 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Ce que vous voulez vendre. Suguba vous proposera d’abord ces produits.</p>
              <div className="flex flex-wrap gap-2">
                {FAMILLES_CATEGORIES.map((f) => {
                  const actif = categories.includes(f.famille);
                  return (
                    <button key={f.famille} type="button" aria-pressed={actif}
                      onClick={() => setCategories((c) => (actif ? c.filter((x) => x !== f.famille) : [...c, f.famille]))}
                      className={`px-3.5 min-h-[40px] rounded-full text-xs font-bold border ${actif ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                      {f.famille}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {etape === 7 && (
            <div className="space-y-3 text-center">
              <PartyPopper className="w-10 h-10 text-suguba-brand mx-auto" />
              <p className="text-sm text-slate-700">Votre boutique est prête. Partagez-la sur votre statut WhatsApp dès maintenant.</p>
            </div>
          )}
        </Card>

        {etape === 7 && slugBoutique && (
          <CarteLien titre="Ma boutique" url={`${origine}/boutique/${slugBoutique}`}
            texteWhatsApp={`🛍️ Ma boutique Suguba — ${nomBoutique}\nCommandez, vous payez à la livraison.\n👉 ${origine}/boutique/${slugBoutique}`} />
        )}

        <div className="flex gap-2">
          {etape > 0 && (
            <Button variant="ghost" onClick={() => setEtape((e) => e - 1)} disabled={envoi} aria-label="Étape précédente">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Button fullWidth size="lg" onClick={continuer} disabled={envoi || !peutContinuer}>
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : etape === 7 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            {etape === 7 ? 'Aller à mon espace' : 'Continuer'}
          </Button>
        </div>
      </main>
    </div>
  );
}
