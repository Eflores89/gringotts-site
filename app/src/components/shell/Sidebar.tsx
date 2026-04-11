"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Upload,
  Target,
  TrendingUp,
  PieChart,
  Tags,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/spending", label: "Spending", Icon: Receipt },
  { href: "/spending/import", label: "Import", Icon: Upload },
  { href: "/budget", label: "Budget", Icon: Target },
  { href: "/investments", label: "Investments", Icon: TrendingUp },
  { href: "/allocations", label: "Allocations", Icon: PieChart },
  { href: "/categories", label: "Categories", Icon: Tags },
  { href: "/rules", label: "Rules", Icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          Gringotts
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {NAV.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary/15 text-sidebar-primary"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
