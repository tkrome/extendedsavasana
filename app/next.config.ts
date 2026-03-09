import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],

  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js requires unsafe-inline for its inline scripts in production
      "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
      // YouTube thumbnails
      "img-src 'self' data: https://i.ytimg.com https://i9.ytimg.com https://img.youtube.com",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "media-src 'none'",
      "object-src 'none'",
      "worker-src 'none'",
      "child-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
};

export default nextConfig;
