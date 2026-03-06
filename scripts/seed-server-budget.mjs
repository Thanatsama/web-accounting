import { readFile } from "node:fs/promises";

const SOURCE_FILE = new URL("../data/budget.json", import.meta.url);

async function main() {
  const raw = await readFile(SOURCE_FILE, "utf-8");
  const payload = JSON.parse(raw);

  const response = await fetch("http://localhost:3000/api/budget", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Seed failed (${response.status}): ${body}`);
  }

  console.log("Seed completed via server API.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
