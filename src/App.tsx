import { useState } from 'react'
import { AppShell, type TabKey } from './components/AppShell'
import { OverviewTab } from './tabs/OverviewTab'
import { NicheTab } from './tabs/NicheTab'
import { BenchmarkTab } from './tabs/BenchmarkTab'
import { AttributeMatrixTab } from './tabs/AttributeMatrixTab'
import { NegativesTab } from './tabs/NegativesTab'
import { GapMatrixTab } from './tabs/GapMatrixTab'
import { UpgradesTab } from './tabs/UpgradesTab'
import { CostPackagingTab } from './tabs/CostPackagingTab'
import { HypothesisTab } from './tabs/HypothesisTab'

export default function App() {
  const [tab, setTab] = useState<TabKey>('overview')

  return (
    <AppShell active={tab} onChange={setTab}>
      {tab === 'overview' && <OverviewTab onNavigate={setTab} />}
      {tab === 'niche' && <NicheTab />}
      {tab === 'benchmark' && <BenchmarkTab />}
      {tab === 'attrs' && <AttributeMatrixTab />}
      {tab === 'negatives' && <NegativesTab />}
      {tab === 'gaps' && <GapMatrixTab />}
      {tab === 'upgrades' && <UpgradesTab />}
      {tab === 'cost' && <CostPackagingTab />}
      {tab === 'hypo' && <HypothesisTab />}
    </AppShell>
  )
}
