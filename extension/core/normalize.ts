import { ATTR_DIMS, DEATHS, FIXES, STAGES, type Aspect, type AttrDim, type Classified, type ElementCard, type FormDef } from './types';

export function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    // 模型偶尔在 JSON 前后加说明文字：截取最外层花括号
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('AI 返回的不是有效 JSON');
  }
}

const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const str = (v: unknown) => String(v ?? '').trim();
const strs = (v: unknown, max = 4) =>
  arr(v)
    .map(str)
    .filter((s) => s && s.length <= 40)
    .slice(0, max);

export function normalizeForms(raw: unknown): FormDef[] {
  const seen = new Set<string>();
  return arr(obj(raw).forms)
    .map((f) => ({ name: str(obj(f).name), desc: str(obj(f).desc) }))
    .filter((f) => f.name && f.name !== '配件' && !seen.has(f.name) && seen.add(f.name))
    .slice(0, 8);
}

export function normalizeClassified(raw: unknown, valid: Set<string>, forms: FormDef[]): Record<string, Classified> {
  const names = new Set(forms.map((f) => f.name));
  const out: Record<string, Classified> = {};
  for (const it of arr(obj(raw).items)) {
    const o = obj(it);
    const asin = str(o.asin);
    if (!valid.has(asin)) continue;
    const form = str(o.form);
    out[asin] = { asin, accessory: o.accessory === true || form === '配件', form: names.has(form) ? form : '其他' };
  }
  return out;
}

export function normalizeMapping(raw: unknown): Partial<Record<AttrDim, Record<string, string>>> {
  const m = obj(obj(raw).mapping);
  const out: Partial<Record<AttrDim, Record<string, string>>> = {};
  for (const d of ATTR_DIMS) {
    const pairs = Object.entries(obj(m[d])).filter(([k, v]) => k && str(v) && k !== str(v));
    if (pairs.length) out[d] = Object.fromEntries(pairs.map(([k, v]) => [k, str(v)]));
  }
  return out;
}

export function normalizeElement(raw: unknown, asin: string): ElementCard {
  const o = obj(raw);
  return {
    asin,
    realPitch: str(o.realPitch).slice(0, 80),
    demand: strs(o.demand),
    scene: strs(o.scene),
    persona: strs(o.persona),
    structure: strs(o.structure),
    visual: strs(o.visual),
    priceSpec: strs(o.priceSpec),
    transferable: strs(o.transferable, 5),
    playbook: str(o.playbook).slice(0, 12),
  };
}

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => ((list as readonly string[]).includes(str(v)) ? (str(v) as T) : fallback);

export function normalizeAspects(raw: unknown): Aspect[] {
  const seen = new Set<string>();
  return arr(obj(raw).aspects)
    .map((a) => {
      const o = obj(a);
      const id = str(o.id)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 24);
      return {
        id,
        name: str(o.name).slice(0, 12),
        desc: str(o.desc).slice(0, 60),
        death: pick(o.death, DEATHS, '其他'),
        fix: pick(o.fix, FIXES, '低成本结构件'),
        stage: pick(o.stage, STAGES, '日常使用'),
      };
    })
    .filter((a) => a.id && a.name && !seen.has(a.id) && seen.add(a.id))
    .slice(0, 16);
}
