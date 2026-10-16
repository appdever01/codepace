import type { Metadata } from "next";
import "./globals.css";
import "./immersive.css";
import "./workspace.css";
import "./coding.css";
import "./results.css";
import "./room-setup.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://codepace.vercel.app"),
  title: "CodePace | Code typing practice",
  description:
    "Practice typing code with snippets, LeetCode solutions and your own code in seven languages. Track speed and accuracy, practice text or race with friends.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CodePace | Code typing practice",
    description:
      "Practice typing code with snippets, LeetCode solutions and your own code in seven languages.",
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
    title: "CodePace | Code typing practice",
    description: "Practice typing code in seven languages.",
    images: ["/og-codepace.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          as="font"
          href="/fonts/AspektaVF.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
