/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The deployment image carries the traced server instead of the whole
  // node_modules tree: `next build` writes .next/standalone, and the Dockerfile
  // runs that server. `next start` still works from the same build.
  output: "standalone",
  // This folder has its own lockfile; without this Next walks up to a parent
  // lockfile and traces the wrong workspace root.
  outputFileTracingRoot: __dirname,
  // Express does this on the API; the web app should not advertise itself either.
  poweredByHeader: false,
  eslint: {
    // Lint runs as its own script so a build never fails on style alone.
    ignoreDuringBuilds: true,
  },
  images: {
    // Cloudinary is the only remote image host in v1.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

module.exports = nextConfig;
