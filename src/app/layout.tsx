import type { Metadata } from "next";
import { Chivo, Space_Grotesk } from "next/font/google";
import "./globals.css";

const chivo = Chivo({
  variable: "--font-chivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Pitchline — UEFA Champions League Live Scores & AI Predictions",
  description:
    "Marcadores en tiempo real, pronósticos algorítmicos Poisson y asistente táctico IA para la UEFA Champions League.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${chivo.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-brand-navy font-body-md text-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
