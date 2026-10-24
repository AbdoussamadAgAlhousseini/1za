import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stade du 26 Mars — Gestion des sportifs", template: "%s · Stade du 26 Mars" },
  description: "Gestion des sportifs, des abonnements et de la fréquentation du Stade du 26 Mars.",
  robots: { index: false, follow: false },
  applicationName: "Stade 26 Mars",
  appleWebApp: { capable: true, title: "Stade 26 Mars", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  referrer: "same-origin",
};

export const viewport: Viewport = {
  themeColor: "#0f4a37",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegistration />
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
