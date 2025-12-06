/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensures Next.js traces files relative to this project root,
  // avoiding selection of a parent folder due to another lockfile.
  outputFileTracingRoot: process.cwd(),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
