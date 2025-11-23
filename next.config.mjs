/** @type {import('next').NextConfig} */
const nextConfig = {
  // This tells Webpack to ignore these packages and use the actual Node.js folders
  serverExternalPackages: [
    'editly', 
    'canvas', 
    'gl', 
    'xi-name-interface', 
    'ffmpeg-static',
    'yt-dlp-exec'
  ],
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;