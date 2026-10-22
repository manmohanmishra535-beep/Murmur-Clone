/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is for Docker / production build only.
  // In `next dev` on Windows, standalone tracing conflicts with file caching.
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
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
    // Cloudinary holds uploads; Clerk serves the default avatar for an account.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

module.exports = nextConfig;
