/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'media.discordapp.net' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Anti clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Empêche la détection du type MIME
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer minimal
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Protection XSS (legacy mais utile)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Permissions Policy restrictif
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Force HTTPS en prod (1 an + sous-domaines)
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
  // Désactiver le header "x-powered-by"
  poweredByHeader: false,
};

module.exports = nextConfig;
