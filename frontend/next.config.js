// frontend/next.config.js
// Supports two output modes:
//   NEXT_OUTPUT=export  → static HTML export for GitHub Pages
//   (default)           → standalone server for Docker/Railway/Render/Vercel

/** @type {import('next').NextConfig} */

const isStaticExport = process.env.NEXT_OUTPUT === 'export';
const isGitHubPages  = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  reactStrictMode: true,

  // Mode-dependent output
  output: isStaticExport ? 'export' : 'standalone',

  // GitHub Pages serves from /<repo-name>/ — set basePath accordingly
  basePath:  isGitHubPages ? '/ruflow-ai' : '',
  assetPrefix: isGitHubPages ? '/ruflow-ai/' : '',

  // Images must be unoptimized for static export
  images: {
    unoptimized: isStaticExport,
  },

  // Rewrites only work in server mode (not static export)
  async rewrites() {
    if (isStaticExport) return [];
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) return [];
    return [
      {
        source:      '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },

  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
