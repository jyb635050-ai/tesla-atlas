// 生成 data/cars.json。事实都在这里改；模型信息（来源、是否简化、有无内饰）读 models/meta.json（没有就按自建简化模型算）。
// 用法：node tools/build_cars.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = n => 'https://en.wikipedia.org/wiki/' + n;
const FRANZ = { zh: '弗朗茨·冯·霍尔茨豪森', en: 'Franz von Holzhausen' };
const f = (source, quote) => ({ source, quote });
const P = { // 官方车漆名（S/3/X/Y 通用色）；hex 为近似值
  white: ['珍珠白', 'Pearl White Multi-Coat', '#f2f3f4'], black: ['纯黑', 'Solid Black', '#0c0d0f'], blue: ['深海蓝金属漆', 'Deep Blue Metallic', '#1a3a7a'],
  grey: ['星空灰', 'Stealth Grey', '#44474c'], red: ['烈焰红', 'Ultra Red', '#a50f1c'], silver: ['快银', 'Quicksilver', '#b9bcc0'],
};
const pal = (...ids) => ids.map(id => ({ id, name: { zh: P[id][0], en: P[id][1] }, hex: P[id][2], official: true }));
const col = (id, zh, en, hex, official = true) => ({ id, name: { zh, en }, hex, official });
const demo = [col('silver', '银（展示用配色）', 'Silver (display color)', '#c4c7cb', false), col('white', '白（展示用配色）', 'White (display color)', '#f1f1f1', false), col('black', '黑（展示用配色）', 'Black (display color)', '#101113', false)];

