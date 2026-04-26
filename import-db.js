const fs = require("fs");
const path = require("path");

const sourcePath =
  process.env.SQLITE_IMPORT_SOURCE ||
  path.join(__dirname, "db", "hotel.db");

const targetPath =
  process.env.SQLITE_DB_PATH ||
  process.env.SQLITE_IMPORT_TARGET ||
  path.join(__dirname, "db", "hotel-imported.db");

if (!fs.existsSync(sourcePath)) {
  console.error("❌ Source DB not found:", sourcePath);
  process.exit(1);
}

try {
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`✅ DB copied from ${sourcePath} to ${targetPath}`);
} catch (error) {
  console.error("❌ Failed to copy DB:", error.message);
  process.exit(1);
}
