"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/userStore";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useUserStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser) {
      router.replace("/login");
    }
  }, [currentUser, router]);

  // 未登录时不渲染页面内容，避免闪烁
  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">正在跳转…</div>
      </div>
    );
  }

  return <>{children}</>;
}