const CARS = [
  { id: 'roadster-2008', name: { zh: 'Roadster（初代）', en: 'Roadster (2008)' }, kind: 'production', variant: { zh: '2008 款', en: '2008 model' },
    designer: { zh: '巴尼·哈特（莲花设计工作室）', en: 'Barney Hatt' }, unveilYear: 2006, deliveryYear: 2008,
    price: { usd: 98950, note: { zh: 'Roadster 1.5（首批量产款）起售价', en: 'Base price of the Roadster 1.5, the first production version' } },
    status: 'discontinued', sales: { units: 2418, kind: 'official', asOf: '2012-09', note: { zh: '截至 2012 年 9 月全球售出「超过」此数', en: '"More than" this many sold worldwide through Sept 2012' } },
    dims: { l: 3946, w: 1873, h: 1127 }, doors: ['fl', 'fr'],
    colors: [col('red', '聚变红', 'Fusion Red', '#b1121b'), col('green', '赛车绿', 'Racing Green', '#0f3d2a'), col('white', '极地白', 'Arctic White', '#f3f3f1'), col('blue', '电光蓝', 'Electric Blue', '#1f4fb0'), col('black', '曜石黑', 'Obsidian Black', '#0d0e10')],
    facts: {
      designer: f(W('The_Index_Project'), 'Elon Musk, Martin Eberhard and Barney Hatt - "Tesla Roadster"'),
      unveilYear: f(W('Tesla_Roadster_(first_generation)'), 'Prototypes of the car were officially revealed to the public on July 19, 2006'),
      price: f(W('Tesla_Roadster_(first_generation)'), 'Base price $80,000–$120,000 $98,950 $109,000'),
      status: f(W('Tesla_Roadster_(first_generation)'), 'Tesla ended production of the Roadster in January 2012.'),
      sales: f(W('Tesla_Roadster_(first_generation)'), 'More than 2,418 units were sold worldwide through September 2012.'),
      dims: f(W('Tesla_Roadster_(first_generation)'), ['Length 155.4 in (3,946 mm)', 'Width 73.7 in (1,873 mm)', 'Height 44.4 in (1,127 mm)']),
    } },
  { id: 'model-s', name: { zh: 'Model S', en: 'Model S' }, kind: 'production', variant: { zh: '尺寸取维基百科所列', en: 'Dimensions as listed on Wikipedia' },
    designer: FRANZ, unveilYear: 2009, deliveryYear: 2012,
    price: { usd: 49900, note: { zh: '2012 年 40 kWh 基础款，已扣除美国联邦税收抵免', en: '2012 base 40 kWh model, after the US federal tax credit' } },
    status: 'discontinued', sales: { units: null, kind: 'none', asOf: null }, dims: { l: 4980, w: 1960, h: 1440 }, doors: ['fl', 'fr', 'rl', 'rr'],
    colors: pal('white', 'black', 'blue', 'grey', 'red', 'silver'),
    facts: {
      designer: f(W('Tesla_Model_S'), 'Designer Franz von Holzhausen (2008)'),
      unveilYear: f(W('Tesla_Model_S'), 'Tesla unveiled a prototype of the vehicle in March 2009 in Hawthorne, California.'),
      price: f('https://www.autoguide.com/auto-news/2011/12/tesla-model-s-priced-from-49900.html', 'The Tesla will have a base price of $49,900 after federal tax credits.'),
      status: f(W('Tesla_Model_S'), 'Tesla ended production of the car in May 2026.'),
      dims: f(W('Tesla_Model_S'), ['Length 196.1–197.7 in (4,980–5,021 mm)', 'Width 77.3 in (1,960 mm)', 'Height 56.5 in (1,440 mm)']),
    } },
  { id: 'model-x', name: { zh: 'Model X', en: 'Model X' }, kind: 'production', variant: { zh: '尺寸取维基百科所列', en: 'Dimensions as listed on Wikipedia' },
    designer: FRANZ, unveilYear: 2012, deliveryYear: 2015,
    price: { usd: 132000, note: { zh: '2015 年首发 Signature 限量版起价（标准版当时未单独公布）', en: 'Launch-edition Signature price in 2015' } },
    status: 'discontinued', sales: { units: 106689, kind: 'official', asOf: '2018-09', note: { zh: '只查到截至 2018 年 9 月的累计数，之后未见单车型口径', en: 'Latest per-model cumulative figure found (through Sept 2018)' } },
    dims: { l: 5036, w: 1999, h: 1684 }, doors: ['fl', 'fr', 'rl', 'rr'], colors: pal('white', 'black', 'blue', 'grey', 'red', 'silver'),
    facts: {
      designer: f(W('Tesla_Model_X'), 'Designer Franz von Holzhausen'),
      unveilYear: f(W('Tesla_Model_X'), "The prototype was unveiled at Tesla's design studios in Hawthorne, California, on February 9, 2012."),
      price: f(W('Tesla_Model_X'), 'Pricing for the limited edition Signature version of the Model X varies between US$132,000 and US$144,000'),
      status: f(W('Tesla_Model_X'), 'built by Tesla, Inc. from 2015 to 2026'),
      sales: f(W('Tesla_Model_X'), 'Global cumulative sales since inception totaled 106,689 units through September 2018.'),
      dims: f(W('Tesla_Model_X'), ['Length 198.3 in (5,036 mm)', 'Width 78.7 in (1,999 mm)', 'Height 66.3 in (1,684 mm)']),
    } },
  { id: 'model-3', name: { zh: 'Model 3', en: 'Model 3' }, kind: 'production', variant: { zh: '2017–2023 款（改款前）', en: '2017–2023 (pre-facelift)' },
    designer: FRANZ, unveilYear: 2016, deliveryYear: 2017,
    price: { usd: 35000, note: { zh: '标准续航版起售价（2019 年 2 月开放订购）', en: 'Standard Range price (orderable from Feb 2019)' } },
    status: 'production', sales: { units: 3502363, kind: 'estimate', asOf: '2026-06' }, dims: { l: 4694, w: 1849, h: 1443 }, doors: ['fl', 'fr', 'rl', 'rr'],
    colors: pal('white', 'black', 'blue', 'grey', 'red', 'silver'),
    facts: {
      designer: f(W('Tesla_Model_3'), 'Designer Franz von Holzhausen'),
      unveilYear: f(W('Tesla_Model_3'), 'at the unveiling event on March 31, 2016'),
      price: f(W('Tesla_Model_3'), 'Tesla announced the availability of the highly anticipated Standard Range trim priced at $35,000'),
      status: f(W('Tesla_Model_3'), 'Production 2017–present'),
      sales: f('https://cleantechnica.com/2026/07/02/tesla-will-reach-10-million-cumulative-sales-this-quarter/', 'the Tesla Model 3 has reached 3,502,363 cumulative vehicle sales'),
      dims: f(W('Tesla_Model_3'), ['184.8 in (4,694 mm) (pre-facelift)', 'Width 72.8 in (1,849 mm)', '56.8 in (1,443 mm) (pre-facelift)']),
    } },
  { id: 'model-y', name: { zh: 'Model Y', en: 'Model Y' }, kind: 'production', variant: { zh: '2020–2025 款（改款前）', en: '2020–2025 (pre-refresh)' },
    designer: FRANZ, unveilYear: 2019, deliveryYear: 2020,
    price: { usd: 39000, note: { zh: '2019 年发布会公布的标准续航版起售价', en: 'Standard Range price announced at the 2019 unveiling' } },
    status: 'production', sales: { units: 5385508, kind: 'estimate', asOf: '2026-06' }, dims: { l: 4751, w: 1920, h: 1624 }, doors: ['fl', 'fr', 'rl', 'rr'],
    colors: pal('white', 'black', 'blue', 'grey', 'red', 'silver'),
    facts: {
      designer: f(W('Tesla_Model_Y'), 'Designer Franz von Holzhausen'),
      unveilYear: f(W('Tesla_Model_Y'), "Presented in March 2019 as the company's fifth production model"),
      price: f('https://thenextweb.com/news/tesla-unveils-its-model-y-electric-suv-starting-at-39000-and-arriving-next-fall', 'The base variant comes in at $39,000'),
      status: f(W('Tesla_Model_Y'), 'Production January 2020 – present'),
      sales: f('https://cleantechnica.com/2026/07/02/tesla-will-reach-10-million-cumulative-sales-this-quarter/', 'the Tesla Model Y has reached 5,385,508 cumulative vehicle sales'),
      dims: f(W('Tesla_Model_Y'), ['187.0 in (4,751 mm) (2020–2025)', '75.6 in (1,920 mm)', '63.9 in (1,624 mm)']),
    } },
  { id: 'cybertruck', name: { zh: 'Cybertruck', en: 'Cybertruck' }, kind: 'production', variant: { zh: '2023 量产款', en: '2023 production version' },
    designer: FRANZ, unveilYear: 2019, deliveryYear: 2023,
    price: { usd: 60990, note: { zh: '2023 年交付时公布的后驱版起售价（2019 年曾宣布 39,900 美元）', en: 'RWD base price announced at the 2023 delivery event ($39,900 was announced in 2019)' } },
    status: 'production', statusNote: { zh: '维基百科称特斯拉 2026 年 11 月宣布将于 2027 年年中前停产', en: 'Wikipedia: in Nov 2026 Tesla announced production would cease by mid-2027' },
    sales: { units: 27185, kind: 'estimate', asOf: '2024-10', note: { zh: '行业估算，只查到截至 2024 年 10 月的累计数', en: 'Industry estimate; latest cumulative figure found (Oct 2024)' } },
    dims: { l: 5683, w: 2032, h: 1796 }, doors: ['fl', 'fr', 'rl', 'rr'],
    colors: [col('steel', '不锈钢原色', 'Stainless Steel', '#b4b7b9'), col('black', '缎面隐形黑（官方改色膜）', 'Satin Stealth Black (wrap)', '#151617'), col('white', '缎面陶瓷白（官方改色膜）', 'Satin Ceramic White (wrap)', '#eceded')],
    facts: {
      designer: f(W('Tesla_Cybertruck'), 'In June 2023, chief designer Franz von Holzhausen drove an early build Cybertruck'),
      unveilYear: f(W('Tesla_Cybertruck'), 'A Cybertruck concept was unveiled in Los Angeles, California, on November 21, 2019'),
      price: f(W('Tesla_Cybertruck'), 'with an updated base price of US$60,990'),
      status: f(W('Tesla_Cybertruck'), ['Production November 2023 – present', 'In November 2026, Tesla announced they would cease production of the Cybertruck at the Austin, Texas facility that manufactures them by mid-2027']),
      sales: f(W('Tesla_Cybertruck'), 'By October 2024, industry estimates placed cumulative sales at approximately 27,185.'),
      dims: f(W('Tesla_Cybertruck'), ['Length 223.74 in (5,683 mm)', 'Width 79.99 in (2,032 mm)', 'Height 70.7 in (1,796 mm)']),
    } },
  { id: 'semi', name: { zh: 'Semi', en: 'Semi' }, kind: 'production', variant: { zh: '牵引车头', en: 'Tractor unit' },
    designer: FRANZ, unveilYear: 2017, deliveryYear: 2022,
    price: { usd: 150000, note: { zh: '2017 年公布的 300 英里版预计售价', en: 'Projected price of the 300-mile version, announced in 2017' } },
    status: 'production', sales: { units: null, kind: 'none', asOf: null },
    dims: { l: 6325, w: 2591, h: 3962 }, dimsNote: { zh: '官方未公布，采用第三方估算', en: 'Not published by Tesla; third-party estimate' }, doors: ['fl', 'fr'], colors: demo,
    facts: {
      designer: f(W('Franz_von_Holzhausen'), ['Franz von Holzhausen is an American automobile designer.', 'He led the design of the Model S, Model X, Model 3, Model Y, and Semi.']),
      unveilYear: f(W('Tesla_Semi'), 'A concept prototype of the Semi was unveiled at a press conference on November 16, 2017'),
      price: f(W('Tesla_Semi'), 'would be US$150,000 and US$180,000 respectively'),
      status: f(W('Tesla_Semi'), 'Production 2022–present'),
      dims: f('https://www.dimensions.com/element/tesla-semi', 'TO-FILL'),
    } },
  { id: 'cybercab', name: { zh: 'Cybercab', en: 'Cybercab' }, kind: 'production', variant: { zh: '2026 量产款', en: '2026 production version' },
    designer: FRANZ, unveilYear: 2024, deliveryYear: null,
    price: { usd: 30000, note: { zh: '马斯克在发布会上称售价将低于此数（目标价，非正式售价）', en: 'Musk said it would cost less than this (target, not a list price)' } },
    status: 'production', sales: { units: null, kind: 'none', asOf: null },
    dims: { l: 4445, w: 1754, h: 1408 }, dimsNote: { zh: '宽、高为特斯拉官方数据；车长官方未公布，为媒体估算', en: 'Width and height are official; length is a media estimate' }, doors: ['fl', 'fr'],
    colors: [col('gold', '香槟金（发布会配色）', 'Gold (unveiling color)', '#b89b5e', false), col('white', '白（展示用配色）', 'White (display color)', '#f1f1f1', false), col('black', '黑（展示用配色）', 'Black (display color)', '#101113', false)],
    facts: {
      designer: f(W('Tesla_Cybercab'), 'Designer Franz von Holzhausen'),
      unveilYear: f(W('Tesla_Cybercab'), 'Tesla unveiled the Cybercab in October 2024'),
      price: f('https://www.teslarati.com/tesla-robotaxi-price-features-range-release-date', 'will cost less than $30,000'),
      status: f(W('Tesla_Cybercab'), 'Production April 2026 – present'),
      dims: f('https://www.tesla.com/robotaxi/riderguides/cybercab/en_us/GUID-3229BCDF-16D8-447B-BCED-77E3E067AFBB.html', ['Overall Width 69 1754', 'Overall Height 55.4 1408']),
    } },
  { id: 'roadster-next', name: { zh: 'Roadster（新一代）', en: 'Roadster (next gen)' }, kind: 'concept', variant: { zh: '尚未量产', en: 'Not yet in production' },
    designer: FRANZ, unveilYear: 2017, deliveryYear: null,
    price: { usd: 200000, note: { zh: '2017 年亮相时公布的起售价；2026 年重新发布时未公布价格', en: 'Starting price announced in 2017; no price given at the 2026 reveal' } },
    status: 'upcoming', sales: { units: null, kind: 'none', asOf: null }, dims: null, doors: ['fl', 'fr'],
    colors: [col('white', 'Ano 白', 'Ano White', '#f0f0ee'), col('red', '红（2017 原型车配色）', 'Red (2017 prototype)', '#a3121c', false), col('black', '黑（展示用配色）', 'Black (display color)', '#101113', false)],
    facts: {
      designer: f(W('Tesla_Roadster_(second_generation)'), 'Designer Franz von Holzhausen'),
      unveilYear: f(W('Tesla_Roadster_(second_generation)'), 'Unveiled as a concept prototype in 2017'),
      price: f(W('Tesla_Roadster_(second_generation)'), 'at a starting price of US$200,000'),
      status: f(W('Tesla_Roadster_(second_generation)'), 'with production planned for 2028'),
    } },
  { id: 'robovan', name: { zh: 'Robovan', en: 'Robovan' }, kind: 'concept', variant: { zh: '2024 概念车', en: '2024 concept' },
    designer: FRANZ, unveilYear: 2024, deliveryYear: null, price: { usd: null, note: { zh: '概念车，未公布售价', en: 'Concept; no price announced' } },
    status: 'concept', sales: { units: null, kind: 'none', asOf: null }, dims: null, doors: ['sl', 'sr'],
    colors: [col('silver', '银（发布会配色）', 'Silver (unveiling color)', '#c9cbcc', false), col('gold', '金（展示用配色）', 'Gold (display color)', '#b89b5e', false), col('black', '黑（展示用配色）', 'Black (display color)', '#101113', false)],
    facts: {
      designer: f(W('Tesla_Robovan'), 'Designer Franz von Holzhausen'),
      unveilYear: f(W('Tesla_Robovan'), 'A concept version of the autonomous electric Robovan was unveiled on 10 October 2024'),
      status: f(W('Tesla_Robovan'), 'A concept version of the autonomous electric Robovan was unveiled'),
    } },
  { id: 'cyberquad', name: { zh: 'Cyberquad', en: 'Cyberquad' }, kind: 'concept', variant: { zh: '2019 概念全地形车', en: '2019 ATV concept' },
    designer: { zh: '特斯拉（未公布具体设计师）', en: 'Tesla' }, unveilYear: 2019, deliveryYear: null, price: { usd: null, note: { zh: '概念车，未公布售价', en: 'Concept; no price announced' } },
    status: 'concept', sales: { units: null, kind: 'none', asOf: null }, dims: null, doors: [],
    colors: [col('steel', '钢灰（发布会配色）', 'Steel grey (unveiling color)', '#8f9396', false), col('black', '黑（展示用配色）', 'Black (display color)', '#101113', false), col('white', '白（展示用配色）', 'White (display color)', '#f1f1f1', false)],
    facts: {
      designer: f(W('Tesla_Cyberquad'), 'concept presented by Tesla, Inc.'),
      unveilYear: f(W('Tesla_Cyberquad'), "at the Tesla Cybertruck's November 2019 unveiling"),
      status: f(W('Tesla_Cyberquad'), 'is an unreleased electric all-terrain vehicle (ATV) concept'),
    } },
];

let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'models/meta.json'), 'utf8')); } catch (e) { }
for (const c of CARS) if (fs.existsSync(path.join(ROOT, 'assets/posters', c.id + '.webp'))) c.poster = `assets/posters/${c.id}.webp`;
let over = {}; try { over = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/quotes.json'), 'utf8')); } catch (e) { }
for (const c of CARS) {
  c.statusAsOf = '2026-11';
  const m = meta[c.id] || {};
  c.model = { file: `models/${c.id}.glb`, origin: m.origin || 'selfbuilt', simplified: m.simplified ?? true, interior: m.interior ?? (c.id !== 'cyberquad'), sources: m.sources || [] };
  for (const [k, q] of Object.entries(over[c.id] || {})) c.facts[k].quote = q;
}
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/cars.json'), JSON.stringify(CARS, null, 1) + '\n');
console.log('写入 data/cars.json：', CARS.length, '台');
