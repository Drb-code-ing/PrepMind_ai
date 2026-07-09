export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pm-anime-bg flex h-[100dvh] flex-1 overflow-hidden px-4 py-[clamp(0.75rem,2.2dvh,1.5rem)] text-[var(--pm-ink)]">
      {children}
    </div>
  );
}
