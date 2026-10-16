import { createSiteMetadata } from "@/lib/seo";
import "./globals.css";
import "./immersive.css";
import "./workspace.css";
import "./coding.css";
import "./results.css";
import "./room-setup.css";

export const metadata = createSiteMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="describedby" href="/llms.txt" type="text/plain" />
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
