"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Column, Heading, Text } from "@once-ui-system/core";
import {
  HiChartPie,
  HiReceiptRefund,
  HiArrowUpTray,
  HiFlag,
  HiArrowTrendingUp,
  HiCurrencyDollar,
  HiTag,
  HiSparkles,
} from "react-icons/hi2";
import type { ComponentType } from "react";
import styles from "./Sidebar.module.css";

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: HiChartPie },
  { href: "/spending", label: "Spending", Icon: HiReceiptRefund },
  { href: "/spending/import", label: "Import", Icon: HiArrowUpTray },
  { href: "/budget", label: "Budget", Icon: HiFlag },
  { href: "/investments", label: "Investments", Icon: HiArrowTrendingUp },
  { href: "/allocations", label: "Allocations", Icon: HiCurrencyDollar },
  { href: "/categories", label: "Categories", Icon: HiTag },
  { href: "/rules", label: "Rules", Icon: HiSparkles },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <Column
      as="nav"
      padding="16"
      gap="16"
      borderRight="neutral-medium"
      background="surface"
      style={{
        width: 220,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <Heading variant="heading-strong-m" paddingX="8" paddingTop="4">
        Gringotts
      </Heading>
      <Column gap="2">
        {NAV.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.item} ${active ? styles.active : ""}`}
            >
              <Icon size={18} />
              <Text variant="body-default-s">{label}</Text>
            </Link>
          );
        })}
      </Column>
    </Column>
  );
}
