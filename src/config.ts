import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Try loading .env manually (no dotenv dependency needed)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

function tryLoadEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Load .env from package root, then CWD
tryLoadEnv(path.resolve(pkgRoot, ".env"));
tryLoadEnv(path.resolve(process.cwd(), ".env"));

export const config = {
  modelscopeApiToken: process.env.MODELSCOPE_API_TOKEN || "",
  modelscopeModelId: process.env.MODELSCOPE_MODEL_ID || "Qwen/Qwen3.5-27B",
  modelscopeApiBase:
    process.env.MODELSCOPE_API_BASE ||
    "https://api-inference.modelscope.cn/v1",
  imageMaxSizeMB: parseInt(process.env.IMAGE_MAX_SIZE_MB || "10", 10),
  imageMaxDimension: parseInt(
    process.env.IMAGE_MAX_DIMENSION || "2048",
    10
  ),
  apiTimeout: parseInt(process.env.API_TIMEOUT || "60", 10),
  apiMaxRetries: parseInt(process.env.API_MAX_RETRIES || "3", 10),
  supportedFormats: ["jpeg", "png", "gif", "webp", "bmp"],
};
