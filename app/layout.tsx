import type { Metadata, Viewport } from "next"
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/** font/brand — every UI, form, body, label, button and number (DS02). */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-brand",
  display: "swap",
})

/** font/heading — screen titles, event names and big moments only; never buttons, forms or numbers (DS02). */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-heading-face",
  display: "swap",
})

export const metadata: Metadata = {
  title: "FiveFrames",
  description: "Every guest. Five frames. One shared story.",
}

/** viewport-fit=cover lets the photo header run under the phone's status bar (DS04 top bars). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141414",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", jakarta.variable, fraunces.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
