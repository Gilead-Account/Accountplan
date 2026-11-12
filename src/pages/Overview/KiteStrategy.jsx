import HomeFieldHelp from '@/components/HomeFieldHelp';

const splitStrategy = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const divider = text.indexOf('|');
  if (divider === -1) return { prefix: '', value: text };
  const prefix = text.slice(0, divider).trim();
  const suffix = text.slice(divider + 1).trim();
  return prefix && suffix ? { prefix, value: suffix } : { prefix: '', value: text };
};

const groupStrategies = (items) => {
  const groups = [];
  const byPrefix = new Map();

  for (const item of items || []) {
    const { prefix, value } = splitStrategy(item);
    if (!value) continue;

    const key = prefix ? prefix.toLowerCase() : `single:${value.toLowerCase()}`;
    let group = byPrefix.get(key);
    if (!group) {
      group = { key, prefix, values: [] };
      byPrefix.set(key, group);
      groups.push(group);
    }
    if (!group.values.includes(value)) group.values.push(value);
  }

  return groups;
};

const StrategyColumns = ({ items }) => {
  const groups = groupStrategies(items);
  const values = groups.filter((group) => group.values.length);
  return values.length ? (
    <div className="strategy-column-grid">
      {values.map((group) => (
        <section key={group.key} className="strategy-column">
          <h4>{group.prefix || 'Strategy'}</h4>
          <ul className="strategy-column-list">
            {group.values.map((value) => (
              <li key={value} className="strategy-column-item">{value}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  ) : (
    <span className="strategy-column-empty">Not entered</span>
  );
};

export default function KiteStrategy({ dlbcl, mm }) {
  return (
    <article className="mock-card home-kite-strategy-card">
      <div className="mock-section-head home-kite-strategy-head">
        <h3 className="home-title-with-help">
          <span>Kite Strategy</span>
          <HomeFieldHelp helpKey="kiteStrategy" label="Kite Strategy" />
        </h3>
      </div>
      <section className="home-strategy-indication-panel home-dlbcl-strategy-panel">
        <h4 className="home-strategy-indication-label">DLBCL</h4>
        <StrategyColumns items={dlbcl} />
      </section>
      <section className="home-strategy-indication-panel home-mm-strategy-panel">
        <h4 className="home-strategy-indication-label">MM</h4>
        <StrategyColumns items={mm} />
      </section>
    </article>
  );
}
