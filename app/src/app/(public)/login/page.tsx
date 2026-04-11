"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  Column,
  Heading,
  PasswordInput,
  Text,
} from "@once-ui-system/core";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Login failed" }));
        setError(data.error ?? "Login failed");
        return;
      }
      const from = search.get("from") ?? "/dashboard";
      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Column fillWidth fillHeight horizontal="center" vertical="center" padding="l">
      <Card
        maxWidth={24}
        padding="l"
        radius="l"
        border="neutral-medium"
        background="surface"
      >
        <Column gap="16" fillWidth>
          <Column gap="4">
            <Heading variant="heading-strong-l">Gringotts</Heading>
            <Text variant="body-default-s" onBackground="neutral-weak">
              Enter the dashboard password.
            </Text>
          </Column>
          <form onSubmit={onSubmit}>
            <Column gap="16">
              <PasswordInput
                id="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {error ? (
                <Text variant="body-default-s" onBackground="danger-medium">
                  {error}
                </Text>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="m"
                loading={submitting}
                disabled={!password}
                fillWidth
              >
                Sign in
              </Button>
            </Column>
          </form>
        </Column>
      </Card>
    </Column>
  );
}
