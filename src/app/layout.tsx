import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discipline",
  description: "Kunlik intizom kuzatuvchisi — vazifalar, progress, fokus va pul nazorati.",
  applicationName: "Discipline",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Discipline",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f3d2c" },
    { media: "(prefers-color-scheme: dark)", color: "#0f3d2c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-startup-image" href="/splash-mobile.png" />
        <meta name="apple-mobile-web-app-title" content="Discipline" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',async()=>{try{const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs){if(!(r.active&&r.active.scriptURL.includes('sw.js'))){await r.unregister();}}await navigator.serviceWorker.register('/sw.js?v=6');}catch(e){}});} `,
          }}
        />
      </body>
    </html>
  );
}
