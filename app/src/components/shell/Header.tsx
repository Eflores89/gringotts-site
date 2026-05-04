"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Target,
  TrendingUp,
  PieChart,
  Tags,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/spending", label: "Spending", Icon: Receipt },
  { href: "/spending/import", label: "Import", Icon: Upload },
  { href: "/budget", label: "Budget", Icon: Target },
  { href: "/investments", label: "Investments", Icon: TrendingUp },
  { href: "/allocations", label: "Allocations", Icon: PieChart },
  { href: "/categories", label: "Categories", Icon: Tags },
  { href: "/rules", label: "Rules", Icon: Sparkles },
  { href: "/auxiliary", label: "Auxiliary", Icon: Settings },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { collapsed, toggle } = useSidebar();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        {/* Show-sidebar — desktop only, visible when sidebar is collapsed */}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Show sidebar"
            className="hidden lg:inline-flex"
          >
            <PanelLeftOpen className="size-5" />
          </Button>
        )}
        {/* Hamburger — visible on mobile only */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle className="text-base font-semibold tracking-tight">
                Gringotts
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-0.5 p-3">
              {NAV.map(({ href, label, Icon }) => {
                const active =
                  pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="mt-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="size-4" />
                <span>Logout</span>
              </button>
            </nav>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-medium text-muted-foreground">
          Gringotts
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={onLogout} className="hidden gap-2 lg:flex">
        <LogOut className="size-4" />
        <span>Logout</span>
      </Button>
    </header>
  );
}
