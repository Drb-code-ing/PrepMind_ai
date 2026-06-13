export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pm-anime-bg flex min-h-[100dvh] flex-1 flex-col px-4 py-6 text-[var(--pm-ink)] sm:justify-center sm:py-10">
      {children}
    </div>
  );
}
