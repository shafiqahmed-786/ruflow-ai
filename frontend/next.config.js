// frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Required for Docker standalone deployment (frontend/Dockerfile stage 3)
  output: "standalone",

  // Server-side proxy: requests to /api/v1/* are forwarded to the backend.
  // BACKEND_URL is a server-side env var (not NEXT_PUBLIC_) set at runtime.
  // In Docker: set via docker-compose environment (uses internal network).
  // On Vercel: not needed — frontend calls NEXT_PUBLIC_API_URL directly.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) return [];
    return [
      {
        source:      "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },

  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
