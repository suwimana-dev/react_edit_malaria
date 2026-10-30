import React from 'react';
import { store, useStore } from '../store';
import { riskColor, classCss } from '../lib/scoring';
import { setClassVisible, setAllVisible } from '../actions';

function RiskScale() {
  const lower = useStore((s) => s.profileWeights?.[s.activeProfile]?.threshold ?? 50);
  const bar = `linear-gradient(to right, ${riskColor(lower, lower)} 0%, ${riskColor(lower + (100 - lower) * 0.32, lower)} 32%, ${riskColor(lower + (100 - lower) * 0.62, lower)} 62%, ${riskColor(100, lower)} 100%)`;
  return (
    <div className="legend-sec">
      <div className="legend-h">Breeding risk score</div>
      <div className="risk-bar" style={{ background: bar }} />
      <div className="risk-ax"><span>{lower}</span><span>{Math.round((lower + 100) / 2)}</span><span>100</span></div>
      <div className="legend-note">Only parcels at or above the threshold are drawn. Click one for its score breakdown.</div>
    </div>
  );
}

export default function Legend() {
  const items = useStore((s) => s.legendItems), visible = useStore((s) => s.visibleClasses);
  const collapsed = useStore((s) => s.ui.legendCollapsed), ui = useStore((s) => s.ui);
  return (
    <div id="legend" className="card">
      <RiskScale />
      <div className="legend-sec">
        <div className="legend-h">Water</div>
        <div className="legrow"><span className="sw" style={{ background: '#0a84ff' }} />Detected water body</div>
      </div>
      <div className="legend-sec">
        <div className="legend-h">NDVI</div>
        <div className="legrow"><span className="sw" style={{ background: 'rgb(200,40,38)' }} />&lt; 0.15 — bare / water</div>
        <div className="legrow"><span className="sw" style={{ background: 'rgb(120,195,90)' }} />0.3–0.5 — vegetation</div>
        <div className="legrow"><span className="sw" style={{ background: 'rgb(15,120,52)' }} />&gt; 0.5 — dense canopy</div>
      </div>
      {items.length > 0 && (
        <div className={`legend-sec${collapsed ? ' collapsed' : ''}`} id="lulc-legend">
          <div className="legend-h legend-toggle" role="button" tabIndex={0} aria-expanded={!collapsed}
            onClick={() => store.set({ ui: { ...ui, legendCollapsed: !collapsed } })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); store.set({ ui: { ...ui, legendCollapsed: !collapsed } }); } }}>
            Land cover <span className="chev">▾</span>
          </div>
          {!collapsed && (
            <>
              <div className="lc-controls">
                <button className="linkbtn" onClick={() => setAllVisible(true)}>All</button>
                <button className="linkbtn" onClick={() => setAllVisible(false)}>None</button>
              </div>
              {items.map((it) => (
                <label key={it.id} className="legrow lulc-row" title="Tick to show this class; untick to hide it on the map">
                  <input type="checkbox" checked={visible.has(it.id)} onChange={(e) => setClassVisible(it.id, e.target.checked)} />
                  <span className="sw" style={{ background: classCss({ [it.id]: it.color }, it.id) }} />
                  <span className="cls-id">{it.id}</span>
                  <span className="cls-name">{it.name}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
