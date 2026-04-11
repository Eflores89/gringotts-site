import type { Metadata } from "next";
import { ThemeInit } from "@once-ui-system/core";
import "@once-ui-system/core/css/styles.css";
import "@once-ui-system/core/css/tokens.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Gringotts",
  description: "Personal finance tracker",
};

const THEME_CONFIG = {
  theme: "dark",
  brand: "violet",
  accent: "cyan",
  neutral: "gray",
  solid: "contrast",
  "solid-style": "flat",
  border: "playful",
  surface: "translucent",
  transition: "all",
  scaling: "100",
  "viz-style": "categorical",
} as const;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={THEME_CONFIG.theme}
      data-brand={THEME_CONFIG.brand}
      data-accent={THEME_CONFIG.accent}
      data-neutral={THEME_CONFIG.neutral}
      data-solid={THEME_CONFIG.solid}
      data-solid-style={THEME_CONFIG["solid-style"]}
      data-border={THEME_CONFIG.border}
      data-surface={THEME_CONFIG.surface}
      data-transition={THEME_CONFIG.transition}
      data-scaling={THEME_CONFIG.scaling}
      data-viz-style={THEME_CONFIG["viz-style"]}
    >
      <head>
        <ThemeInit config={THEME_CONFIG} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
