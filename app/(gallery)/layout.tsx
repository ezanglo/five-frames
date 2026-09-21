export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-scope flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-12">
        {children}
      </main>
    </div>
  );
}
