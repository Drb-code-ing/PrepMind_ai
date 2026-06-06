import AuthGuard from "@/components/layout/auth-guard";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <main className="flex-1 safe-bottom">{children}</main>
    </AuthGuard>
  );
}
