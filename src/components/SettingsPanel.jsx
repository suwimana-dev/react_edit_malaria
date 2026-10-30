import React, { useState } from 'react';
import { store, useStore } from '../store';
import { setWeight, currentMonth, allProfileWeights } from '../lib/weights';
import { GUESSED_MONTHS, MONTHS } from '../lib/scoring';
import { setProfile, rescoreAll, saveWeightVersion, applyWeightVersion, resetProfileWeights } from '../actions';
import NumField from './NumField.jsx';
import Seg from './Seg.jsx';
import { Button, Card, Input, Select, cx } from '../ui';

const Group = ({ title, children }) => (
  <section className="border-b border-line-soft py-3.5 last:border-b-0">{title && <h3 className="mb-0.5 text-[15px] font-semibold text-ink">{title}</h3>}{children}</section>
);
const P = ({ children, ...p }) => <p className="my-0.5 mb-2 text-sm text-muted" {...p}>{children}</p>;
const Grid = ({ children, className }) => <div className={cx('grid grid-cols-[1fr_92px] items-center gap-x-3 gap-y-2 text-[15px]', className)}>{children}</div>;
const FULL = 'col-span-full';
const dig = (o, path) => path.reduce((a, k) => a?.[k], o);

export default function SettingsPanel() {
  const open = useStore((s) => s.ui.settingsOpen), pw = useStore((s) => s.profileWeights);
  const active = useStore((s) => s.activeProfile), vegMode = useStore((s) => s.vegMode);
  const labels = useStore((s) => s.habitatLabels), versions = useStore((s) => s.weightVersions);
  const defaults = useStore((s) => s.profileDefaults), flight = useStore((s) => s.flightDate);
  const appliedKey = useStore((s) => s.appliedKey), hasResults = useStore((s) => s.riskStems.length > 0);
  const [saving, setSaving] = useState(false), [name, setName] = useState(''), [reason, setReason] = useState('');
  if (!open || !pw || !pw[active]) return null;
  const w = pw[active], d = defaults[active] || {}, m = currentMonth();
  const dirty = hasResults && JSON.stringify(allProfileWeights()) !== appliedKey;
  const close = () => store.set((x) => ({ ui: { ...x.ui, settingsOpen: false } }));

  // one labelled number: marks itself "edited" when it differs from the shipped default
  const F = (label, path, props = {}) => {
    const v = dig(w, path), edited = dig(d, path) !== undefined && dig(d, path) !== v;
    return (
      <React.Fragment key={path.join('.')}>
        <label>{label}</label>
        <div className="flex flex-col items-end gap-0.5">
          <NumField label={label} value={v} onChange={(x) => setWeight(path, x)} {...props} />
          {edited && <span className="chg text-xs font-semibold text-amber">edited (was {dig(d, path)})</span>}
        </div>
      </React.Fragment>
    );
  };

  return (
    <Card id="panel" role="dialog" aria-label="Risk settings" className="absolute right-3 top-3.5 z-[1001] flex max-h-[calc(100%-28px)] w-[min(380px,calc(100%-24px))] flex-col overflow-hidden max-sm:inset-0 max-sm:max-h-none max-sm:w-auto max-sm:rounded-none">
      <div className="flex items-center justify-between border-b border-line-soft px-4 pb-2.5 pt-3.5">
        <h2 className="text-lg font-semibold">Risk settings</h2>
        <Button onClick={close} aria-label="Close settings">Close</Button>
      </div>
      <div className="flex-1 overflow-auto px-4 pb-4 pt-1">
        <p className="mt-1.5 text-sm leading-normal text-muted [&_b]:text-ink">Scores are points out of 100, not verified probabilities. Change a value, then press <b>Apply and re-score</b>.</p>

        <Group title="What to score">
          <Seg label="Scoring profile" value={active} onChange={setProfile} options={[['any_larvae', 'Any larvae'], ['malaria', 'Malaria vector']]} />
          <Grid className="mt-2.5">
            <label htmlFor="w_month" className="col-span-full -mb-1">Flight month</label>
            <Select id="w_month" className="col-span-full" disabled value={m} onChange={() => {}}>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</Select>
            {F('Points for this month', ['month', String(m)])}
            {F('Flag a parcel from (points)', ['threshold'])}
          </Grid>
          <P id="monthNote">
            {GUESSED_MONTHS.includes(m) ? 'This month’s weight is a guess: no survey data yet.' : 'This month’s weight comes from the survey.'}
            {!flight && ' Set the flight date to pick the month.'}
          </P>
        </Group>

        <Group title="Water and vegetation">
          <P>Parcels with no water score 0. Water itself adds no points; the habitat, vegetation and rice stage do.</P>
          <Grid>
            <label htmlFor="w_veg_mode" className="col-span-full -mb-1">How to judge vegetation</label>
            <Select id="w_veg_mode" className="col-span-full" value={vegMode} onChange={(e) => store.set({ vegMode: e.target.value })}>
              <option value="edge_proxy">2 m water-edge estimate (provisional)</option>
              <option value="ndvi_proxy">Whole-region NDVI (older method)</option>
              <option value="observed_only">Field observations only</option>
            </Select>
            {F('Vegetation: none', ['vegetation_points', 'none'])}
            {F('Vegetation: sparse', ['vegetation_points', 'sparse'])}
            {F('Vegetation: dense', ['vegetation_points', 'dense'])}
            {F('NDVI counts as none below', ['ndvi_none_max'], { step: 0.05 })}
            {F('NDVI counts as dense from', ['ndvi_dense_min'], { step: 0.05 })}
            {F('Rice: flooded', ['rice_points', 'flooded'])}
            {F('Rice: tillering', ['rice_points', 'tillering'])}
            {F('Rice: canopy', ['rice_points', 'canopy'])}
            {F('Rice: mature', ['rice_points', 'mature'])}
          </Grid>
          <P>The edge estimate looks at NDVI above 0.4 in a 2 m band around each wet area: under 10% is none, 10 to 50% sparse, over 50% dense. The two NDVI cutoffs only apply to the older whole-region method. Anything you record in the field overrides the estimate.</P>
        </Group>

        <Group title="Points per habitat">
          <Grid>
            {Object.entries(labels).map(([h, label]) => F(`${label}${h === 'human_settlement' ? ' (guessed)' : ''}`, ['habitat_points', h], { min: 0 }))}
          </Grid>
        </Group>

        <Group>
          <details>
            <summary>Reported survey results</summary>
            <P>From the survey used to fit these weights, so not an independent check of this NDVI-based version.</P>
            <table className="w-full border-collapse text-sm [&_td]:py-1 [&_td]:pr-1.5 [&_th]:py-1 [&_th]:pr-1.5 [&_th]:text-left">
              <thead><tr><th>Profile / cutoff</th><th>Flagged</th><th>With larvae</th><th>Sites caught</th></tr></thead>
              <tbody>
                <tr><td>Any larvae / 50</td><td>72%</td><td>63%</td><td>84%</td></tr>
                <tr><td>Any larvae / 60</td><td>51%</td><td>67%</td><td>64%</td></tr>
                <tr><td>Malaria / 30</td><td>23%</td><td>30%</td><td>75%</td></tr>
                <tr><td>Malaria / 40</td><td>20%</td><td>32%</td><td>71%</td></tr>
              </tbody>
            </table>
            <P>Malaria vector priority is about Anopheles breeding sites, not a person&rsquo;s chance of malaria.</P>
          </details>
        </Group>

        <Group title="Weight versions">
          <P>Save the current weights with a name so the team can reload them later.</P>
          <Select id="weightVersions" aria-label="Load a saved weight version" value="" onChange={(e) => e.target.value !== '' && applyWeightVersion(Number(e.target.value))}>
            <option value="">Load a saved version…</option>
            {versions.map((v, i) => <option key={i} value={i}>{v.name} · {v.team}</option>)}
          </Select>
          <Button id="saveWeightsBtn" className="mt-2 w-full" onClick={() => setSaving(!saving)}>{saving ? 'Cancel' : 'Save these weights as a version'}</Button>
          {saving && (
            <div className="mt-2 grid gap-2.5">
              <Input type="text" placeholder="Version name" aria-label="Weight version name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="text" placeholder="Why this version?" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="primary" onClick={async () => { if (await saveWeightVersion(name, reason)) { setSaving(false); setName(''); setReason(''); } }}>Save version</Button>
            </div>
          )}
        </Group>
      </div>
      <div className="grid gap-2.5 border-t border-line bg-wash px-4 py-3">
        {hasResults && <span className={cx('badge inline-flex min-h-7 items-center justify-self-start rounded-full px-2.5 text-[13px] font-semibold', dirty ? 'bg-amber-100 text-amber' : 'bg-ok-100 text-ok')}>{dirty ? 'Changes not applied yet' : 'Results match these settings'}</span>}
        <Button id="applyBtn" variant="primary" disabled={!hasResults} onClick={rescoreAll}>Apply and re-score</Button>
        <Button onClick={resetProfileWeights}>Reset this profile to defaults</Button>
      </div>
    </Card>
  );
}
