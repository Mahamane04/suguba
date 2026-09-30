import SugubaLoader from '@/components/ui/SugubaLoader';

export default function ChargementPage({ libelle = 'Ouverture…' }: { libelle?: string }) {
  return (
    <main className="min-h-[70vh] w-full max-w-4xl mx-auto px-4 sm:px-6 py-6" aria-busy="true" aria-label={libelle}>
      <span role="status" className="sr-only">{libelle}</span>
      <div className="mb-6 flex items-center gap-3 text-sm font-semibold text-suguba-profond"><SugubaLoader className="h-9 w-9" />{libelle}</div>
      <div className="animate-pulse space-y-5" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded-full bg-slate-200" />
          <div className="h-7 w-52 rounded-xl bg-slate-200" />
          <div className="h-4 w-72 max-w-full rounded-full bg-slate-100" />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="h-5 w-40 rounded-full bg-slate-200" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-slate-100" />
            <div className="h-20 rounded-2xl bg-slate-100" />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="h-5 w-48 rounded-full bg-slate-200" />
          <div className="h-16 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-11 rounded-2xl bg-slate-200" />
            <div className="h-11 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    </main>
  );
}
