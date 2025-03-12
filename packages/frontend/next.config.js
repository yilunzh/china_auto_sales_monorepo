/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable ESLint during builds
  eslint: {
    // Warning: This ignores all ESLint errors during build
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // This lets the module resolution work correctly
    config.resolve.extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    return config;
  },
};

module.exports = nextConfig; 