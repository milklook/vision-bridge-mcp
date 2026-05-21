import { config } from "./config.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Message {
  role: string;
  content: Array<{
    type: string;
    text?: string;
    image_url?: { url: string };
  }>;
}

export class VisionClient {
  private apiBase: string;
  private modelId: string;
  private timeout: number;
  private maxRetries: number;
  private headers: Record<string, string>;

  constructor() {
    this.apiBase = config.modelscopeApiBase.replace(/\/+$/, "");
    this.modelId = config.modelscopeModelId;
    this.timeout = config.apiTimeout * 1000;
    this.maxRetries = config.apiMaxRetries;
    this.headers = {
      Authorization: `Bearer ${config.modelscopeApiToken}`,
      "Content-Type": "application/json",
    };
  }

  async describe(
    base64Str: string,
    prompt: string,
    mimeType: string
  ): Promise<string> {
    const dataUri = `data:${mimeType};base64,${base64Str}`;
    const messages: Message[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ];
    return this.requestWithRetry(messages);
  }

  private async requestWithRetry(messages: Message[]): Promise<string> {
    const url = `${this.apiBase}/chat/completions`;
    const payload = {
      model: this.modelId,
      messages,
      max_tokens: 2000,
    };

    let lastError = "";
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!resp.ok) {
          const body = await resp.text().catch(() => "");
          lastError = `HTTP ${resp.status}: ${body.slice(0, 200)}`;
          if ([429, 502, 503, 504].includes(resp.status)) {
            await sleep(Math.pow(2, attempt) * 1000);
            continue;
          }
          throw new Error(lastError);
        }

        const data: any = await resp.json();
        return data.choices?.[0]?.message?.content || "无返回内容";
      } catch (err: any) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          lastError = "请求超时";
        } else if (!lastError) {
          lastError = err.message || String(err);
        }
        if (attempt < this.maxRetries - 1) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(
      `API 调用失败（重试${this.maxRetries}次后）: ${lastError}`
    );
  }
}
