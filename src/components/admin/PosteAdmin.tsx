'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, Search, X, ExternalLink, ChevronDown, LogOut, Bell,
  ClipboardList, LayoutDashboard, TrendingUp, BarChart3, HelpCircle, ShoppingBag, FileText, Hammer, LifeBuoy,
  MessageSquareWarning, Boxes, Table2, PackagePlus, Store, Users, Bike, ShieldCheck, Contact, Wallet, Banknote,
  Gift, Target, Gauge, Megaphone, Radio, ToggleRight, Home, Calculator, Network, Settings, UserCog, BookOpen,
  ScrollText, Lock, CheckCheck, Circle,
} from 'lucide-react';
import { PosteAdminContexte, type Poste, type ValeurPoste } from './contexte';
import RechercheGlobale from './RechercheGlobale';
import { compteurEntree } from '@/lib/admin/poste';
import { deconnecter } from '@/lib/deconnexion';
import { useToast } from '@/components/ui/Toast';

/** Icône de chaque page du menu : on repère une entrée d'un coup d'œil. */
const ICONES: Record<string, React.ElementType> = {
  '/admin/a-traiter': ClipboardList, '/admin': LayoutDashboard, '/admin/analytics': TrendingUp,
  '/admin/reports/daily': BarChart3, '/admin/diagnostic': HelpCircle,
  '/admin/commandes': ShoppingBag, '/admin/devis': FileText, '/admin/prestations': Hammer, '/admin/sav': LifeBuoy,
  '/admin/messages': MessageSquareWarning,
  '/admin/products': Boxes, '/admin/catalogue': Table2, '/admin/products/new': PackagePlus, '/admin/recherche': Search,
  '/admin/boutique-suguba': Store,
  '/admin/utilisateurs': Users, '/admin/livreurs': Bike, '/admin/boutiques': Store, '/admin/verifications': ShieldCheck,
  '/admin/acces-coordonnees': Contact,
  '/admin/retraits': Wallet, '/admin/caisse-livreurs': Banknote, '/admin/recompenses': Gift,
  '/admin/missions': Target, '/admin/resultats': Gauge, '/admin/sponsorisations': Megaphone, '/admin/broadcast': Radio,
  '/admin/modules': ToggleRight, '/admin/accueil': Home, '/admin/simulateur': Calculator, '/admin/priorite-reseau': Network,
  '/admin/parametres': Settings,
  '/admin/equipe': UserCog, '/admin/guide': BookOpen, '/admin/journal': ScrollText, '/admin/securite': Lock,
  '/admin/validations': CheckCheck,
};

const CLE_REPLIEES = 'suguba_menu_replie';
const RAFRAICHISSEMENT_MS = 120_000;
const POSTE_VIDE: Poste = { nom: '', teamRole: null, metier: 'direction', libelleMetier: '', permissions: [], rubriques: [] };

