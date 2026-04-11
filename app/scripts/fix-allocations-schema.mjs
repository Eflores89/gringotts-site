import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log("Dropping old allocations table...");
await client.execute("DROP TABLE IF EXISTS allocation_investments");
await client.execute("DROP TABLE IF EXISTS allocations");

console.log("Recreating allocations...");
await client.execute(`
  CREATE TABLE allocations (
    id text PRIMARY KEY NOT NULL,
    notion_id text,
    name text,
    allocation_type text,
    category text,
    percentage real,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )
`);
await client.execute(
  "CREATE UNIQUE INDEX allocations_notion_id_unique ON allocations (notion_id)",
);

console.log("Creating allocation_investments junction...");
await client.execute(`
  CREATE TABLE allocation_investments (
    allocation_id text NOT NULL,
    investment_id text NOT NULL,
    PRIMARY KEY(allocation_id, investment_id),
    FOREIGN KEY (allocation_id) REFERENCES allocations(id) ON DELETE cascade,
    FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE cascade
  )
`);
await client.execute(
  "CREATE INDEX alloc_inv_allocation_idx ON allocation_investments (allocation_id)",
);
await client.execute(
  "CREATE INDEX alloc_inv_investment_idx ON allocation_investments (investment_id)",
);

console.log("Done.");
process.exit(0);
