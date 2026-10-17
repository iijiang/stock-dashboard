export const STRATEGIES = ['mean_reversion', 'trend_pullback', 'breakout_momentum'];
export const NAMES = {mean_reversion: 'Mean reversion', trend_pullback: 'Trend pullback', breakout_momentum: 'Breakout momentum'};
export const SHORT = {mean_reversion: 'MR', trend_pullback: 'PB', breakout_momentum: 'BO'};
export const finite = value => typeof value === 'number' && Number.isFinite(value);
export function number(value, digits = 2) {
  return finite(value) ? new Intl.NumberFormat('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(value) : '—';
}
export const percent = value => finite(value) ? `${value > 0 ? '+' : ''}${number(value, 1)}%` : '—';
export function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Unavailable';
  const day = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(day.getTime()) ? 'Unavailable' : day.toLocaleDateString('en-AU', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
}
export function validateSnapshot(data) {
  if (data?.schema_version !== '1.0' || !data.scan || !Array.isArray(data.results) || !data.market || !data.top_picks || !data.strategy_versions) throw new Error('Unsupported or incomplete scan JSON. Schema 1.0 is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.scan.market_date || '') || data.results.length !== data.scan.stocks_scanned) throw new Error('The saved scan has inconsistent dates or coverage.');
  if (new Set(data.results.map(s => s.ticker)).size !== data.results.length) throw new Error('The saved scan contains duplicate tickers.');
  for (const stock of data.results) {
    if (typeof stock.ticker !== 'string' || !stock.scores || !stock.trend || !stock.risk || !stock.multi_signal || !stock.strategies) throw new Error('A saved stock is missing required research fields.');
    for (const name of STRATEGIES) if (!Object.hasOwn(stock.scores, name) || typeof stock.strategies[name]?.qualified !== 'boolean') throw new Error('A strategy score or qualification flag is missing.');
  }
  return data;
}
export function filterStocks(stocks, filters = {}) {
  const query = (filters.query || '').trim().toUpperCase();
  return stocks.filter(s => {
    if (query && !s.ticker.toUpperCase().includes(query)) return false;
    if (filters.view === 'multi' && !s.multi_signal.qualified) return false;
    if (STRATEGIES.includes(filters.view) && !s.strategies[filters.view].qualified) return false;
    if (filters.trend && s.trend.type !== filters.trend) return false;
    if (filters.risk && s.risk.filter !== filters.risk) return false;
    if (filters.fresh && s.data_status !== 'OK') return false;
    return STRATEGIES.every(name => {
      const min = filters.minimums?.[name];
      return !finite(min) || (finite(s.scores[name]) && s.scores[name] >= min);
    });
  });
}
export function sortStocks(stocks, key = 'ticker', direction = 'asc') {
  const value = stock => STRATEGIES.includes(key) ? stock.scores[key] : key === 'signal_count' ? stock.multi_signal.signal_count : stock[key];
  return [...stocks].sort((a, b) => {
    const av = value(a), bv = value(b);
    const missingA = av == null || (typeof av === 'number' && !finite(av));
    const missingB = bv == null || (typeof bv === 'number' && !finite(bv));
    if (missingA !== missingB) return missingA ? 1 : -1;
    const comparison = missingA ? 0 : typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return comparison ? comparison * (direction === 'desc' ? -1 : 1) : a.ticker.localeCompare(b.ticker);
  });
}
export function sessionPath(value) {
  if (value === 'latest') return 'data/latest.json';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid market session.');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid market session.');
  return `data/${value.slice(0, 4)}/${value.slice(5, 7)}/${value}.json`;
}
