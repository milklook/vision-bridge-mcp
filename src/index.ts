#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

import { config } from "./config.js";
import { VisionClient } from "./vision-client.js";

const DEFAULT_PROMPT = "请详细描述这张图片的内容";
const client = new VisionClient();

// ---------- Image helpers ----------

interface ImageData {
  data: string;
  mime: string;
}

function loadImageFromPath(imagePath: string): ImageData {
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace(".", "") || "jpeg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
  };
  return {
    data: buffer.toString("base64"),
    mime: mimeMap[ext] || "image/jpeg",
  };
}

function parseBase64Input(raw: string): ImageData {
  const match = raw.match(/^data:image\/(\w+);base64,(.+)$/);
  if (match) {
    return {
      data: match[2],
      mime: `image/${match[1].toLowerCase()}`,
    };
  }
  return { data: raw, mime: "image/jpeg" };
}

async function loadImageFromUrl(url: string): Promise<ImageData> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) {
    throw new Error(`下载图片失败: HTTP ${resp.status}`);
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get("content-type") || "image/jpeg";
  return {
    data: buffer.toString("base64"),
    mime: contentType,
  };
}

function readClipboardImage(): ImageData | null {
  try {
    const tempDir = path.join(os.tmpdir(), "vision-bridge-mcp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `clip-${Date.now()}.png`);

    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; if ($([System.Windows.Forms.Clipboard]::ContainsImage())) { $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save('${tempFile.replace(/'/g, "''")}', 'Png'); }`;
    execSync(`powershell -NoProfile -Command "${psCommand}"`, { timeout: 5000 });

    if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
      const buffer = fs.readFileSync(tempFile);
      fs.unlinkSync(tempFile);
      return { data: buffer.toString("base64"), mime: "image/png" };
    }
  } catch {
    // clipboard read failed, return null
  }
  return null;
}

async function validateAndCompress(data: ImageData): Promise<ImageData> {
  const raw = Buffer.from(data.data, "base64");
  const metadata = await sharp(raw).metadata();
  const fmt = metadata.format || "jpeg";

  if (!config.supportedFormats.includes(fmt)) {
    throw new Error(
      `不支持的图片格式: ${fmt}，支持: ${config.supportedFormats.join(", ")}`
    );
  }

  const sizeMB = raw.length / (1024 * 1024);
  const maxDim = Math.max(metadata.width || 0, metadata.height || 0);

  if (sizeMB <= config.imageMaxSizeMB && maxDim <= config.imageMaxDimension) {
    return data;
  }

  // Resize if dimension exceeds limit
  const buf = raw;
  let processed: Buffer = buf;
  if (maxDim > config.imageMaxDimension) {
    processed = (await sharp(processed)
      .resize(config.imageMaxDimension, config.imageMaxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer()) as unknown as Buffer;
  }

  // Compress if size still exceeds limit
  if (processed.length / (1024 * 1024) > config.imageMaxSizeMB) {
    processed = (await sharp(processed)
      .jpeg({ quality: 85 })
      .toBuffer()) as unknown as Buffer;
  }
  if (processed.length / (1024 * 1024) > config.imageMaxSizeMB) {
    processed = (await sharp(processed)
      .jpeg({ quality: 60 })
      .toBuffer()) as unknown as Buffer;
  }

  return { data: processed.toString("base64"), mime: "image/jpeg" };
}

// ---------- MCP Server ----------

const server = new McpServer({
  name: "vision-bridge",
  version: "1.1.0",
});

server.tool(
  "describe_image",
  "通过多模态大模型识别和描述图片内容。支持本地图片路径、URL、base64编码，以及剪贴板图片。适用于：错误截图分析、UI界面描述、图片内容识别、验证码识别等。",
  {
    image_path: z
      .string()
      .optional()
      .describe("本地图片的绝对路径，例如 D:\\images\\screenshot.png"),
    image_url: z
      .string()
      .optional()
      .describe("图片的 URL 地址，例如 https://example.com/image.png"),
    image_base64: z
      .string()
      .optional()
      .describe("图片的 base64 编码字符串，可带或不带 data:image/xxx;base64, 前缀"),
    prompt: z
      .string()
      .optional()
      .describe("自定义识别指令，如'图中有什么报错信息？'、'描述这个界面的布局'"),
  },
  async ({ image_path, image_url, image_base64, prompt }) => {
    try {
      // 1. Load image from one of the sources
      let img: ImageData | null = null;

      if (image_path) {
        if (!fs.existsSync(image_path)) {
          return {
            content: [
              { type: "text", text: `错误: 文件不存在: ${image_path}` },
            ],
          };
        }
        img = loadImageFromPath(image_path);
      } else if (image_url) {
        img = await loadImageFromUrl(image_url);
      } else if (image_base64) {
        img = parseBase64Input(image_base64);
      } else {
        // No explicit source: try clipboard
        const clipImg = readClipboardImage();
        if (clipImg) {
          img = clipImg;
        } else {
          return {
            content: [
              {
                type: "text",
                text: "错误: 请提供 image_path、image_url 或 image_base64 参数；或将图片复制到剪贴板后重试。",
              },
            ],
          };
        }
      }

      // 2. Validate & compress
      img = await validateAndCompress(img);

      // 3. Call ModelScope API
      const result = await client.describe(
        img.data,
        prompt || DEFAULT_PROMPT,
        img.mime
      );

      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `图片识别失败: ${error.message || String(error)}`,
          },
        ],
      };
    }
  }
);

// ---------- Startup ----------

async function main() {
  if (!config.modelscopeApiToken) {
    console.error("错误: 未配置 MODELSCOPE_API_TOKEN");
    console.error(
      "请设置环境变量 MODELSCOPE_API_TOKEN，或在项目目录下创建 .env 文件"
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `vision-bridge MCP 服务已启动（ModelScope: ${config.modelscopeModelId}），等待指令...`
  );
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
