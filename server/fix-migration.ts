import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const result = await client.query(
  `DELETE FROM "_prisma_migrations"
   WHERE migration_name = $1
   RETURNING migration_name`,
  ["20260916013057_add_direct_messages_and_streak"]
);

console.log("Migration record deleted:", result.rows);

await client.end();