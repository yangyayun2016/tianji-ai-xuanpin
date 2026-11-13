import type { Source, SourceResult } from '@/services/dataSources';
import type { ModuleId, MODULE_NAMES } from './schema';

export type Status = 'ok' | 'missing' | 'unavailable' | 'not_applicable';
export type Value = string | number | boolean | Cell | readonly Value[] | { readonly [key: string]: Value | null };
export interface Cell { value: Value | null; status: Status; note?: string }
export type RawRow = Record<string, Value | Cell | null | undefined>;
export interface ResearchRow { label?: string; cells: Record<string, Cell> }
export interface ResearchSection { id: string; title: string; columns: readonly string[]; rows: ResearchRow[]; summaryHeading?: string; dimensions?: ResearchSection[] }
export interface Market { site: string; categoryName: string; categoryNodeId: string; periodStart: string; periodEnd: string; query: string }
export interface SourceNote { source: Source; status: Status; demo: boolean; notice?: string }
export interface ResearchModule {
  moduleId: ModuleId; moduleName: (typeof MODULE_NAMES)[number]; generatedAt: string; market: Market;
  sourceNotes: Record<'units' | 'revenue' | 'coupon', SourceNote>;
  sections: ResearchSection[]; notes: string[]; inputs?: Record<string, Cell>;
}
export interface Product {
  asin: string; brand?: string; parentAsin?: string; seller?: string; sellerType?: string; fulfillment?: string;
  sellerCountry?: string; rating?: number; ratings?: number; pack?: number; listedAt?: string;
  title?: string; image?: string; category?: string; tags?: Record<string, Value | null>;
  /** 仅有明确类目适用性证据时填写；禁止按缺数推断不适用。 */
  notApplicable?: string[];
  competitor?: RawRow; qa?: RawRow;
}
export interface UnitRecord {
  asin: string; month: string; units: number | null; scope?: 'child' | 'parent'; parentAsin?: string;
  price?: number; priceDate?: string; rank?: number; nodeId?: string; reason?: string;
  tier?: string; parentUnits?: number;
}
export interface RevenueRecord { asin: string; month: string; revenue: number | null; comparisonPrice?: number; verificationUnits?: number; reason?: string }
export interface CouponRecord { asin: string; afterPrice?: number; current?: Value; history?: RawRow }
export interface KeywordRecord { fields: RawRow; /** SIF 返回的购买量；不能从 fields 取购买量。 */ purchases?: number }
export interface TrendWeek { start: string; index: number | null; complete: boolean; label?: string }
export interface Evidence { fields?: RawRow; evidence?: string; notApplicable?: boolean }
/** 进入 mapper 的显式边界；来源在路由层锁定，未验证的响应字段不猜测。 */
export interface ResearchInput {
  market: Market; generatedAt: string; products: Product[];
  units: SourceResult<{ records: UnitRecord[] }>;
  revenue: SourceResult<{ records: RevenueRecord[] }>;
  coupon: SourceResult<{ records: CouponRecord[] }>;
  keywords?: KeywordRecord[];
  trends?: { weeks: TrendWeek[]; regions?: RawRow[]; sourceUrl?: string; collectedAt?: string };
  /** 非销量/销售额/优惠观测；这些表的受保护度量会在 mapper 中重填。 */
  observations?: Partial<Record<string, RawRow[]>>;
  compliance?: Record<string, Evidence>; ip?: Record<string, Evidence>;
  costs?: Record<string, RawRow>; grossMargin?: number;
}
