import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = process.env.PREDICTION_CONFIG_OUTPUT
  ? resolve(process.env.PREDICTION_CONFIG_OUTPUT)
  : resolve(import.meta.dirname, "../src/data/predictions/config.json");
const apiBase = normalizeApiBase(process.env.PREDICTION_API_BASE ?? "");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ apiBase }, null, 2)}\n`);

console.log(apiBase ? `Prediction API configured: ${apiBase}` : "Prediction API disabled.");

function normalizeApiBase(value) {
  const cleaned = String(value).trim().replace(/\/+$/, "");
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}
