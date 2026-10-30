import React from 'react';
import { store, useStore } from '../store';
import { riskColor, classCss } from '../lib/scoring';
import { setClassVisible, setAllVisible } from '../actions';
import { Button, Card } from '../ui';

const Sec = ({ title, children, ...p }) => (
  <div className="mb-3.5 last:mb-0" {...p}>
    <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide">{title}</div>
    {children}
  </div>
);
const Row = ({ color, children }) => (
  <div className="my-1 flex items-center gap-2.5 text-sm">
    <span className="size-4 shrink-0 rounded shadow-[inset_0_0_0_1px_rgba(0,0,0,.25)]" style={{ background: color }} />{children}
  </div>
);

function RiskScale() {
  const lower = useStore((s) => s.profileWeights?.[s.activeProfile]?.threshold ?? 50);
  const bar = `linear-gradient(to right, ${riskColor(lower, lower)} 0%, ${riskColor(lower + (100 - lower) * 0.32, lower)} 32%, ${riskColor(lower + (100 - lower) * 0.62, lower)} 62%, ${riskColor(100, lower)} 100%)`;
  return (
    <Sec title="Breeding risk score">
      <div className="h-3.5 rounded-[7px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.2)]" style={{ background: bar }} />
      <div className="mt-1 flex justify-between font-mono text-xs text-muted"><span>{lower}</span><span>{Math.round((lower + 100) / 2)}</span><span>100</span></div>
      <div className="mt-1.5 text-[13px] text-muted">Only parcels at or above the threshold are drawn. Click one for its score breakdown.</div>
    </Sec>
  );
}

export default function Legend() {
  const items = useStore((s) => s.legendItems), visible = useStore((s) => s.visibleClasses);
  const ui = useStore((s) => s.ui), collapsed = ui.legendCollapsed;
  const toggle = () => store.set({ ui: { ...ui, legendCollapsed: !collapsed } });
  return (
    <Card id="legend" className="max-h-[32%] flex-none overflow-auto px-4 py-3.5 max-sm:hidden">
      <RiskScale />
      <Sec title="Water"><Row color="#0a84ff">Detected water body</Row></Sec>
      <Sec title="NDVI">
        <Row color="rgb(200,40,38)">&lt; 0.15 — bare / water</Row>
        <Row color="rgb(120,195,90)">0.3–0.5 — vegetation</Row>
        <Row color="rgb(15,120,52)">&gt; 0.5 — dense canopy</Row>
      </Sec>
      {items.length > 0 && (
        <div id="lulc-legend" className="mb-0">
          <div role="button" tabIndex={0} aria-expanded={!collapsed} onClick={toggle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
            className="flex min-h-9 cursor-pointer select-none items-center justify-between text-[13px] font-semibold uppercase tracking-wide">
            Land cover <span className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}>▾</span>
          </div>
          {!collapsed && (
            <>
              <div className="mb-1.5 flex gap-3">
                <Button variant="link" onClick={() => setAllVisible(true)}>All</Button>
                <Button variant="link" onClick={() => setAllVisible(false)}>None</Button>
              </div>
              {items.map((it) => (
                <label key={it.id} title="Tick to show this class; untick to hide it on the map"
                  className="-mx-1.5 flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-sm hover:bg-wash">
                  <input type="checkbox" checked={visible.has(it.id)} onChange={(e) => setClassVisible(it.id, e.target.checked)} />
                  <span className="size-4 shrink-0 rounded shadow-[inset_0_0_0_1px_rgba(0,0,0,.25)]" style={{ background: classCss({ [it.id]: it.color }, it.id) }} />
                  <span className="min-w-[18px] text-right font-mono text-xs text-muted">{it.id}</span>
                  <span className="flex-1">{it.name}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
