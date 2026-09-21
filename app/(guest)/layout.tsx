export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-scope flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-8">{children}</main>
    </div>
  );
}
