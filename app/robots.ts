import type { MetadataRoute } from "next";

const SITE_URL = "https://fortunefor.me";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/forgot-password", "/terms"],
        disallow: ["/api/", "/account", "/admin", "/reset-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
