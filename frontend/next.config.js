// frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Required for Docker standalone deployment (frontend/Dockerfile stage 3)
  output: "standalone",

  async rewrites() {
    return [
      {
        source:      "/api/v1/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:8080"}/api/v1/:path*`,
      },
    ];
  },

  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
