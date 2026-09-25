'use client';

import React, { useEffect, useState } from 'react';
import { Store, ShoppingBag, Truck, Shield, Globe, ArrowRight, Plus, Loader2, Check } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import { Card } from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import ChoicePicker from '@/components/ui/ChoicePicker';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import DialCodePicker from '@/components/common/DialCodePicker';
import { DEFAULT_DIAL_CODE } from '@/lib/dial-codes';
import { useToast } from '@/components/ui/Toast';

/**
 * Mes profils (2026-09-24) — réponse à « je veux devenir fournisseur, comment
 * faire ? ».
 *
 * Un seul compte, plusieurs profils : on AJOUTE un profil au lieu d'en changer.
 * L'historique, les gains, les clients et la boutique déjà acquis restent ;
 * on passe d'un espace à l'autre depuis cette page. Le rôle naît actif (voir
 * /api/auth/request-role), avec sa fiche métier pour un fournisseur ou un
 * livreur. Aucun second compte, aucune perte.
 */

type Role = 'reseller' | 'supplier' | 'driver' | 'admin' | 'diaspora';

const PROFILS: Record<Role, { libelle: string; icone: React.ElementType; espace: string; atout: string }> = {
  reseller: { libelle: 'Revendeur', icone: Store, espace: '/reseller', atout: 'Partagez les produits sur WhatsApp et touchez une commission sur chaque vente, sans stock.' },
  supplier: { libelle: 'Fournisseur', icone: ShoppingBag, espace: '/supplier', atout: 'Mettez vos articles en ligne : les revendeurs les vendent pour vous, Suguba livre.' },
  driver: { libelle: 'Livreur', icone: Truck, espace: '/driver', atout: 'Livrez les commandes dans votre zone et soyez payé à chaque course.' },
  admin: { libelle: 'Admin', icone: Shield, espace: '/admin', atout: '' },
  diaspora: { libelle: 'Diaspora', icone: Globe, espace: '/diaspora', atout: '' },
};

const AJOUTABLES: Role[] = ['reseller', 'supplier', 'driver'];

