// 特斯拉车型图鉴（非官方）：路由、语言、主题、四个页面
import { createViewer } from './viewer.js';

const A = window.__atlas = { ready: false };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), root = document.documentElement;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const L = () => root.lang === 'en' ? 'en' : 'zh';

const T = {
  zh: {
    brand: '车型图鉴', home: '车型', dash: '数据看板', cred: '模型署名', lang: 'EN',
    disc: '本站为非官方爱好者作品，与特斯拉公司（Tesla, Inc.）无任何关联，也未获其授权或认可。车型名称与商标归各自权利人所有；3D 模型来自社区作者或本站自建，数据均注明出处，仅供学习交流。',
    view3d: '查看 3D', toDash: '数据看板', lineup: '全部车型', lineupSub: '从 2006 年的初代 Roadster，到今天。',
    designer: '设计师', year: '首次亮相', price: '发布价', status: '状态', sales: '累计销量', delivery: '首次交付',
    st: { production: '在产', discontinued: '已停产', upcoming: '未量产', concept: '概念车' },
    none: '未公布', est: '估算', asOf: '截至', doorsOpen: '打开车门', doorsClose: '关闭车门', inside: '看内饰', outside: '看外观',
    noint: '该模型暂无内饰', simp: '简化模型', simpTip: '这台车没有找到可用的社区模型，是本站自建的简化模型，细节与真车有出入。',
    paint: '车漆', unofficial: '非官方配色', drag: '拖动旋转 · 滚轮缩放', loading: '模型加载中…', failed: '模型加载失败',
    source: '出处', dims: '长 × 宽 × 高', mm: '毫米',
    kModels: '车型', kProd: '在产', kDisc: '已停产', kSales: '已知累计销量合计',
    kSalesTip: '只合计有出处的单车型数字，各车截止日期与口径不同；特斯拉官方不公布单车型累计销量。',
    cSales: '累计销量（有出处的车型）', cPrice: '发布价（美元）', cTime: '亮相时间线', model: '车型', sortHint: '点击表头排序',
    credTitle: '模型署名与数据出处', credSub: '社区模型按各自的知识共享许可使用，并按要求署名；本站对模型做了拆分车门、压缩等修改。',
    self: '本站自建（简化模型）', facts: '数据出处', license: '许可', author: '作者', back: '返回全部车型',
  },
  en: {
    brand: 'Model Atlas', home: 'Models', dash: 'Dashboard', cred: 'Credits', lang: '中文',
    disc: 'This is an unofficial fan project. It is not affiliated with, authorized or endorsed by Tesla, Inc. Model names and trademarks belong to their respective owners; 3D models come from community authors or were built for this site, and every figure cites its source.',
    view3d: 'View in 3D', toDash: 'Dashboard', lineup: 'All models', lineupSub: 'From the original 2006 Roadster to today.',
    designer: 'Designer', year: 'Unveiled', price: 'Launch price', status: 'Status', sales: 'Cumulative sales', delivery: 'First delivery',
    st: { production: 'In production', discontinued: 'Discontinued', upcoming: 'Not yet in production', concept: 'Concept' },
    none: 'Not published', est: 'estimate', asOf: 'as of', doorsOpen: 'Open doors', doorsClose: 'Close doors', inside: 'Interior', outside: 'Exterior',
    noint: 'No interior in this model', simp: 'Simplified model', simpTip: 'No usable community model was found for this vehicle; this is a simplified model built for this site.',
    paint: 'Paint', unofficial: 'not an official color', drag: 'Drag to rotate · scroll to zoom', loading: 'Loading model…', failed: 'Model failed to load',
    source: 'Source', dims: 'L × W × H', mm: 'mm',
    kModels: 'Models', kProd: 'In production', kDisc: 'Discontinued', kSales: 'Known cumulative sales',
    kSalesTip: 'Sum of sourced per-model figures only; cut-off dates differ. Tesla does not publish per-model cumulative sales.',
    cSales: 'Cumulative sales (models with a source)', cPrice: 'Launch price (USD)', cTime: 'Unveiling timeline', model: 'Model', sortHint: 'Click a header to sort',
    credTitle: 'Model credits & data sources', credSub: 'Community models are used under their Creative Commons licenses with attribution; doors were separated and files compressed for this site.',
    self: 'Built for this site (simplified)', facts: 'Data sources', license: 'License', author: 'Author', back: 'All models',
  },
};
const t = () => T[L()];
const num = n => n.toLocaleString('en-US');
const usd = c => c.price.usd == null ? t().none : '$' + num(c.price.usd);
const salesHtml = c => c.sales.kind === 'none' ? `<span class="mut">${t().none}</span>` :
  `${num(c.sales.units)}${c.sales.kind === 'estimate' ? ` <span class="badge" data-testid="est">${t().est}</span>` : ''} <span class="mut small">${t().asOf} ${c.sales.asOf}</span>`;
