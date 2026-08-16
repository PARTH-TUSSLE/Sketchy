import type { Metadata } from "next";
import { Onest, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sketchy — a whiteboard you can all draw on",
  description:
    "Sketchy is a real-time collaborative whiteboard. Every stroke lands on every screen, the second it lands on yours.",
  openGraph: {
    title: "Sketchy — a whiteboard you can all draw on",
    description:
      "A real-time collaborative whiteboard. Every stroke lands on every screen, instantly.",
    type: "website",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@400..700&family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Playfair+Display:wght@400..800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme');
                  var isDark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${onest.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}