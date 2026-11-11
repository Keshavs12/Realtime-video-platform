import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["172.20.10.5", "backlash-marshland-vocalize.ngrok-free.dev"],
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      {
        source: "/room/:code",
        destination: "/dashboard/room/:code",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:5000/api/:path*" },
      { source: "/socket.io/", destination: "http://localhost:5000/socket.io/" },
    ];
  },
};

export default nextConfig;
