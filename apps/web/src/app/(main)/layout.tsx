import BottomNav from "@/components/layout/bottom-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 safe-bottom">{children}</main>
      <BottomNav />
    </div>
  );
}
