import "dotenv/config";
import { ensureSeed, resetDemoData } from "@/lib/seed";
import { pool } from "@/db";

async function main() {
  if (process.argv.includes("--reset")) {
    await resetDemoData();
    console.log("Demo data reset and re-seeded.");
  } else {
    await ensureSeed();
    console.log("Seed check complete.");
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
