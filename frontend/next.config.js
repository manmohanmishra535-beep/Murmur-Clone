/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This folder has its own lockfile; without this Next walks up to a parent
  // lockfile and traces the wrong workspace root.
  outputFileTracingRoot: __dirname,
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
