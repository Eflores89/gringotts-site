import { Card, Column, Heading, Text } from "@once-ui-system/core";

export default function DashboardPage() {
  return (
    <Column gap="20" fillWidth>
      <Heading variant="heading-strong-l">Dashboard</Heading>
      <Card padding="l" radius="l" border="neutral-medium" background="surface">
        <Column gap="8">
          <Heading variant="heading-strong-s">Coming soon</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Charts and month totals will land here once the repos layer and
            categories CRUD are in place. For now this page just verifies the
            app shell renders.
          </Text>
        </Column>
      </Card>
    </Column>
  );
}