/** Environnement affiché en permanence : on ne confond jamais essai et production. */
function environnement(): { libelle: string; classe: string } {
  if (typeof window === 'undefined') return { libelle: '', classe: '' };
  const h = window.location.hostname;
  if (h === 'app.sugubaml.com') return { libelle: 'Production', classe: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/40' };
  if (h === 'localhost' || h === '127.0.0.1') return { libelle: 'Local', classe: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-300/40' };
  return { libelle: 'Prévisualisation', classe: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/40' };
}

/** Page active : correspondance exacte, ou sous-page (sauf vue d'ensemble et produits, qui ont des sous-pages au menu). */
function estActive(href: string, pathname: string): boolean {
  if (href === pathname) return true;
  if (href === '/admin' || href === '/admin/products') return false;
  return pathname.startsWith(`${href}/`);
}

function Pastille({ n, actif }: { n: number; actif: boolean }) {
  if (!n) return null;
  return (
    <span className={`ml-auto min-w-[22px] h-[20px] px-1.5 rounded-full text-[11px] font-bold tabular-nums inline-flex items-center justify-center ${actif ? 'bg-suguba-profond text-white' : 'bg-suguba-citron text-suguba-profond'}`}>
      {n >= 50 ? '50+' : n}
    </span>
  );
}

function Navigation({ poste, compteurs, pathname, repliees, basculer, onNaviguer }: {
  poste: Poste | null; compteurs: ValeurPoste['compteurs']; pathname: string;
  repliees: string[]; basculer: (cle: string) => void; onNaviguer?: () => void;
}) {
  if (!poste) return <div className="px-3 py-4 space-y-2">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-7 rounded-lg bg-white/10 animate-pulse" />)}</div>;
  if (!poste.rubriques.length) {
    return <p className="px-4 py-4 text-sm text-emerald-50">Aucun rôle d’équipe : demandez à un Super Admin de vous en attribuer un, dans « Équipe et permissions ».</p>;
  }
  return (
    <nav aria-label="Menu de l’équipe" className="px-2 py-3 space-y-1">
      {poste.rubriques.map((r) => {
        const contientActive = r.entrees.some((e) => estActive(e.href, pathname));
        const ouverte = contientActive || !repliees.includes(r.cle);
        const totalRubrique = r.entrees.reduce((s, e) => s + (e.href === '/admin/a-traiter' ? 0 : compteurEntree(e.href, compteurs)), 0);
        return (
          <div key={r.cle}>
            <button type="button" onClick={() => basculer(r.cle)} aria-expanded={ouverte} disabled={contientActive}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-emerald-100/70 hover:text-white disabled:hover:text-emerald-100/70 disabled:cursor-default">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${ouverte ? '' : '-rotate-90'}`} aria-hidden="true" />
              <span className="flex-1 text-left">{r.titre}</span>
              {!ouverte && totalRubrique > 0 && <Pastille n={totalRubrique} actif={false} />}
            </button>
            {ouverte && (
              <ul className="space-y-0.5 pb-2">
                {r.entrees.map((e) => {
                  const actif = estActive(e.href, pathname);
                  const Icone = ICONES[e.href] || Circle;
                  return (
                    <li key={e.href}>
                      <Link href={e.href} onClick={onNaviguer} aria-current={actif ? 'page' : undefined}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${actif ? 'bg-white text-suguba-profond font-bold' : 'text-emerald-50 hover:bg-white/10'}`}>
                        <Icone className={`w-4 h-4 shrink-0 ${actif ? '' : 'text-emerald-100/80'}`} aria-hidden="true" />
                        <span className="truncate">{e.libelle}</span>
                        <Pastille n={compteurEntree(e.href, compteurs)} actif={actif} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Poste de travail de l'équipe (A1, refait en U3 le 2026-09-27) — enveloppe
 * de TOUTES les pages /admin.
 *
 * Ordinateur : menu latéral fixe (icônes, compteurs de dossiers en attente,
 * rubriques repliables), recherche globale (Ctrl+K), environnement, et en
 * bas le compte : notifications, voir le site, se déconnecter — l'en-tête
 * public, qui portait la déconnexion, est masqué ici.
 * Téléphone : UNE barre (Menu · environnement · Rechercher) ; le même menu
 * s'ouvre en tiroir. L'en-tête et la barre du bas du site s'effacent.
 */
export default function PosteAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin';
  const router = useRouter();
  const { toast } = useToast();
  const [poste, setPoste] = useState<Poste | null>(null);
  const [compteurs, setCompteurs] = useState<ValeurPoste['compteurs']>(null);
  const [tiroir, setTiroir] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [env, setEnv] = useState({ libelle: '', classe: '' });
  const [repliees, setRepliees] = useState<string[]>([]);
  const [sortie, setSortie] = useState(false);

  const chargerCompteurs = useCallback(() => {
    fetch('/api/admin/a-traiter?compteurs=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.compteurs) setCompteurs(j.compteurs); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setEnv(environnement());
    try { const v = JSON.parse(localStorage.getItem(CLE_REPLIEES) || '[]'); if (Array.isArray(v)) setRepliees(v); } catch { /* stockage indisponible */ }
    fetch('/api/admin/poste', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setPoste(p ? { ...POSTE_VIDE, ...p } : POSTE_VIDE);
        if (p?.permissions?.length) chargerCompteurs();
      })
      .catch(() => setPoste(POSTE_VIDE));
  }, [chargerCompteurs]);

  // Compteurs tenus à jour : toutes les 2 minutes, et au retour sur l'onglet.
  useEffect(() => {
    if (!poste?.permissions.length) return;
    const surRetour = () => { if (document.visibilityState === 'visible') chargerCompteurs(); };
    const minuterie = setInterval(surRetour, RAFRAICHISSEMENT_MS);
    document.addEventListener('visibilitychange', surRetour);
    return () => { clearInterval(minuterie); document.removeEventListener('visibilitychange', surRetour); };
  }, [poste, chargerCompteurs]);

  const basculer = useCallback((cle: string) => {
    setRepliees((l) => {
      const suivantes = l.includes(cle) ? l.filter((c) => c !== cle) : [...l, cle];
      try { localStorage.setItem(CLE_REPLIEES, JSON.stringify(suivantes)); } catch { /* stockage indisponible */ }
      return suivantes;
    });
  }, []);

  const ouvrirRecherche = useCallback(() => { setTiroir(false); setRecherche(true); }, []);
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ouvrirRecherche(); }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ouvrirRecherche]);
  useEffect(() => { setTiroir(false); }, [pathname]);

  const seDeconnecter = async () => {
    setSortie(true);
    const ok = await deconnecter();
    setSortie(false);
    if (!ok) { toast('Déconnexion non confirmée. Rétablissez la connexion puis réessayez.', { ton: 'erreur' }); return; }
    router.push('/');
  };

  const valeur = useMemo<ValeurPoste>(() => ({ dansPoste: true, poste, compteurs, rafraichir: chargerCompteurs }), [poste, compteurs, chargerCompteurs]);
  const navigation = (onNaviguer?: () => void) => (
    <Navigation poste={poste} compteurs={compteurs} pathname={pathname} repliees={repliees} basculer={basculer} onNaviguer={onNaviguer} />
  );

  const entete = (
    <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/a-traiter" className="text-white font-extrabold tracking-tight text-lg">Suguba · Équipe</Link>
        {env.libelle && <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${env.classe}`}>{env.libelle}</span>}
      </div>
      <button type="button" onClick={ouvrirRecherche}
        className="w-full h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-emerald-50 text-sm inline-flex items-center gap-2">
        <Search className="w-4 h-4" /><span className="flex-1 text-left">Rechercher</span>
        <kbd className="text-[11px] font-semibold text-emerald-100/70">Ctrl K</kbd>
      </button>
    </div>
  );
  const pied = (
    <div className="px-3 py-3 border-t border-white/10 space-y-2">
      {poste?.nom ? (
        <div className="flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{poste.nom}</p>
            {poste.libelleMetier && <p className="text-xs text-emerald-100/80 truncate">{poste.libelleMetier}</p>}
          </div>
          <Link href="/notifications" aria-label="Notifications"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white inline-flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </Link>
        </div>
      ) : null}
      <div className="flex items-center gap-1">
        <Link href="/" className="flex-1 inline-flex items-center gap-1.5 px-2 h-9 rounded-lg text-xs font-semibold text-emerald-50 hover:bg-white/10">
          <ExternalLink className="w-3.5 h-3.5" />Voir le site
        </Link>
        <button type="button" onClick={seDeconnecter} disabled={sortie}
          className="flex-1 inline-flex items-center gap-1.5 px-2 h-9 rounded-lg text-xs font-semibold text-emerald-50 hover:bg-white/10 disabled:opacity-60">
          <LogOut className="w-3.5 h-3.5" />{sortie ? 'Déconnexion…' : 'Se déconnecter'}
        </button>
      </div>
    </div>
  );

  return (
    <PosteAdminContexte.Provider value={valeur}>
      {/* Ordinateur : menu latéral fixe */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-suguba-profond">
        {entete}
        <div className="flex-1 overflow-y-auto">{navigation()}</div>
        {pied}
      </aside>

      {/* Téléphone et tablette : une seule barre + tiroir */}
      <div className="lg:hidden sticky top-0 z-40 bg-suguba-profond text-white px-4 h-12 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setTiroir(true)} className="inline-flex items-center gap-2 text-sm font-bold min-h-[44px]" aria-expanded={tiroir}>
          <Menu className="w-5 h-5" />Suguba · Équipe
        </button>
        <div className="flex items-center gap-1">
          {env.libelle && <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${env.classe}`}>{env.libelle}</span>}
          <button type="button" onClick={ouvrirRecherche} aria-label="Rechercher" className="w-11 h-11 inline-flex items-center justify-center"><Search className="w-5 h-5" /></button>
        </div>
      </div>
      {tiroir && (
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu de l’équipe">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-slate-900/50" onClick={() => setTiroir(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-suguba-profond flex flex-col">
            <button type="button" onClick={() => setTiroir(false)} aria-label="Fermer" className="absolute top-3 right-3 w-9 h-9 text-white inline-flex items-center justify-center"><X className="w-5 h-5" /></button>
            {entete}
            <div className="flex-1 overflow-y-auto">{navigation(() => setTiroir(false))}</div>
            {pied}
          </div>
        </div>
      )}

      <div className="lg:pl-64">{children}</div>
      {recherche && <RechercheGlobale onFermer={() => setRecherche(false)} />}
    </PosteAdminContexte.Provider>
  );
}
