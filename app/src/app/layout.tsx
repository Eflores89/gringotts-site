import type { Metadata } from "next";
import { Saira } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const saira = Saira({
  subsets: ["latin"],
  variable: "--font-saira",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Gringotts",
  description: "Personal finance tracker",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={saira.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
