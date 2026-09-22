/**
 * Public pre-purchase demo (product.md §7.1, decision D14). Reuses the accepted guest visual
 * identity (`.guest-scope`) so it feels like FiveFrames immediately, but this route group is
 * entirely client-side — no file here, or anywhere under app/(demo)/, may import from lib/dal,
 * a Supabase client, or anything else that reaches Postgres or Storage.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-scope flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-8 pb-10">
        {children}
      </main>
    </div>
  );
}
