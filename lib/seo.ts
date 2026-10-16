import { ROOM_CAPACITY } from "./room-limits.ts";
import type { Metadata } from "next";

export const siteUrl = "https://codepace.vercel.app";
export const siteTitle = "Free Code Typing Practice & Speed Test | CodePace";
export const siteDescription =
  "Practice typing code in Python, JavaScript, TypeScript, Java, C++, Go and Rust. Track speed and accuracy with snippets, LeetCode solutions or your own code.";

export function createSiteMetadata(
  deploymentEnvironment = process.env.VERCEL_ENV,
): Metadata {
  const indexable =
    !deploymentEnvironment || deploymentEnvironment === "production";

  return {
    metadataBase: new URL(siteUrl),
    applicationName: "CodePace",
    title: { default: siteTitle, template: "%s | CodePace" },
    description: siteDescription,
    alternates: { canonical: "/" },
    robots: {
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      siteName: "CodePace",
      url: "/",
      type: "website",
      images: [
        {
          url: "/og-codepace.png",
          width: 1200,
          height: 630,
          alt: "CodePace. Code typing practice.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      images: [
        {
          url: "/og-codepace.png",
          alt: "CodePace. Code typing practice.",
        },
      ],
    },
    icons: { icon: "/favicon.svg" },
  };
}

export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: "CodePace",
      description: siteDescription,
      inLanguage: "en",
    },
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/#webpage`,
      url: `${siteUrl}/`,
      name: siteTitle,
      description: siteDescription,
      inLanguage: "en",
      isPartOf: { "@id": `${siteUrl}/#website` },
      mainEntity: { "@id": `${siteUrl}/#application` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: `${siteUrl}/og-codepace.png`,
        width: 1200,
        height: 630,
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#application`,
      url: `${siteUrl}/`,
      name: "CodePace",
      description: siteDescription,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript and a modern web browser.",
      isAccessibleForFree: true,
      featureList: [
        "Code typing practice in Python, JavaScript, TypeScript, Java, C++, Go and Rust",
        "Snippets, LeetCode solutions and custom code",
        "Typing speed and accuracy tracking",
        "Text practice and timed typing races",
        `Private typing races with up to ${ROOM_CAPACITY} players`,
        "Scheduled multiplayer race starts",
        "Local result history and export",
      ],
    },
  ],
};
