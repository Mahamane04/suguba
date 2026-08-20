'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserCheck, UserX, Loader2 } from 'lucide-react';

interface PendingProfile {
  id: string;
  phone: string;
  full_name: string;
  role: string;
  city: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  reseller: 'Revendeur',
  supplier: 'Fournisseur',
  driver: 'Livreur',
  diaspora: 'Diaspora',
};

/**
 * Ferme la boucle ouverte par la demande de validation d'inscription
 * (2026-08-19) : un numéro vérifié par OTP ne suffit plus à activer un
 * compte (voir /api/auth/verify-otp et middleware.ts) — il faut qu'un
 * admin approuve ou rejette ici. Sans ce panneau, les comptes resteraient
 * bloqués en pending_approval indéfiniment, personne ne pouvant les
 * débloquer depuis l'interface.
 */
export default function PendingProfilesPanel() {
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloudActive, setCloudActive] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pending-profiles');
      const json = await res.json();
      setProfiles(json.profiles || []);
      setCloudActive(json.cloud !== false);
    } catch (_) {
      setCloudActive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (profileId: string, decision: 'approve' | 'reject') => {
    setBusyId(profileId);
    try {
      await fetch('/api/admin/review-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, decision }),
      });
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-black text-sm text-slate-900">Comptes en attente de validation</h2>
            <p className="text-[10px] text-slate-500">Numéro vérifié par OTP — dossier à approuver ou rejeter</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
          {profiles.length} en attente
        </span>
      </div>

      {!cloudActive && (
        <p className="text-[11px] text-slate-400">
          Supabase non configuré sur cet environnement — aucun dossier à valider en mode local.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        cloudActive && <p className="text-[11px] text-slate-400 py-2">Aucun dossier en attente pour le moment.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {profiles.map((p) => (
            <div key={p.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-xs text-slate-900 truncate">{p.full_name || 'Sans nom'}</p>
                <p className="text-[10px] text-slate-500">{p.phone} · {ROLE_LABEL[p.role] || p.role}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => review(p.id, 'approve')}
                  disabled={busyId === p.id}
                  className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center"
                  title="Approuver"
                >
                  <UserCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => review(p.id, 'reject')}
                  disabled={busyId === p.id}
                  className="w-8 h-8 rounded-xl bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 flex items-center justify-center"
                  title="Rejeter"
                >
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
