#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const sqlDir = path.join(root, "sql");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

if (!fs.existsSync(sqlDir) || !fs.statSync(sqlDir).isDirectory()) {
  console.error("Could not find the sql directory. Expected: mobile/sql");
  process.exit(1);
}

const sqlFiles = fs.readdirSync(sqlDir)
  .filter((name) => name.toLowerCase().endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

if (sqlFiles.length === 0) {
  console.error("No .sql files found in mobile/sql.");
  process.exit(1);
}

console.log("Running Supabase migrations from mobile/sql in alphabetical order:");
sqlFiles.forEach((file, index) => console.log(`  ${index + 1}. ${file}`));

for (const file of sqlFiles) {
  const filePath = path.join(sqlDir, file);
  const sql = fs.readFileSync(filePath, "utf8");
  console.log(`\n--- Executing ${file} ---`);

  const command = process.platform === "win32"
    ? "npx.cmd supabase db query --linked"
    : "npx supabase db query --linked";

  const result = spawnSync(command, {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });

  if (result.error) {
    console.error(`\n❌ Failed to execute ${file}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n❌ Migration failed on ${file} with exit code ${result.status}`);
    process.exit(result.status);
  }
}

console.log("\n✅ All SQL migrations executed successfully.");
