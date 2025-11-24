// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    'editly', 
    'canvas', 
    'gl', 
    'xi-name-interface', 
    'ffmpeg-static',
    'yt-dlp-exec',
    'better-sqlite3' // <--- ADD THIS
  ],
  // ... keep your other config
};

export default nextConfig;