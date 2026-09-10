import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import OfflineStatus from '@/components/common/OfflineStatus';
import PwaInstallPrompt from '@/components/common/PwaInstallPrompt';
import ServiceWorkerRegister from '@/components/common/ServiceWorkerRegister';
import WhatsAppFloatingButton from '@/components/common/WhatsAppFloatingButton';
import PushNotificationManager from '@/components/common/PushNotificationManager';
import CloudSyncInitializer from '@/components/common/CloudSyncInitializer';
import AuthHashCatcher from '@/components/common/AuthHashCatcher';

/* ── Inter Variable Font — Police officielle Suguba V1.3 ── */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  // Sans URL de base, les images d'aperçu (Open Graph) des pages boutique
  // seraient relatives, et WhatsApp comme Facebook les ignoreraient.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.sugubaml.com'),
  title: 'SUGUBA — Vendez Sans Stock au Mali | Social Commerce & Commissions Mobile Money',
  description: 'Plateforme B2B2C Mobile-First au Mali : connectez-vous avec les grossistes, partagez les produits sur WhatsApp, gagnez des commissions garanties et retirez par Orange Money, Moov ou Mobi Cash.',
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
  themeColor: '#09b500',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`h-full ${inter.variable}`}>
      <body className="h-full flex flex-col antialiased font-sans selection:bg-suguba-brand selection:text-white">
        <AuthHashCatcher />
        <CloudSyncInitializer />
        <ServiceWorkerRegister />
        <OfflineStatus />
        <PwaInstallPrompt />
        <PushNotificationManager />
        {children}
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}
