import { FakeAi, FakeSellerSprite, MemoryKb } from '@/demo/fake';
import { OpenAIClient } from '@/services/ai';
import { parseAppToken } from '@/services/feishu';
import { FeishuKb, type KnowledgeBase } from '@/services/kb';
import type { Deps } from '@/services/pipeline';
import { SellerSpriteClient } from '@/services/sellersprite';
import type { Settings } from './storage';

/** 飞书没配置时返回 null（诊断照常跑，只是不写知识库） */
export function makeKb(s: Settings, demo: boolean): KnowledgeBase | null {
  if (demo) return new MemoryKb();
  if (!s.feishuAppId || !s.feishuAppSecret || !s.feishuBase) return null;
  return new FeishuKb({ appId: s.feishuAppId, appSecret: s.feishuAppSecret, appToken: parseAppToken(s.feishuBase) });
}

export function makeDeps(s: Settings, demo: boolean, progress: (m: string) => void): Deps {
  return {
    ss: demo ? new FakeSellerSprite() : new SellerSpriteClient(s.sellerspriteKey),
    ai: demo ? new FakeAi() : new OpenAIClient({ apiKey: s.openaiKey, baseUrl: s.openaiBase, model: s.model, vision: s.vision }),
    kb: makeKb(s, demo),
    limits: s.limits,
    weights: s.weights,
    cost: s.cost,
    autoSync: s.autoSync,
    progress,
    now: demo ? new Date(2026, 10, 10).getTime() : undefined,
  };
}
