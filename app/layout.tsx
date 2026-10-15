import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keylane — Find your typing rhythm",
  description:
    "Typing races, focused practice and a little progress every day. Race pace bots or create a room with friends.",
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
          as="image"
          href="/game/trophy.webp"
          type="image/webp"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
