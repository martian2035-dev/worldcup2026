import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = process.env.PREDICTION_CONFIG_OUTPUT
  ? resolve(process.env.PREDICTION_CONFIG_OUTPUT)
  : resolve(import.meta.dirname, "../src/data/predictions/config.json");
const apiBase = normalizeApiBase(process.env.PREDICTION_API_BASE ?? "");
const existing = await readExistingConfig(outputPath);
const nextApiBase = apiBase || existing.apiBase || "";

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ apiBase: nextApiBase }, null, 2)}\n`);

console.log(nextApiBase ? `Prediction API configured: ${nextApiBase}` : "Prediction API disabled.");

function normalizeApiBase(value) {
  const cleaned = String(value).trim().replace(/\/+$/, "");
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

async function readExistingConfig(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}
