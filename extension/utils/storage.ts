import { browser } from 'wxt/browser';
import { DEFAULT_COST, DEFAULT_WEIGHTS, type CostInputs, type Report, type Weights } from '@/core/types';
import { EMPTY_MCP, type McpConfig } from '@/services/mcp';

/** 插件环境用 chrome.storage.local；普通网页预览时退回 localStorage */
const hasExt = () => {
  try {
    return !!browser?.storage?.local;
  } catch {
    return false;
  }
};

export async function get<T>(key: string): Promise<T | undefined> {
  try {
    if (hasExt()) return (await browser.storage.local.get(key))[key] as T | undefined;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function set(key: string, value: unknown): Promise<void> {
  if (hasExt()) return browser.storage.local.set({ [key]: value });
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

async function remove(key: string): Promise<void> {
  if (hasExt()) return browser.storage.local.remove(key);
  try {
    localStorage.removeItem(key);
  } catch {}
}

export interface Limits {
  /** 类目 TOP 样本数 */
  topN: number;
  /** 对标爆款个数 */
  benchMax: number;
  /** 每个 ASIN 取多少条 1–3 星 / 4–5 星评论 */
  negPerAsin: number;
  posPerAsin: number;
  /** 有效差评少于它只报数、不下结论 */
  minNeg: number;
}

export const DEFAULT_LIMITS: Limits = { topN: 200, benchMax: 6, negPerAsin: 80, posPerAsin: 20, minNeg: 30 };

export interface Settings {
  sellerspriteKey: string;
  seekerMcp: McpConfig;
  sifMcp: McpConfig;
  keepaMcp: McpConfig;
  openaiKey: string;
  openaiBase: string;
  model: string;
  vision: boolean;
  feishuAppId: string;
  feishuAppSecret: string;
  /** 多维表格链接或 app_token */
  feishuBase: string;
  /** 写入知识库时的“更新人” */
  userName: string;
  autoSync: boolean;
  weights: Weights;
  cost: CostInputs;
  limits: Limits;
}

export async function loadSettings(): Promise<Settings> {
  const s = (await get<Partial<Settings>>('pu:settings')) ?? {};
  return {
    sellerspriteKey: s.sellerspriteKey ?? '',
    seekerMcp: { ...EMPTY_MCP, ...s.seekerMcp },
    sifMcp: { ...EMPTY_MCP, ...s.sifMcp },
    keepaMcp: { ...EMPTY_MCP, ...s.keepaMcp },
    openaiKey: s.openaiKey ?? '',
    openaiBase: s.openaiBase ?? 'https://api.openai.com/v1',
    model: s.model ?? 'gpt-4.1-mini',
    vision: s.vision ?? true,
    // 团队配置由使用者在设置页填写，源码不预填任何应用标识或凭据。
    feishuAppId: s.feishuAppId ?? '',
    feishuAppSecret: s.feishuAppSecret ?? '',
    feishuBase: s.feishuBase ?? '',
    userName: s.userName ?? '',
    autoSync: s.autoSync ?? true,
    weights: { ...DEFAULT_WEIGHTS, ...s.weights },
    cost: { ...DEFAULT_COST, ...s.cost },
    limits: { ...DEFAULT_LIMITS, ...s.limits },
  };
}

export const saveSettings = (s: Settings) => set('pu:settings', s);

export interface ReportMeta {
  id: string;
  createdAt: number;
  asin: string;
  title: string;
  market: string;
  stage: Report['stage'];
  hypotheses: number;
}

export async function listReports(): Promise<ReportMeta[]> {
  return (await get<ReportMeta[]>('pu:index')) ?? [];
}

export async function saveReport(r: Report): Promise<void> {
  await set(`pu:report:${r.id}`, r);
  const old = await listReports();
  const meta: ReportMeta = { id: r.id, createdAt: r.createdAt, asin: r.asin, title: r.me.title, market: r.market.myForm, stage: r.stage, hypotheses: r.hypotheses.length };
  const next = [meta, ...old.filter((m) => m.id !== r.id)];
  for (const m of next.slice(30)) await remove(`pu:report:${m.id}`);
  await set('pu:index', next.slice(0, 30));
}

export const loadReport = (id: string) => get<Report>(`pu:report:${id}`);

export async function deleteReport(id: string): Promise<void> {
  await remove(`pu:report:${id}`);
  await set('pu:index', (await listReports()).filter((m) => m.id !== id));
}
