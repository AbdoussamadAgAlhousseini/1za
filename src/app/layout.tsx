import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stade du 26 Mars — Gestion des sportifs", template: "%s · Stade du 26 Mars" },
  description: "Gestion des sportifs, des abonnements et de la fréquentation du Stade du 26 Mars.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#0f4a37",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-lg !border-line !shadow-raised !font-sans",
              title: "!font-semibold",
            },
          }}
        />
      </body>
    </html>
  );
}
