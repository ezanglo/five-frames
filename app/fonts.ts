import { Fraunces, Plus_Jakarta_Sans } from "next/font/google"

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

/**
 * The font CSS variables for an <html> element. Shared by the root layout and global-error,
 * which replaces the root layout and so must load the brand faces itself.
 */
export const fontVariables = `${jakarta.variable} ${fraunces.variable}`
