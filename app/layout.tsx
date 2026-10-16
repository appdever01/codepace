import type { Metadata } from "next";
import "./globals.css";
import "./immersive.css";
import "./workspace.css";
import "./coding.css";
import "./results.css";

export const metadata: Metadata = {
  title: "Keylane | Code typing practice",
  description:
    "Practice typing code with snippets, LeetCode solutions and your own code in seven languages. Track speed and accuracy, practice text or race with friends.",
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
