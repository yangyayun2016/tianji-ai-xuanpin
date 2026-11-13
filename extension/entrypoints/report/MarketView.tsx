import { useState } from 'react';
import type { Product, Report } from '@/core/types';

type Edit = { form?: string; toggleAccessory?: string; include?: string; exclude?: string };

export function ProductCell({ p, mine }: { p: Product; mine?: boolean }) {
  return (
    <div className="pcell">
      {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="noimg" />}
      <div>
        <a href={`https://www.amazon.com/dp/${p.asin}`} target="_blank" rel="noreferrer">
          {p.asin}
        </a>
        {mine && <span className="tag warn" style={{ marginLeft: 6 }}>我的产品</span>}
        <div className="small clamp">{p.title}</div>
      </div>
    </div>
  );
}

/** ① 切市场：展示形态分组、质检、价格区间，让人确认“我真正所在的细分市场”后再继续 */
export function MarketView({ report: r, onEdit, onContinue, readOnly }: { report: Report; onEdit: (e: Edit) => void; onContinue?: () => void; readOnly?: boolean }) {
  const [showOthers, setShowOthers] = useState(false);
  const m = r.market;
  const inMarket = r.top.filter((p) => m.asins.includes(p.asin));
  const others = r.top.filter((p) => !m.asins.includes(p.asin)).slice(0, 60);
  const myBand = m.bands.find((b) => b.mine);
  return (
    <>
      {!readOnly && (
        <div className="card confirm">
          <div>
            <h3>① 先确认：你的产品真正在跟谁比？</h3>
            <p className="small" style={{ margin: 0 }}>
              平台类目按“卖什么”归类，不按“怎么用”归类。AI 已从 {m.fetched} 个商品里去重 {m.duplicates.length} 条、剔除配件 {m.accessories.length} 个，并按形态分组。
              你的产品被归到「{m.myForm}」（{m.asins.length} 个产品）。如果分错了，可以换形态组或增删产品，确认后再继续。
            </p>
          </div>
          <button className="btn primary" onClick={onContinue}>
            确认细分市场，继续诊断 →
          </button>
        </div>
      )}

      <div className="card">
        <h3>形态分组与质检</h3>
        <p className="small">
          类目：{m.nodeLabelPath || m.nodeIdPath}。质检三条（AI+MCP 选品实战）：组内价格要收敛、没有一组吞掉一半以上样本、每组至少 30 个；不过关的比率只能定性看。
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>形态</th>
              <th className="num">产品数</th>
              <th className="num">月销占比</th>
              <th className="num">均价</th>
              <th>价格范围</th>
              <th>质检</th>
              <th>定义</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {m.groups.map((g) => (
              <tr key={g.form} className={g.form === m.myForm ? 'mine' : ''}>
                <td>
                  <b>{g.form}</b>
                </td>
                <td className="num">{g.count}</td>
                <td className="num">{g.unitsShare}%</td>
                <td className="num">${g.avgPrice}</td>
                <td>
                  ${g.minPrice}–{g.maxPrice}
                </td>
                <td>
                  <span className={`tag ${g.qa.priceConverged ? 'good' : 'bad'}`}>价格{g.qa.priceConverged ? '收敛' : '发散'}</span> <span className={`tag ${g.qa.notDominant ? 'good' : 'warn'}`}>{g.qa.notDominant ? '占比正常' : '吞掉过半'}</span>{' '}
                  <span className={`tag ${g.qa.enoughSample ? 'good' : 'warn'}`}>{g.qa.enoughSample ? '样本够' : '样本<30'}</span>
                </td>
                <td className="small">{m.forms.find((f) => f.name === g.form)?.desc}</td>
                {!readOnly && <td>{g.form !== m.myForm && <button className="btn sm" onClick={() => onEdit({ form: g.form })}>设为我的市场</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>价格区间（{m.bandWidth} 美元一档）</h3>
        <p className="small">
          单均市占对比基准 {m.baseShare}%（= 100% ÷ 样本数）；区间垄断度 = 区间前 3 名销量占比；销量占比明显高于评论占比 = 近期热销新品，反之 = 老品盘踞（竞卖调研篇）。
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>区间</th>
              <th className="num">产品数</th>
              <th className="num">销量占比</th>
              <th className="num">单均市占</th>
              <th className="num">区间垄断度</th>
              <th className="num">评论占比</th>
              <th>信号</th>
            </tr>
          </thead>
          <tbody>
            {m.bands.map((b) => (
              <tr key={b.from} className={b.mine ? 'mine' : ''}>
                <td>
                  ${b.from}–{b.to} {b.mine && <span className="tag warn">我在这</span>}
                </td>
                <td className="num">{b.count}</td>
                <td className="num">
                  <Bar v={b.unitsShare} /> {b.unitsShare}%
                </td>
                <td className="num" style={{ color: b.avgShare >= m.baseShare ? 'var(--good)' : undefined }}>
                  {b.avgShare}%
                </td>
                <td className="num" style={{ color: b.top3Share >= 80 ? 'var(--bad)' : undefined }}>
                  {b.top3Share}%
                </td>
                <td className="num">{b.ratingsShare}%</td>
                <td>{b.signal && <span className={`tag ${b.signal === '近期热销' ? 'good' : 'warn'}`}>{b.signal}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {myBand && <p className="small">你在 ${myBand.from}–{myBand.to}：单均市占 {myBand.avgShare}%（基准 {m.baseShare}%），区间垄断度 {myBand.top3Share}%。</p>}
      </div>

      <div className="card">
        <h3>
          我的细分市场样本（{inMarket.length}）
          {!readOnly && (
            <button className="btn sm" style={{ float: 'right' }} onClick={() => setShowOthers(!showOthers)}>
              {showOthers ? '收起' : '从其他组加入产品'}
            </button>
          )}
        </h3>
        {showOthers && !readOnly && (
          <div className="others">
            <table className="tbl">
              <tbody>
                {others.map((p) => (
                  <tr key={p.asin}>
                    <td style={{ width: '55%' }}>
                      <ProductCell p={p} />
                    </td>
                    <td>{r.classified[p.asin]?.accessory ? <span className="tag">配件</span> : r.classified[p.asin]?.form}</td>
                    <td className="num">${p.price}</td>
                    <td className="num">月销 {p.units}</td>
                    <td>
                      <button className="btn sm" onClick={() => onEdit({ include: p.asin })}>
                        加入
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <table className="tbl">
          <thead>
            <tr>
              <th>产品</th>
              <th className="num">价格</th>
              <th className="num">月销</th>
              <th className="num">评论数</th>
              <th className="num">评分</th>
              <th>上架</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {inMarket.map((p) => (
              <tr key={p.asin} className={p.asin === r.asin ? 'mine' : ''}>
                <td style={{ width: '50%' }}>
                  <ProductCell p={p} mine={p.asin === r.asin} />
                </td>
                <td className="num">${p.price}</td>
                <td className="num">{p.units.toLocaleString()}</td>
                <td className="num">{p.ratings.toLocaleString()}</td>
                <td className="num">{p.rating}</td>
                <td>{p.availableDate ? new Date(p.availableDate).toLocaleDateString() : ''}</td>
                {!readOnly && (
                  <td>
                    {p.asin !== r.asin && (
                      <>
                        <button className="btn sm" onClick={() => onEdit({ exclude: p.asin })}>
                          移出
                        </button>{' '}
                        <button className="btn sm" onClick={() => onEdit({ toggleAccessory: p.asin })}>
                          是配件
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Bar({ v, max = 100, color = 'var(--brand)' }: { v: number; max?: number; color?: string }) {
  return (
    <span className="bar">
      <i style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: color }} />
    </span>
  );
}
