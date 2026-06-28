import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const r = await c.execute(`
  SELECT co.name AS company, j.name AS jurisdiction,
         o.percentage, o.effective_from, o.effective_to,
         CASE WHEN o.owner_company_id IS NULL THEN 'you' ELSE 'company' END AS owner,
         CASE WHEN o.percentage > 50 THEN 'controlling' ELSE 'minority' END AS control
  FROM ownership o
  JOIN companies co ON co.id = o.owned_company_id
  LEFT JOIN jurisdictions j ON j.id = co.jurisdiction_id
  ORDER BY co.name`);
console.table(r.rows);
process.exit(0);
