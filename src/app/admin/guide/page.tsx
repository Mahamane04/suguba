import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import React from 'react';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { chargerGuide, numerosDesPages, sessionAdministrateurGeneral, type BlocTexte, type PageGuide } from '@/lib/guide';

/**
 * Guide des parcours — PAGE CACHÉE (2026-09-19).
 *
 * Aucune entrée de menu n'y mène. Réservée à l'administrateur général (admin
 * sans rôle d'équipe restreint, ou Super Admin) : tout autre visiteur reçoit
 * la page 404 standard, comme si l'adresse n'existait pas.
 *
 * Contenu lu dans docs/guide/guide.json : il est mis à jour à chaque
 * modification de l'application, avec une entrée de journal qui confronte
 * la demande de l'utilisateur à ce qui a été livré.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Guide des parcours — Suguba', robots: { index: false, follow: false } };

/** Mise en forme minimale des textes du guide : **gras** et `code`. */
function Riche({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {morceaux.map((m, i) =>
        m.startsWith('**') ? <strong key={i} className="font-bold text-inherit">{m.slice(2, -2)}</strong>
          : m.startsWith('`') ? <code key={i} className="font-mono text-[0.85em] bg-slate-100 rounded px-1">{m.slice(1, -1)}</code>
            : <React.Fragment key={i}>{m}</React.Fragment>,
      )}
    </>
  );
}

function Bloc({ bloc }: { bloc: BlocTexte }) {
  return (
    <div className={`rounded-3xl border p-5 ${bloc.alerte ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-slate-200'}`}>
      <h3 className="text-base font-bold mb-2.5">{bloc.titre}</h3>
      <ul className="space-y-1.5 text-sm list-disc pl-5 marker:text-[#09b500]">
        {bloc.points.map((p, i) => <li key={i}><Riche texte={p} /></li>)}
      </ul>
    </div>
  );
}

