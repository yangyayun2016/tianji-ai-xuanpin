export function salesDrive(salesShare: number, productShare: number): number {
  if (productShare <= 0) return 0
  return Number((salesShare / productShare).toFixed(2))
}

export function isWhiteSpace(drive: number, productSharePct: number): boolean {
  return drive >= 1.3 && productSharePct <= 25
}

export type ScoreWeights = {
  demandEvidence: number
  competitionPosition: number
  perceivedValue: number
  totalCostImpact: number
  copyBarrier: number
  implRisk: number
  resourceMatch: number
}

export type ScoreDims = {
  demandEvidence: number
  competitionPosition: number
  perceivedValue: number
  totalCostImpact: number
  copyBarrier: number
  implRisk: number
  resourceMatch: number
}

export function weightedScore(dims: ScoreDims, weights: ScoreWeights): number {
  const entries: Array<[keyof ScoreDims, number]> = [
    ['demandEvidence', weights.demandEvidence],
    ['competitionPosition', weights.competitionPosition],
    ['perceivedValue', weights.perceivedValue],
    ['totalCostImpact', weights.totalCostImpact],
    ['copyBarrier', weights.copyBarrier],
    ['implRisk', weights.implRisk],
    ['resourceMatch', weights.resourceMatch],
  ]
  const totalW = entries.reduce((s, [, w]) => s + w, 0)
  if (totalW <= 0) return 0
  const sum = entries.reduce((s, [k, w]) => s + dims[k] * w, 0)
  return Math.round(sum / totalW)
}

export type CostInputs = {
  purchaseCny: number
  packagingCny: number
  firstLegPerKgCny: number
  fx: number
  commissionPct: number
  adPct: number
  returnLossPct: number
  sellPriceUsd: number
  fbaFeeUsd: number
  billableWeightLb: number
}

export type UnitEconomics = {
  landedCostUsd: number
  commissionUsd: number
  adUsd: number
  returnUsd: number
  totalCostUsd: number
  unitProfitUsd: number
  marginPct: number
  missingPurchase: boolean
}

/** 头程按计费重量估算：lb → kg 近似 */
export function calcUnitEconomics(input: CostInputs): UnitEconomics {
  const weightKg = input.billableWeightLb * 0.453592
  const firstLegUsd =
    input.fx > 0 ? (input.firstLegPerKgCny * weightKg) / input.fx : 0
  const purchaseUsd = input.fx > 0 ? input.purchaseCny / input.fx : 0
  const packagingUsd = input.fx > 0 ? input.packagingCny / input.fx : 0
  const landedCostUsd = purchaseUsd + packagingUsd + firstLegUsd
  const commissionUsd = (input.sellPriceUsd * input.commissionPct) / 100
  const adUsd = (input.sellPriceUsd * input.adPct) / 100
  const returnUsd = (input.sellPriceUsd * input.returnLossPct) / 100
  const totalCostUsd =
    landedCostUsd + input.fbaFeeUsd + commissionUsd + adUsd + returnUsd
  const unitProfitUsd = input.sellPriceUsd - totalCostUsd
  const marginPct =
    input.sellPriceUsd > 0
      ? Number(((unitProfitUsd / input.sellPriceUsd) * 100).toFixed(1))
      : 0
  return {
    landedCostUsd: Number(landedCostUsd.toFixed(2)),
    commissionUsd: Number(commissionUsd.toFixed(2)),
    adUsd: Number(adUsd.toFixed(2)),
    returnUsd: Number(returnUsd.toFixed(2)),
    totalCostUsd: Number(totalCostUsd.toFixed(2)),
    unitProfitUsd: Number(unitProfitUsd.toFixed(2)),
    marginPct,
    missingPurchase: !(input.purchaseCny > 0),
  }
}
