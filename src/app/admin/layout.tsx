import PosteAdmin from '@/components/admin/PosteAdmin';

/** Toutes les pages /admin dans le poste de travail de l'équipe (A1, 2026-09-27). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PosteAdmin>{children}</PosteAdmin>;
}
