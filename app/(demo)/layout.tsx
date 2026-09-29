/**
 * Public pre-purchase demo (product.md §7.1, decision D14). Renders inside the same guest shell
 * as a real event so it feels like FiveFrames immediately, but this route group is entirely
 * client-side — no file here, or anywhere under app/(demo)/, may import from lib/dal, a Supabase
 * client, or anything else that reaches Postgres or Storage.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
