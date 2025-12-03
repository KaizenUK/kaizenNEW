#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

// Create timestamp in ISO 8601 format (required by sitemap.xml spec)
const timestamp = new Date().toISOString();

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write timestamp to file
const timestampFile = path.join(publicDir, "build-timestamp.txt");
fs.writeFileSync(timestampFile, timestamp, "utf8");

console.log(`✓ Build timestamp written: ${timestamp}`);
