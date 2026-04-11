"use client";

import { useRouter } from "next/navigation";
import { Button, Row, Heading } from "@once-ui-system/core";

export function Header() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Row
      as="header"
      fillWidth
      horizontal="between"
      vertical="center"
      paddingX="l"
      paddingY="12"
      borderBottom="neutral-medium"
      background="surface"
      style={{ minHeight: 56 }}
    >
      <Heading variant="heading-strong-s">Dashboard</Heading>
      <Button variant="tertiary" size="s" onClick={onLogout}>
        Logout
      </Button>
    </Row>
  );
}
