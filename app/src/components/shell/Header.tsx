"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Gringotts
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
        <LogOut className="size-4" />
        <span>Logout</span>
      </Button>
    </header>
  );
}
