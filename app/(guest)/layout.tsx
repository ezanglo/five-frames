export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-md px-4 py-8">{children}</main>
    </div>
  );
}