const srcs = f => !f ? [] : (Array.isArray(f) ? f : [f]).map(x => x.source);
const src = (c, k) => srcs(c.facts[k]).map(u => `<a class="src" href="${esc(u)}" target="_blank" rel="noopener" title="${t().source}">↗</a>`).join('');

let cars = [], view = null, sort = { key: null, dir: -1 }, carState = null;

function chrome() {
  $('#brand').textContent = t().brand; $('#nav-home').textContent = t().home; $('#nav-dash').textContent = t().dash; $('#nav-cred').textContent = t().cred;
  $('#lang').textContent = t().lang; $('#disc').textContent = t().disc;
  document.title = L() === 'en' ? 'Tesla Model Atlas · unofficial' : '特斯拉车型图鉴 · 非官方';
  const h = location.hash || '#/';
  $$('.nav-links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === (h.startsWith('#/car') ? '#/' : h)));
}

// ───── 首页 ─────
function home() {
  const l = L(), feat = ['model-y', 'model-3', 'cybertruck', 'model-s', 'roadster-2008'].map(id => cars.find(c => c.id === id)).filter(Boolean);
  app.className = 'page-home';
  app.innerHTML = feat.map((c, i) => `
    <section class="hero ${c.poster ? '' : 'noimg'}" data-testid="hero">
      <div class="hero-top"><p class="eyebrow">${c.unveilYear} · ${t().st[c.status]}</p><h1>${esc(c.name[l])}</h1><p class="sub">${esc(c.designer[l])}</p></div>
      ${c.poster ? `<img class="hero-img" src="${esc(c.poster)}" alt="" ${i ? 'loading="lazy"' : ''} width="1600" height="900">` : `<div class="hero-ghost" aria-hidden="true">${esc(c.name.en)}</div>`}
      <div class="hero-cta"><a class="btn primary" href="#/car/${c.id}">${t().view3d}</a><a class="btn" href="#/dashboard">${t().toDash}</a></div>
    </section>`).join('') + `
    <section class="hero lineup" data-testid="hero">
      <div class="hero-top"><h2>${t().lineup}</h2><p class="sub">${t().lineupSub}</p></div>
      <div class="grid">${cars.map(c => `
        <a class="card" data-testid="car-link" data-id="${c.id}" href="#/car/${c.id}">
          ${c.poster ? `<img src="${esc(c.poster)}" alt="" loading="lazy" width="1600" height="900">` : '<span class="card-ph"></span>'}
          <span class="card-name">${esc(c.name[l])}</span><span class="card-meta">${c.unveilYear} · ${t().st[c.status]}</span>
        </a>`).join('')}</div>
    </section>`;
  A.ready = true;
}

// ───── 单车页 ─────
function carPanel() {
  const { c, color, doors } = carState, l = L();
  const cur = c.colors.find(k => k.id === color);
  $('#car-info').innerHTML = `
    <a class="backlink" href="#/">← ${t().back}</a>
    <h1>${esc(c.name[l])}</h1>
    <p class="sub">${esc(c.variant[l])}${c.model.simplified ? ` <span class="badge warn" data-testid="simplified" title="${esc(t().simpTip)}">${t().simp}</span>` : ''}</p>
    <dl class="specs">
      <div><dt>${t().designer}</dt><dd data-testid="spec-designer">${esc(c.designer[l])} ${src(c, 'designer')}</dd></div>
      <div><dt>${t().year}</dt><dd data-testid="spec-year">${c.unveilYear} ${src(c, 'unveilYear')}</dd></div>
      <div><dt>${t().price}</dt><dd data-testid="spec-price">${usd(c)} ${src(c, 'price')}<small>${esc(c.price.note[l])}</small></dd></div>
      <div><dt>${t().status}</dt><dd data-testid="spec-status" data-status="${c.status}"><i class="dot ${c.status}"></i>${t().st[c.status]} ${src(c, 'status')}${c.statusNote ? `<small>${esc(c.statusNote[l])}</small>` : ''}</dd></div>
      <div><dt>${t().sales}</dt><dd data-testid="spec-sales">${salesHtml(c)} ${src(c, 'sales')}${c.sales.note ? `<small>${esc(c.sales.note[l])}</small>` : ''}</dd></div>
      ${c.dims ? `<div><dt>${t().dims}</dt><dd>${num(c.dims.l)} × ${num(c.dims.w)} × ${num(c.dims.h)} ${t().mm} ${src(c, 'dims')}${c.dimsNote ? `<small>${esc(c.dimsNote[l])}</small>` : ''}</dd></div>` : ''}
    </dl>`;
  $('#car-ctl').innerHTML = `
    <div class="swatches" role="group" aria-label="${t().paint}">${c.colors.map(k => `<button type="button" class="sw" data-testid="color" data-id="${k.id}" aria-pressed="${k.id === color}" title="${esc(k.name[l])}" style="--c:${k.hex}"></button>`).join('')}</div>
    <p class="paint-name">${esc(cur.name[l])}${cur.official === false ? ` <span class="mut small">· ${t().unofficial}</span>` : ''}</p>
    <div class="acts">
      ${c.doors.length ? `<button type="button" class="btn sm" data-testid="doors" aria-pressed="${doors}">${doors ? t().doorsClose : t().doorsOpen}</button>` : ''}
      ${c.model.interior ? `<button type="button" class="btn sm" data-testid="view-interior">${t().inside}</button>` : `<span class="mut small" data-testid="no-interior">${t().noint}</span>`}
      <button type="button" class="btn sm" data-testid="view-exterior">${t().outside}</button>
    </div>`;
  $('#car-hint').textContent = carState.failed ? t().failed : carState.loaded ? t().drag : t().loading;
}
function car(id) {
  const c = cars.find(x => x.id === id); if (!c) { location.replace('#/'); return; }
  app.className = 'page-car';
  app.innerHTML = `<section class="stage"><canvas data-testid="canvas"></canvas><p class="hint" id="car-hint"></p></section><aside class="info" id="car-info"></aside><div class="ctl" id="car-ctl"></div>`;
  carState = { c, color: c.colors[0].id, doors: false, loaded: false, failed: false };
  const st = carState;
  const v = view = createViewer($('canvas', app), c, () => { if (carState !== st) return; st.loaded = true; v.setColor(c.colors[0].hex); carPanel(); requestAnimationFrame(() => requestAnimationFrame(() => { if (carState === st) A.ready = true; })); },
    () => { if (carState !== st) return; st.failed = true; carPanel(); });
  carPanel();
  $('#car-ctl').addEventListener('click', e => {
    const b = e.target.closest('[data-testid]'); if (!b || !view) return;
    const k = b.dataset.testid;
    if (k === 'color') { st.color = b.dataset.id; view.setColor(c.colors.find(x => x.id === st.color).hex); }
    else if (k === 'doors') { st.doors = !st.doors; view.setDoors(st.doors); }
    else if (k === 'view-interior') view.view('interior');
    else if (k === 'view-exterior') view.view('exterior');
    else return;
    carPanel();
  });
}

// ───── 数据看板 ─────
function bars(list, val, fmt, cls) {
  const max = Math.max(...list.map(val)), rowH = 30, w = 520, lab = 150, h = list.length * rowH + 8;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" preserveAspectRatio="xMinYMin meet">${list.map((c, i) => {
    const bw = Math.max(2, (w - lab - 110) * Math.sqrt(val(c) / max));
    return `<text x="${lab - 10}" y="${i * rowH + 20}" text-anchor="end" class="ax">${esc(c.name[L()])}</text><rect x="${lab}" y="${i * rowH + 8}" width="${bw.toFixed(1)}" height="14" rx="2" class="${cls}"/><text x="${lab + bw + 8}" y="${i * rowH + 20}" class="val">${fmt(c)}</text>`;
  }).join('')}</svg>`;
}
function timeline() {
  const w = 1100, h = 200, y0 = 2005, y1 = 2028, x = y => 30 + (w - 150) * (y - y0) / (y1 - y0);
  const sorted = [...cars].sort((a, b) => a.unveilYear - b.unveilYear), used = {};
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img"><line x1="30" x2="${w - 30}" y1="168" y2="168" class="axis"/>${[2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026].map(y => `<text x="${x(y)}" y="190" text-anchor="middle" class="ax">${y}</text><line x1="${x(y)}" x2="${x(y)}" y1="164" y2="172" class="axis"/>`).join('')}${sorted.map(c => {
    const n = used[c.unveilYear] = (used[c.unveilYear] || 0) + 1, cy = 168 - n * 30;
    return `<line x1="${x(c.unveilYear)}" x2="${x(c.unveilYear)}" y1="${cy}" y2="168" class="stem"/><circle cx="${x(c.unveilYear)}" cy="${cy}" r="5" class="pt ${c.status}"/><text x="${x(c.unveilYear) + 10}" y="${cy + 4}" class="ax">${esc(c.name[L()])}</text>`;
  }).join('')}</svg>`;
}
function dash() {
  const l = L(), val = { year: c => c.unveilYear, price: c => c.price.usd, sales: c => c.sales.units };
  const rows = [...cars];
  if (sort.key) rows.sort((a, b) => { const x = val[sort.key](a), y = val[sort.key](b); return x == null ? (y == null ? 0 : 1) : y == null ? -1 : (x - y) * sort.dir; });
  const sum = cars.reduce((s, c) => s + (c.sales.units || 0), 0), n = k => cars.filter(c => c.status === k).length;
  const th = (k, label) => `<th><button type="button" class="th" data-testid="sort" data-key="${k}" aria-pressed="${sort.key === k}">${label}<i>${sort.key === k ? (sort.dir < 0 ? '↓' : '↑') : '↕'}</i></button></th>`;
  const withSales = cars.filter(c => c.sales.units).sort((a, b) => b.sales.units - a.sales.units), withPrice = cars.filter(c => c.price.usd).sort((a, b) => b.price.usd - a.price.usd);
  app.className = 'page-dash';
  app.innerHTML = `
    <h1 class="title">${t().dash}</h1>
    <div class="kpis">
      <div class="kpi"><b data-testid="kpi-models">${cars.length}</b><span>${t().kModels}</span></div>
      <div class="kpi"><b data-testid="kpi-production">${n('production')}</b><span>${t().kProd}</span></div>
      <div class="kpi"><b data-testid="kpi-discontinued">${n('discontinued')}</b><span>${t().kDisc}</span></div>
      <div class="kpi wide"><b data-testid="kpi-sales">${num(sum)}</b><span>${t().kSales}</span><small>${t().kSalesTip}</small></div>
    </div>
    <div class="charts">
      <figure class="chart" data-testid="chart"><figcaption>${t().cSales}</figcaption>${bars(withSales, c => c.sales.units, c => num(c.sales.units), 'bar a')}</figure>
      <figure class="chart" data-testid="chart"><figcaption>${t().cPrice}</figcaption>${bars(withPrice, c => c.price.usd, c => '$' + num(c.price.usd), 'bar b')}</figure>
      <figure class="chart span" data-testid="chart"><figcaption>${t().cTime}</figcaption>${timeline()}</figure>
    </div>
    <p class="mut small hintline">${t().sortHint}</p>
    <div class="tablewrap"><table class="tbl">
      <thead><tr><th>${t().model}</th><th>${t().designer}</th>${th('year', t().year)}${th('price', t().price)}<th>${t().status}</th>${th('sales', t().sales)}</tr></thead>
      <tbody>${rows.map(c => `<tr data-testid="row" data-id="${c.id}" data-status="${c.status}">
        <td><a href="#/car/${c.id}">${esc(c.name[l])}</a></td><td>${esc(c.designer[l])}</td><td>${c.unveilYear}</td>
        <td>${usd(c)}</td><td><i class="dot ${c.status}"></i>${t().st[c.status]}</td><td>${salesHtml(c)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  A.ready = true;
}
function credits() {
  const l = L(), FK = { designer: t().designer, unveilYear: t().year, price: t().price, status: t().status, sales: t().sales, dims: t().dims };
  app.className = 'page-cred';
  app.innerHTML = `<h1 class="title">${t().credTitle}</h1><p class="mut lead">${t().credSub}</p><div class="creds">${cars.map(c => `
    <article class="cred" data-testid="credit" data-id="${c.id}"><h2>${esc(c.name[l])}</h2>
      <p>${c.model.origin === 'community' ? c.model.sources.map(s => `${t().author}：${esc(s.author)} · ${t().license}：${esc(s.license)} · <a href="${esc(s.url)}" target="_blank" rel="noopener">Sketchfab ↗</a>`).join('<br>') : t().self}</p>
      <p class="mut small">${t().facts}：${Object.keys(c.facts).flatMap(k => srcs(c.facts[k]).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${FK[k]} ↗</a>`)).join(' · ')}</p>
    </article>`).join('')}</div>`;
  A.ready = true;
}

function route() {
  A.ready = false; if (view) { view.dispose(); view = null; } carState = null; chrome();
  const h = location.hash || '#/', m = /^#\/car\/([a-z0-9-]+)$/.exec(h);
  if (m) car(m[1]); else if (h === '#/dashboard') dash(); else if (h === '#/credits') credits(); else home();
  scrollTo(0, 0);
}
function rerender() { chrome(); if (carState) carPanel(); else { const y = scrollY; const h = location.hash || '#/'; if (h === '#/dashboard') dash(); else if (h === '#/credits') credits(); else home(); scrollTo(0, y); } }

$('#lang').addEventListener('click', () => { root.lang = L() === 'en' ? 'zh-CN' : 'en'; save('atlas-lang', root.lang); rerender(); });
$('#theme').addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; save('atlas-theme', root.dataset.theme); if (view) view.mark(); });
app.addEventListener('click', e => { const b = e.target.closest('[data-testid=sort]'); if (!b) return; const k = b.dataset.key; sort = { key: k, dir: sort.key === k ? -sort.dir : -1 }; dash(); });
addEventListener('hashchange', route);

cars = await (await fetch('data/cars.json')).json();
route();