export default function MesProfilsPage() {
  const { toast, confirmer } = useToast();
  const [roles, setRoles] = useState<Record<string, string> | null>(null);
  const [actif, setActif] = useState<string>('');
  const [ouvert, setOuvert] = useState<Role | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fiche, setFiche] = useState({ companyName: '', warehouseNeighborhood: '', category: '', vehicleType: 'Moto', zone: '' });
  // Vrai numéro absent (compte créé sans jamais le demander, ex. via script) :
  // /api/auth/request-role l'exige avant d'ajouter un rôle non-admin, sinon
  // le nouveau rôle serait aussitôt renvoyé vers /register/complete par le
  // middleware — une seconde saisie de tout le formulaire, en double de
  // celle-ci.
  const [numeroManquant, setNumeroManquant] = useState(false);
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((moi) => {
        if (!moi?.authenticated) { window.location.replace('/login?next=/compte/profils'); return; }
        setRoles(moi.roles || { [moi.role]: moi.status });
        setActif(moi.role);
        setNumeroManquant(typeof moi.phone === 'string' && moi.phone.includes('@'));
      })
      .catch(() => toast('Impossible de lire votre compte.', { ton: 'erreur' }));
  }, [toast]);

  const detenus = roles ? (Object.keys(roles) as Role[]).filter((r) => PROFILS[r]) : [];
  const aAjouter = roles ? AJOUTABLES.filter((r) => !roles[r]) : [];

  const ajouter = async (role: Role) => {
    if (role === 'supplier' && !fiche.companyName.trim()) { toast('Indiquez le nom de votre entreprise ou boutique.', { ton: 'erreur' }); return; }
    if (numeroManquant && phone.replace(/\D/g, '').length < 8) { toast('Indiquez votre numéro WhatsApp.', { ton: 'erreur' }); return; }
    const ok = await confirmer({
      titre: `Ajouter le profil ${PROFILS[role].libelle} ?`,
      message: 'Vous gardez votre compte et tout ce qu’il contient. Vous passerez d’un espace à l’autre depuis « Mes profils ».',
      confirmer: 'Ajouter',
    });
    if (!ok) return;
    setEnvoi(true);
    try {
      const r = await fetch('/api/auth/request-role', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, fiche, phone: numeroManquant ? `${dialCode}${phone.replace(/\D/g, '')}` : undefined }),
      });
      const d = await r.json();
      if (!r.ok) {
        // Numéro déjà pris par un autre compte (voir /api/auth/request-role) :
        // le renvoyer se connecter avec ce compte plutôt qu'un cul-de-sac.
        if (d.dejaCompte) {
          toast('Ce numéro appartient déjà à un compte. Connectez-vous avec lui plutôt que d’en créer un nouveau.', { ton: 'erreur' });
        } else {
          toast(d.error || 'Ajout impossible.', { ton: 'erreur' });
        }
        return;
      }
      toast(`Profil ${PROFILS[role].libelle} ajouté.`, { ton: 'succes' });
      window.location.replace(PROFILS[role].espace);
    } catch {
      toast('Erreur réseau : rien n’a été modifié.', { ton: 'erreur' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <PageReseau titre="Mes profils" sousTitre="Un seul compte, plusieurs activités.">
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Vos profils</h2>
        {!roles ? (
          <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
        ) : (
          <ul className="space-y-2">
            {detenus.map((r) => {
              const P = PROFILS[r];
              return (
                <li key={r}>
                  <a href={P.espace} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 hover:border-suguba-profond">
                    <span className="w-10 h-10 rounded-full bg-suguba-menthe text-suguba-profond flex items-center justify-center shrink-0"><P.icone className="w-5 h-5" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{P.libelle}</span>
                      <span className="block text-xs text-slate-500">{r === actif ? 'Espace ouvert en ce moment' : 'Ouvrir cet espace'}</span>
                    </span>
                    {r === actif ? <Check className="w-4 h-4 text-suguba-profond" /> : <ArrowRight className="w-4 h-4 text-slate-400" />}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {aAjouter.length > 0 && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Ajouter un profil</h2>
            <p className="text-xs text-slate-500">
              Pas besoin d’un nouveau compte : votre historique, vos gains et vos clients restent là.
            </p>
          </div>
          {aAjouter.map((r) => {
            const P = PROFILS[r];
            const deplie = ouvert === r;
            return (
              <div key={r} className={`rounded-2xl border p-3 space-y-3 ${deplie ? 'border-suguba-profond' : 'border-slate-200'}`}>
                <button type="button" onClick={() => setOuvert(deplie ? null : r)} aria-expanded={deplie} className="w-full flex items-center gap-3 text-left">
                  <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"><P.icone className="w-5 h-5" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">Devenir {P.libelle.toLowerCase()}</span>
                    <span className="block text-xs text-slate-500">{P.atout}</span>
                  </span>
                  <Plus className={`w-4 h-4 text-slate-400 transition-transform ${deplie ? 'rotate-45' : ''}`} />
                </button>
                {deplie && (
                  <div className="space-y-3">
                    {numeroManquant && (
                      <Field label="Votre numéro WhatsApp" htmlFor="p-telephone" requis aide="Indispensable pour vous prévenir de vos commandes et de vos gains — votre compte n'en a pas encore.">
                        <div className="flex gap-2">
                          <DialCodePicker value={dialCode} onChange={setDialCode} className="h-11" />
                          <input id="p-telephone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                            placeholder="76 12 34 56"
                            className="flex-1 min-w-0 h-11 px-3.5 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-suguba-profond/30 focus:border-suguba-profond" />
                        </div>
                      </Field>
                    )}
                    {r === 'supplier' && (
                      <>
                        <Field label="Nom de votre entreprise ou boutique" htmlFor="p-entreprise" requis>
                          <Input id="p-entreprise" value={fiche.companyName} maxLength={120} onChange={(e) => setFiche({ ...fiche, companyName: e.target.value })} />
                        </Field>
                        <Field label="Quartier de votre dépôt" htmlFor="p-quartier" aide="Le livreur viendra y récupérer les colis.">
                          <NeighborhoodPicker id="p-quartier" value={fiche.warehouseNeighborhood} onChange={(q) => setFiche({ ...fiche, warehouseNeighborhood: q })} placeholder="Choisir un quartier" />
                        </Field>
                        <Field label="Ce que vous vendez" htmlFor="p-categorie">
                          <Input id="p-categorie" value={fiche.category} maxLength={80} placeholder="Ex. Électronique, Mode, Cosmétiques" onChange={(e) => setFiche({ ...fiche, category: e.target.value })} />
                        </Field>
                      </>
                    )}
                    {r === 'driver' && (
                      <>
                        <Field label="Véhicule" htmlFor="p-vehicule">
                          <ChoicePicker id="p-vehicule" valeur={fiche.vehicleType} onChange={(v) => setFiche({ ...fiche, vehicleType: v })}
                            choix={['Moto', 'Tricycle', 'Voiture', 'Vélo'].map((v) => ({ valeur: v, libelle: v }))} />
                        </Field>
                        <Field label="Zone où vous livrez" htmlFor="p-zone">
                          <NeighborhoodPicker id="p-zone" value={fiche.zone} onChange={(q) => setFiche({ ...fiche, zone: q })} placeholder="Choisir un quartier" />
                        </Field>
                      </>
                    )}
                    <Button onClick={() => ajouter(r)} disabled={envoi} fullWidth>
                      {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Ajouter le profil {P.libelle}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </PageReseau>
  );
}
