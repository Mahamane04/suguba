/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
    ] }, { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }];
  },
  // Guide des parcours (page cachée /admin/guide) : lu sur disque à
  // l'exécution, hors de /public — Vercel doit l'embarquer explicitement.
  outputFileTracingIncludes: {
    '/admin/guide': ['./docs/guide/guide.json'],
    '/api/admin/guide/capture/[id]': ['./docs/guide/captures/**/*'],
  },
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL ? [{
      protocol: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).protocol.replace(':', ''),
      hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
      port: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).port,
      pathname: '/storage/v1/object/public/product-images/**',
    }] : [],
  },
};

module.exports = nextConfig;