function Fiche({ page, numero, numeros }: { page: PageGuide; numero: string; numeros: Record<string, string> }) {
  return (
    <article id={page.id} className="scroll-mt-28 grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] items-start py-8 border-b border-slate-200">
      {page.capture ? (
        <figure className="md:sticky md:top-28 mx-auto w-full max-w-[280px] rounded-[32px] bg-[#0b1410] p-2.5 shadow-float m-0">
          <div className="rounded-[24px] overflow-y-auto max-h-[540px] bg-white overscroll-contain" tabIndex={0} aria-label={`Capture de ${page.titre}, à faire défiler`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/admin/guide/capture/${page.id}`} alt={`Capture de la page ${page.titre} sur téléphone`} loading="lazy" className="block w-full h-auto" />
          </div>
          <figcaption className="text-center text-xs text-slate-400 mt-2">Faites défiler la capture</figcaption>
        </figure>
      ) : (
        <div className="mx-auto w-full max-w-[280px] rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Pas de capture pour cette page (voir la note).
        </div>
      )}
      <div className="min-w-0 space-y-3.5">
        <p className="font-mono text-xs text-suguba-brand-dark">{numero}</p>
        <h3 className="text-xl font-bold text-slate-900 leading-tight">{page.titre}</h3>
        <p className="inline-block font-mono text-xs bg-slate-100 text-slate-600 rounded-lg px-2 py-0.5 break-all">{page.chemin}</p>
        <p className="text-[15px] text-slate-800 max-w-prose"><Riche texte={page.but} /></p>
        {page.elements.length > 0 && (
          <>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-1">Boutons et éléments</h4>
            <dl className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
              {page.elements.map((e, i) => (
                <div key={i} className="grid sm:grid-cols-[180px_minmax(0,1fr)] gap-0.5 sm:gap-3 px-4 py-2.5 text-sm">
                  <dt className="font-bold text-slate-900"><Riche texte={e.nom} /></dt>
                  <dd className="text-slate-600"><Riche texte={e.role} /></dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {page.suite.length > 0 && (
          <>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-1">Mène à</h4>
            <div className="flex flex-wrap gap-2">
              {page.suite.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="inline-flex items-center rounded-full bg-emerald-50 text-suguba-profond text-xs font-bold px-3 min-h-[32px] hover:ring-1 hover:ring-suguba-brand">
                  {numeros[s.id] ? `${numeros[s.id]} · ` : ''}{s.libelle} →
                </a>
              ))}
            </div>
          </>
        )}
        {page.note && (
          <p className={`rounded-xl px-4 py-2.5 text-sm ${page.attention ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>
            <Riche texte={page.note} />
          </p>
        )}
      </div>
    </article>
  );
}

export default async function GuidePage() {
  const session = await sessionAdministrateurGeneral((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  if (!session) notFound();

  const guide = await chargerGuide();
  const numeros = numerosDesPages(guide);
  const titres = Object.fromEntries(guide.pages.map((p) => [p.id, p.titre]));

  return (
    <div className="min-h-screen flex flex-col bg-[#f2f6f1] pb-20 md:pb-0">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6">
        <header className="pt-8 pb-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-suguba-brand-dark">Page cachée · administrateur général · mise à jour le {guide.majLe}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Guide des parcours</h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl">
            Toutes les pages de Suguba dans l’ordre des parcours, le rôle de chaque bouton, et le journal de chaque demande
            confrontée à ce qui a été livré.
          </p>
        </header>

        <nav aria-label="Sections du guide" className="sticky top-16 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-[#f2f6f1]/95 backdrop-blur border-b border-slate-200">
          <ul className="flex gap-2 overflow-x-auto scrollbar-none">
            {[['journal', 'Journal des demandes'], ['communs', 'Éléments communs'], ['parcours', 'Parcours'],
              ...guide.roles.map((r) => [r.cle, `${r.titre} (${guide.pages.filter((p) => p.role === r.cle).length})`]),
              ['a-savoir', 'À savoir']].map(([id, libelle]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex items-center whitespace-nowrap rounded-full bg-white border border-slate-200 px-3.5 min-h-[36px] text-xs font-bold text-slate-800 hover:border-suguba-brand">{libelle}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Journal : la demande, dans les mots de l'utilisateur, face à ce qui a été fait. */}
        <section id="journal" className="scroll-mt-28 pt-8 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Journal des demandes</h2>
            <p className="text-sm text-slate-600 mt-1">La plus récente en premier. Comparez votre demande à ce qui a été livré, et aux écarts signalés.</p>
          </div>
          {guide.journal.map((j, i) => (
            <article key={i} className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-slate-500">{j.date}</span>
                <span className={`rounded-full px-2.5 py-0.5 font-bold ${j.statut === 'en ligne' ? 'bg-emerald-50 text-suguba-brand-dark' : 'bg-amber-50 text-amber-800'}`}>{j.statut}</span>
                {j.commit && <span className="font-mono rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5">{j.commit}</span>}
              </div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{j.titre}</h3>
              <blockquote className="border-l-4 border-suguba-brand bg-emerald-50/50 rounded-r-xl px-4 py-2.5 text-sm text-slate-800">
                <span className="block text-xs font-bold uppercase tracking-wider text-suguba-brand-dark mb-1">Votre demande</span>
                {j.demande}
              </blockquote>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ce qui a été fait</p>
                  <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5 marker:text-[#09b500]">
                    {j.realise.map((r, k) => <li key={k}><Riche texte={r} /></li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Écarts et points à décider</p>
                  {j.ecarts.length ? (
                    <ul className="space-y-1 text-sm text-amber-900 list-disc pl-5 marker:text-amber-500">
                      {j.ecarts.map((e, k) => <li key={k}><Riche texte={e} /></li>)}
                    </ul>
                  ) : <p className="text-sm text-slate-500">Aucun : conforme à la demande.</p>}
                </div>
              </div>
              {j.pages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {j.pages.map((id) => (
                    <a key={id} href={`#${id}`} className="inline-flex items-center rounded-full bg-emerald-50 text-suguba-profond text-xs font-bold px-3 min-h-[32px]">
                      {numeros[id] ? `${numeros[id]} · ` : ''}{titres[id] || id} →
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>

        <section id="communs" className="scroll-mt-28 pt-12 grid gap-4 md:grid-cols-3">
          {guide.communs.map((b) => <Bloc key={b.titre} bloc={b} />)}
        </section>

        <section id="parcours" className="scroll-mt-28 pt-12 space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Les parcours principaux</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {guide.parcours.map((p) => (
              <div key={p.titre} className="rounded-3xl bg-white border border-slate-200 p-5">
                <h3 className="text-base font-bold mb-3">{p.titre}</h3>
                <ol className="space-y-1.5">
                  {p.etapes.map((e, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className="font-mono text-xs text-suguba-brand-dark pt-0.5 w-4 shrink-0">{i + 1}</span>
                      {e.page ? (
                        <a href={`#${e.page}`} className="text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-[#09b500]">
                          {e.texte} <span className="text-slate-400">({numeros[e.page]})</span>
                        </a>
                      ) : <span className="text-slate-800">{e.texte}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {guide.roles.map((r) => {
          const pages = guide.pages.filter((p) => p.role === r.cle);
          return (
            <section key={r.cle} id={r.cle} className="scroll-mt-28 pt-14">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 border-slate-900 pb-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{r.titre}</h2>
                <span className="text-sm text-slate-500">{r.acces} · {pages.length} pages</span>
              </div>
              <p className="text-sm text-slate-600 mt-2.5 max-w-3xl">{r.intro}</p>
              {pages.map((p) => <Fiche key={p.id} page={p} numero={numeros[p.id]} numeros={numeros} />)}
            </section>
          );
        })}

        <section id="a-savoir" className="scroll-mt-28 pt-14 pb-10 space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">À savoir</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {guide.aSavoir.map((b) => <Bloc key={b.titre} bloc={b} />)}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
