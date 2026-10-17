import {STRATEGIES, NAMES, SHORT, finite, number, percent, dateLabel, validateSnapshot, filterStocks, sortStocks, sessionPath} from './core.mjs';
const $ = id => document.getElementById(id);
const tones = {mean_reversion: 'mr', trend_pullback: 'pb', breakout_momentum: 'bo'};
const state = {scan: null, view: 'all', sort: 'ticker', direction: 'asc', session: 'latest'};
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text != null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
};
function badge(risk) {
  return node('span', {PASS: 'Pass', CAUTION: 'Caution', HIGH_RISK: '⚠ High risk'}[risk] || risk || 'Unknown', `badge ${risk === 'HIGH_RISK' ? 'high-risk' : risk?.toLowerCase() || 'unknown'}`);
}
function tickerButton(stock) {
  const button = node('button', stock.ticker, 'ticker-button');
  button.type = 'button';
  button.setAttribute('aria-label', `View ${stock.ticker} stock details`);
  button.addEventListener('click', () => showDetails(stock));
  return button;
}
function score(stock, name) {
  const value = stock.scores[name];
  const element = node('span', null, `score ${tones[name]}-text${stock.strategies[name].qualified ? ' qualified' : ''}`);
  element.append(node('span', number(value, 0)));
  if (finite(value)) {
    const track = node('span', null, 'score-track');
    const bar = node('i');
    bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    track.append(bar); element.append(track);
  }
  element.title = `${NAMES[name]}: ${finite(value) ? value : 'unavailable'}; ${stock.strategies[name].qualified ? 'qualified' : 'not qualified'}`;
  return element;
}
function trendLabel(stock) {
  return node('span', stock.trend.label, `trend-label${stock.trend.type === 'UPTREND_DEEP_PULLBACK' ? ' deep' : ''}`);
}
function barDate(stock) {
  const element = node('span', stock.market_date, 'bar-date');
  if (stock.data_status !== 'OK') element.append(node('span', 'Stale bar', 'stale'));
  return element;
}
function filters() {
  const minimums = {};
  for (const name of STRATEGIES) {
    const input = $(`min-${tones[name]}`);
    minimums[name] = input.value === '' ? null : input.valueAsNumber;
  }
  return {view: state.view, query: $('search').value, trend: $('trend').value, risk: $('risk').value, fresh: $('fresh').checked, minimums};
}
function renderRows() {
  if (!state.scan) return;
  const rows = sortStocks(filterStocks(state.scan.results, filters()), state.sort, state.direction);
  $('result-count').textContent = `${rows.length} of ${state.scan.results.length} stocks`;
  $('empty').hidden = rows.length > 0;
  const desktop = document.createDocumentFragment(), mobile = document.createDocumentFragment();
  for (const stock of rows) {
    const row = node('tr');
    const cells = [tickerButton(stock), node('span', number(stock.price)), ...STRATEGIES.map(name => score(stock, name)), trendLabel(stock), badge(stock.risk.filter), node('span', stock.multi_signal.signal_count || '—', stock.multi_signal.qualified ? 'signal-badge' : ''), barDate(stock)];
    for (const element of cells) { const cell = node('td'); cell.append(element); row.append(cell); }
    desktop.append(row);
    const card = node('article', null, 'mobile-stock');
    const heading = node('div', null, 'mobile-stock-head');
    heading.append(tickerButton(stock), node('span', `$${number(stock.price)}`));
    const scores = node('div', null, 'mobile-score-row');
    for (const name of STRATEGIES) {const item = node('span', `${SHORT[name]} `, `${tones[name]}-text`); item.append(score(stock, name)); scores.append(item);}
    const status = node('div', null, 'mobile-stock-state'); status.append(trendLabel(stock), badge(stock.risk.filter));
    card.append(heading, scores, status, barDate(stock));
    if (stock.multi_signal.qualified) card.append(node('span', ` · ${stock.multi_signal.signal_count} independent signals`, 'bar-date'));
    mobile.append(card);
  }
  $('rows').replaceChildren(desktop); $('mobile-stocks').replaceChildren(mobile);
  for (const heading of document.querySelectorAll('#stocks th[data-sort]')) {
    if (heading.dataset.sort === state.sort) heading.setAttribute('aria-sort', state.direction === 'asc' ? 'ascending' : 'descending');
    else heading.removeAttribute('aria-sort');
  }
}
function changeView(view, scroll = false) {
  state.view = view;
  for (const button of document.querySelectorAll('#views button')) {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  $('list-title').textContent = view === 'all' ? 'All stocks' : view === 'multi' ? 'Multi-signal opportunities' : `${NAMES[view]} candidates`;
  $('view-description').textContent = view === 'all' ? 'Compare independent strategy scores across the full universe.' : view === 'multi' ? 'Stocks independently qualifying under two or more strategies.' : 'Qualified setups only. The other two scores remain independent.';
  state.sort = STRATEGIES.includes(view) ? view : view === 'multi' ? 'signal_count' : 'ticker';
  state.direction = view === 'all' ? 'asc' : 'desc';
  $('sort').value = `${state.sort}:${state.direction}`;
  renderRows();
  if (scroll) $('stock-list').scrollIntoView({behavior: 'smooth', block: 'start'});
}
function topPicks() {
  const fragment = document.createDocumentFragment();
  const byTicker = new Map(state.scan.results.map(stock => [stock.ticker, stock]));
  for (const name of STRATEGIES) {
    const all = state.scan.results.filter(stock => stock.strategies[name].qualified);
    const picks = (state.scan.top_picks[name] || []).map(ticker => byTicker.get(ticker)).filter(stock => stock?.strategies[name].qualified).slice(0, 3);
    const card = node('article', null, `strategy-card ${tones[name]}`);
    const head = node('div', null, 'strategy-card-head'); head.append(node('h3', NAMES[name]), node('small', `${all.length} qualified`));
    card.append(head);
    if (!picks.length) card.append(node('p', 'No independently qualifying setups in this snapshot.', 'no-picks'));
    else {
      const table = node('table', null, 'pick-table'), thead = node('thead'), heading = node('tr');
      for (const label of ['Ticker', 'Score', 'R/R', 'Risk']) {const th = node('th', label); th.scope = 'col'; heading.append(th);}
      thead.append(heading); table.append(thead);
      const body = node('tbody');
      for (const stock of picks) {
        const row = node('tr');
        for (const value of [tickerButton(stock), node('span', number(stock.scores[name], 0), `${tones[name]}-text`), node('span', `${number(stock.strategies[name].risk_reward, 1)}R`), badge(stock.risk.filter)]) {
          const td = node('td'); td.append(value); row.append(td);
        }
        body.append(row);
      }
      table.append(body); card.append(table);
    }
    const footer = node('div', null, 'card-footer');
    const button = node('button', 'Explore strategy →', 'text-button'); button.type = 'button'; button.addEventListener('click', () => changeView(name, true));
    footer.append(node('span', `Independent ${SHORT[name]} ranking`), button); card.append(footer); fragment.append(card);
  }
  $('top-picks').replaceChildren(fragment);
}
function renderDiagnostics() {
  const scan = state.scan, fragment = document.createDocumentFragment();
  const context = node('div', null, 'diagnostic-grid');
  for (const key of ['spy', 'qqq', 'vix']) {
    const block = node('div'), market = scan.market[key]; block.append(node('h3', key.toUpperCase()));
    block.append(node('p', !market ? 'Unavailable or stale; not used as current market context.' : key === 'vix' ? `Level ${number(market.value)} · daily change ${percent(market.daily_change_pct)} · ${market.market_date}` : `Price ${number(market.price)} · above SMA50: ${market.above_sma50 ? 'yes' : 'no'} · above SMA200: ${market.above_sma200 ? 'yes' : 'no'} · ${market.market_date}`));
    context.append(block);
  }
  fragment.append(context, node('p', scan.market.reason));
  fragment.append(node('p', `Expected completed session: ${scan.scan.latest_completed_session}. Oldest stock bar: ${scan.scan.market_date_range?.oldest || 'unknown'}. Failed tickers: ${scan.scan.failed}.`));
  if (scan.failed_tickers?.length) fragment.append(node('p', scan.failed_tickers.map(item => `${item.ticker}: ${item.stage} / ${item.reason}`).join('; ')));
  const rejections = node('div', null, 'diagnostic-grid');
  for (const name of STRATEGIES) {
    const block = node('div'), list = node('ul'); block.append(node('h3', NAMES[name]));
    for (const [reason, count] of Object.entries(scan.rejection_statistics?.[name] || {}).sort((a,b) => b[1] - a[1])) list.append(node('li', `${reason.replaceAll('_', ' ')}: ${count}`));
    block.append(list); rejections.append(block);
  }
  fragment.append(node('p', 'Rejection counts overlap: one stock can fail several gates.'), rejections);
  $('diagnostics').replaceChildren(fragment);
}
function showDetails(stock) {
  const fragment = document.createDocumentFragment();
  const heading = node('div', null, 'detail-heading'); const name = node('h2', stock.ticker); name.id = 'detail-title';
  heading.append(name, node('span', `$${number(stock.price)}`, 'price'));
  fragment.append(heading, node('p', `${stock.trend.label} · Bar ${stock.market_date} · ${stock.data_status === 'OK' ? 'Fresh completed bar' : 'STALE BAR'}`, 'detail-meta'));
  fragment.append(badge(stock.risk.filter), node('p', stock.trend.reason, 'trend-reason'));
  if (stock.risk.warning_details?.length || stock.risk.falling_knife) fragment.append(node('p', [...(stock.risk.falling_knife ? ['⚠ FALLING KNIFE RISK'] : []), ...(stock.risk.warning_details || [])].join(' · '), 'detail-warnings'));
  fragment.append(node('p', `Market: ${stock.risk.market_environment} · Behaviour: ${stock.risk.stock_behaviour} · News: ${stock.risk.news_risk}${stock.risk.news_available ? '' : ' (not checked)'}`, 'detail-meta'));
  if (stock.multi_signal.qualified) fragment.append(node('p', `✳ ${stock.multi_signal.signal_count} qualifying signals: ${stock.multi_signal.strategies.map(n => NAMES[n]).join(' + ')}. ${stock.multi_signal.highlight || ''}`, 'trend-reason'));
  const indicators = node('div', null, 'indicator-grid');
  for (const [label, value] of [['RSI', number(stock.indicators?.rsi, 1)], ['Volume ratio', finite(stock.indicators?.volume_ratio) ? `${number(stock.indicators.volume_ratio)}×` : '—'], ['ATR', number(stock.indicators?.atr)], ['SMA20', number(stock.indicators?.sma20)], ['SMA50', number(stock.indicators?.sma50)], ['SMA200', number(stock.indicators?.sma200)]]) {
    const block = node('div', label, 'indicator'); block.append(node('strong', value)); indicators.append(block);
  }
  fragment.append(indicators);
  const trades = node('div', null, 'trade-grid');
  for (const key of STRATEGIES) {
    const strategy = stock.strategies[key], card = node('article', null, 'trade-card');
    card.append(node('h3', NAMES[key], `${tones[key]}-text`));
    const value = node('div', number(strategy.score, 0), `trade-score ${tones[key]}-text`); value.append(node('small', ' / 100')); card.append(value);
    card.append(node('div', `${strategy.qualified ? '✓ Qualified' : 'Not qualified'} · ${strategy.status?.replaceAll('_', ' ') || 'Unavailable'}`, 'trade-status'));
    const levels = node('dl');
    for (const [label, value] of [['Entry', number(strategy.entry)], ['Stop', number(strategy.stop)], ['Target', number(strategy.target)], ['Risk', finite(strategy.risk_pct) ? `${number(strategy.risk_pct, 1)}%` : '—'], ['Reward', finite(strategy.reward_pct) ? `${number(strategy.reward_pct, 1)}%` : '—'], ['Risk / Reward', finite(strategy.risk_reward) ? `${number(strategy.risk_reward, 2)}R` : '—']]) levels.append(node('dt', label), node('dd', value));
    card.append(levels, node('p', strategy.reason));
    if (strategy.rejection_reasons?.length) {
      const details = node('details'), list = node('ul'); details.append(node('summary', `Why it did not qualify (${strategy.rejection_reasons.length})`));
      for (const reason of strategy.rejection_reasons) list.append(node('li', reason.replaceAll('_', ' ')));
      details.append(list); card.append(details);
    }
    if (strategy.risk_warning_details?.length) card.append(node('p', `⚠ ${strategy.risk_warning_details.join('; ')}`, 'detail-warnings'));
    trades.append(card);
  }
  fragment.append(trades, node('p', 'Trade levels are scenarios based on adjusted historical prices. A technical score cannot override a failed risk/reward or structure gate.', 'detail-meta'));
  $('detail').replaceChildren(fragment);
  if (!$('stock-dialog').open) $('stock-dialog').showModal();
}
function renderSnapshot() {
  const scan = state.scan;
  $('market-date').textContent = dateLabel(scan.scan.market_date);
  const timestamp = new Date(scan.scan.scan_datetime);
  $('scan-time').textContent = `Scanned ${Number.isNaN(timestamp.getTime()) ? scan.scan.scan_datetime : timestamp.toLocaleString('en-AU', {dateStyle: 'medium', timeStyle: 'short', timeZone: scan.scan.scan_timezone || 'Australia/Sydney'})} (${scan.scan.scan_timezone || 'Australia/Sydney'})`;
  $('coverage').textContent = `${scan.scan.fresh} fresh · ${scan.scan.stale} stale · ${scan.scan.failed} failed`;
  $('stat-stocks').textContent = number(scan.scan.stocks_scanned, 0);
  $('stat-coverage').textContent = `${scan.scan.stocks_requested} requested · ${scan.scan.fresh} fresh bars`;
  $('stat-qualified').textContent = number(scan.results.filter(s => STRATEGIES.some(n => s.strategies[n].qualified)).length, 0);
  $('stat-multi').textContent = number(scan.results.filter(s => s.multi_signal.qualified).length, 0);
  $('stat-market').textContent = scan.market.environment.replaceAll('_', ' ');
  $('market-detail').textContent = `VIX ${number(scan.market.vix?.value, 1)} · day ${percent(scan.market.vix?.daily_change_pct)}`;
  $('count-all').textContent = scan.results.length;
  for (const name of STRATEGIES) $(`count-${name}`).textContent = scan.results.filter(s => s.strategies[name].qualified).length;
  $('count-multi').textContent = scan.results.filter(s => s.multi_signal.qualified).length;
  const previous = $('trend').value;
  const options = [new Option('All trends', '')];
  for (const [type, label] of [...new Map(scan.results.map(s => [s.trend.type, s.trend.label])).entries()].sort((a,b) => a[1].localeCompare(b[1]))) options.push(new Option(label, type));
  $('trend').replaceChildren(...options);
  if (options.some(option => option.value === previous)) $('trend').value = previous;
  $('download').href = sessionPath(state.session);
  $('download').download = `multi-strategy-${scan.scan.market_date}.json`;
  $('versions').textContent = `Schema ${scan.schema_version} · ${Object.entries(scan.strategy_versions).map(([name, version]) => `${name.replaceAll('_', ' ')} ${version}`).join(' · ')}`;
  topPicks(); renderRows(); renderDiagnostics();
}
async function getJSON(path) {
  const response = await fetch(path, {cache: 'no-cache', signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`Saved data could not be loaded (HTTP ${response.status}).`);
  return response.json();
}
async function loadSession(value) {
  $('loading').hidden = false; $('error').hidden = true;
  $('session').disabled = true; $('reload').disabled = true;
  try {
    const scan = validateSnapshot(await getJSON(sessionPath(value)));
    state.scan = scan; state.session = value;
    renderSnapshot();
  } catch (error) {
    $('error').textContent = `${error.message || 'The snapshot could not be loaded.'} ${state.scan ? 'The previous snapshot is still displayed.' : 'Please use Reload to try again.'}`;
    $('error').hidden = false; $('session').value = state.session;
  } finally {
    $('loading').hidden = true; $('session').disabled = false; $('reload').disabled = false;
  }
}
async function loadHistory() {
  try {
    const manifest = await getJSON('data/index.json');
    if (!Array.isArray(manifest.sessions)) throw new Error('No session index.');
    for (const session of manifest.sessions) {
      sessionPath(session.market_date);
      $('session').append(new Option(`${dateLabel(session.market_date)} · history`, session.market_date));
    }
  } catch {
    // Latest remains fully usable if the optional history index is unavailable.
    $('session').title = 'History index unavailable; showing the latest snapshot.';
  }
}
for (const button of document.querySelectorAll('#views button')) button.addEventListener('click', () => changeView(button.dataset.view, true));
for (const id of ['search', 'min-mr', 'min-pb', 'min-bo']) $(id).addEventListener('input', renderRows);
for (const id of ['trend', 'risk', 'fresh']) $(id).addEventListener('change', renderRows);
$('reset').addEventListener('click', () => {
  for (const id of ['search', 'trend', 'risk', 'min-mr', 'min-pb', 'min-bo']) $(id).value = '';
  $('fresh').checked = false; renderRows();
});
$('sort').addEventListener('change', () => { [state.sort, state.direction] = $('sort').value.split(':'); renderRows(); });
for (const th of document.querySelectorAll('#stocks th[data-sort]')) th.querySelector('button').addEventListener('click', () => {
  state.direction = state.sort === th.dataset.sort ? (state.direction === 'asc' ? 'desc' : 'asc') : th.dataset.sort === 'ticker' ? 'asc' : 'desc';
  state.sort = th.dataset.sort;
  const option = `${state.sort}:${state.direction}`;
  if (![...$('sort').options].some(o => o.value === option)) $('sort').add(new Option(`${state.sort.replaceAll('_', ' ')} ${state.direction === 'asc' ? '↑' : '↓'}`, option));
  $('sort').value = option; renderRows();
});
$('session').addEventListener('change', () => loadSession($('session').value));
$('reload').addEventListener('click', () => loadSession($('session').value));
$('close-dialog').addEventListener('click', () => $('stock-dialog').close());
$('stock-dialog').addEventListener('click', event => {if (event.target === $('stock-dialog')) {const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close();}});
await Promise.all([loadSession('latest'), loadHistory()]);
