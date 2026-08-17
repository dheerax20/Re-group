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
    remotePatterns: [
      ...r2RemotePattern(),
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/dashboard/events", destination: "/events", permanent: false },
      { source: "/dashboard/sermons", destination: "/sermons", permanent: false },
      { source: "/dashboard/youtube", destination: "/youtube", permanent: false },
      // Legacy dual-sidebar routes → unified dashboard shell
      {
        source: "/builder/:siteId/events",
        destination: "/events?siteId=:siteId",
        permanent: false,
      },
      {
        source: "/builder/:siteId/sermons",
        destination: "/sermons?siteId=:siteId",
        permanent: false,
      },
      {
        source: "/builder/:siteId/youtube",
        destination: "/youtube?siteId=:siteId",
        permanent: false,
      },
      {
        source: "/builder/:siteId/pages",
        destination: "/dashboard/pages?siteId=:siteId",
        permanent: false,
      },
      {
        source: "/builder/:siteId/preview",
        destination: "/dashboard/builder?siteId=:siteId",
        permanent: false,
      },
      {
        source: "/builder/:siteId/brand",
        destination: "/dashboard/builder?siteId=:siteId",
        permanent: false,
      },
      {
        source: "/builder/:siteId/features",
        destination: "/dashboard/builder?siteId=:siteId",
        permanent: false,
      },
      {
        source: "/builder/:siteId/settings",
        destination: "/dashboard?siteId=:siteId",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
