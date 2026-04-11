import { ReactNode } from "react";
import { Column, Row } from "@once-ui-system/core";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <Row fillWidth style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Column fillWidth style={{ minWidth: 0 }}>
        <Header />
        <Column
          as="main"
          fillWidth
          padding="l"
          gap="20"
          style={{ flex: 1, overflowY: "auto" }}
        >
          {children}
        </Column>
      </Column>
    </Row>
  );
}
