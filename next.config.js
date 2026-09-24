/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Guide des parcours (page cachée /admin/guide) : lu sur disque à
  // l'exécution, hors de /public — Vercel doit l'embarquer explicitement.
  outputFileTracingIncludes: {
    '/admin/guide': ['./docs/guide/guide.json'],
    '/api/admin/guide/capture/[id]': ['./docs/guide/captures/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
