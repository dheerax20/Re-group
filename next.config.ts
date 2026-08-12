import type { NextConfig } from "next";

function r2RemotePattern() {
  if (!process.env.R2_PUBLIC_URL) return [];
  try {
    const { protocol, hostname } = new URL(process.env.R2_PUBLIC_URL);
    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2RemotePattern(),
  },
};

export default nextConfig;
