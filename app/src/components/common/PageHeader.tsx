import { ReactNode } from "react";
import { Column, Heading, Row, Text } from "@once-ui-system/core";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Row fillWidth horizontal="between" vertical="center" gap="16" wrap>
      <Column gap="4">
        <Heading variant="heading-strong-l">{title}</Heading>
        {description ? (
          <Text variant="body-default-m" onBackground="neutral-weak">
            {description}
          </Text>
        ) : null}
      </Column>
      {actions ? <Row gap="8">{actions}</Row> : null}
    </Row>
  );
}
