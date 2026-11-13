import { parseJson } from '@/core/normalize';
import type { Prompt } from '@/core/prompts';

export interface AiConfig {
  apiKey: string;
  /** OpenAI 或兼容中转，如 https://api.openai.com/v1 */
  baseUrl: string;
  model: string;
  /** 元素拆解时是否附主图识图 */
  vision: boolean;
}

export class AiError extends Error {}

/** 测试和演示用：可以注入假的实现 */
export interface AiApi {
  calls: number;
  tokens: number;
  run(p: Prompt): Promise<unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 只用 Chat Completions + JSON 模式：OpenAI 官方和绝大多数兼容中转都支持 */
export class OpenAIClient implements AiApi {
  calls = 0;
  tokens = 0;
  constructor(private config: AiConfig) {}

  async run(p: Prompt, retries = 2): Promise<unknown> {
    const { apiKey, baseUrl, model, vision } = this.config;
    if (!apiKey) throw new AiError('还没有填写 OpenAI API Key，请先到设置页填写');
    const images = vision ? (p.images ?? []) : [];
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    for (let attempt = 0; ; attempt++) {
      this.calls++;
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: p.system },
              { role: 'user', content: images.length ? [{ type: 'text', text: p.user }, ...images.map((u) => ({ type: 'image_url', image_url: { url: u, detail: 'low' } }))] : p.user },
            ],
            response_format: { type: 'json_object' },
          }),
        });
      } catch {
        if (attempt < retries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        throw new AiError('连不上 AI 接口，请检查网络或接口地址');
      }
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
        this.tokens += data.usage?.total_tokens ?? 0;
        try {
          return parseJson(data.choices?.[0]?.message?.content ?? '');
        } catch (e) {
          if (attempt < retries) continue;
          throw new AiError((e as Error).message);
        }
      }
      const body = await res.text();
      // 中转不支持识图：退回纯文字再试
      if (images.length && res.status === 400 && /image|vision|multimodal|content.*type/i.test(body)) return this.run({ ...p, images: [] }, retries);
      if ((res.status === 429 || res.status >= 500) && !/insufficient_quota/.test(body) && attempt < retries) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw new AiError(describeError(res.status, body, model));
    }
  }
}

function describeError(status: number, body: string, model: string): string {
  if (status === 401) return 'OpenAI API Key 无效，请到设置页检查';
  if (/insufficient_quota/.test(body)) return 'OpenAI 账户余额不足，请充值后重试';
  if (status === 429) return 'AI 请求过于频繁，请稍后重试';
  if (status === 404 || /model_not_found|does not exist/.test(body)) return `模型「${model}」不存在或无权使用，请到设置页更换模型`;
  let msg = body.slice(0, 200);
  try {
    msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? msg;
  } catch {
    /* 非 JSON 错误体 */
  }
  return `AI 接口错误（${status}）：${msg}`;
}

/** 有限并发地跑一组任务，保持结果顺序 */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const chunk = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
