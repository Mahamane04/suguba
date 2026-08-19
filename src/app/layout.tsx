import type { Metadata, Viewport } from 'next';
import './globals.css';
import OfflineStatus from '@/components/common/OfflineStatus';
import PwaInstallPrompt from '@/components/common/PwaInstallPrompt';
import ServiceWorkerRegister from '@/components/common/ServiceWorkerRegister';
import WhatsAppFloatingButton from '@/components/common/WhatsAppFloatingButton';

export const metadata: Metadata = {
  title: 'SUGUBA — Vendez Sans Stock au Mali | Social Commerce & Commissions Mobile Money',
  description: 'Plateforme B2B2C Mobile-First au Mali : connectez-vous avec les grossistes, partagez les produits sur WhatsApp, gagnez des commissions garanties et retirez par Orange Money ou Wave.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full bg-slate-50">
      <body className="h-full flex flex-col antialiased text-slate-900 selection:bg-emerald-500 selection:text-white">
        <ServiceWorkerRegister />
        <OfflineStatus />
        <PwaInstallPrompt />
        {children}
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}
