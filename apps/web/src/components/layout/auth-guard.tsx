"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/userStore";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useUserStore((s) => s.currentUser);
  const [hydrated, setHydrated] = useState(false);

  // 等待 zustand persist 从 localStorage 恢复完成
  useEffect(() => {
    // zustand persist 的 rehydration 完成后触发
    const unsub = useUserStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // 如果已经 hydrated（SSR 或同步恢复），直接标记
    if (useUserStore.persist.hasHydrated()) {
      setHydrated(true);
    }

    return unsub;
  }, []);

  useEffect(() => {
    if (hydrated && !currentUser) {
      router.replace("/login");
    }
  }, [hydrated, currentUser, router]);

  // 还没从 localStorage 恢复，显示加载态
  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">加载中…</div>
      </div>
    );
  }

  // 已恢复但未登录，显示跳转态
  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">正在跳转…</div>
      </div>
    );
  }

  return <>{children}</>;
}
