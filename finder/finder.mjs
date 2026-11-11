// RestoHunter lead finder. Runs on GitHub Actions (Node 20, no packages).
// Finds businesses on OpenStreetMap, reads each business's own website, and returns up to 5 leads whose
// email is printed on that website and whose domain has MX records, plus one problem visible on the site.
// Every business it checks is remembered in finder/history.json, so no business is ever given twice.
//
// usage: node finder/finder.mjs <countryCode> "<business type>" <requestId>
import fs from 'node:fs';
import { promises as dns } from 'node:dns';

const [CC, TYPE, REQUEST_ID] = process.argv.slice(2);
const WANT = 5;
const MAX_CHECK = 250;                 // websites checked per request at most
const TIME_BUDGET_MS = 6 * 60 * 1000;
const PARALLEL = 12;
const HISTORY = 'finder/history.json';
const RESULTS_DIR = 'finder/results';
const NOW = new Date();

const COUNTRIES = {
  US: { name: 'United States', cities: [['New York', 40.7128, -74.006], ['Los Angeles', 34.0522, -118.2437], ['Chicago', 41.8781, -87.6298], ['Houston', 29.7604, -95.3698],
    ['Austin', 30.2672, -97.7431], ['Miami', 25.7617, -80.1918], ['Seattle', 47.6062, -122.3321], ['Denver', 39.7392, -104.9903], ['Boston', 42.3601, -71.0589], ['Atlanta', 33.749, -84.388],
    ['Portland', 45.5152, -122.6784], ['San Diego', 32.7157, -117.1611], ['Philadelphia', 39.9526, -75.1652], ['Dallas', 32.7767, -96.797], ['Phoenix', 33.4484, -112.074]] },
  GB: { name: 'United Kingdom', cities: [['London', 51.5074, -0.1278], ['Manchester', 53.4808, -2.2426], ['Birmingham', 52.4862, -1.8904], ['Leeds', 53.8008, -1.5491],
    ['Glasgow', 55.8642, -4.2518], ['Liverpool', 53.4084, -2.9916], ['Bristol', 51.4545, -2.5879], ['Edinburgh', 55.9533, -3.1883], ['Sheffield', 53.3811, -1.4701],
    ['Nottingham', 52.9548, -1.1581], ['Cardiff', 51.4816, -3.1791], ['Newcastle', 54.9783, -1.6178], ['Brighton', 50.8225, -0.1372]] },
  CA: { name: 'Canada', cities: [['Toronto', 43.6532, -79.3832], ['Vancouver', 49.2827, -123.1207], ['Montreal', 45.5017, -73.5673], ['Calgary', 51.0447, -114.0719],
    ['Ottawa', 45.4215, -75.6972], ['Edmonton', 53.5461, -113.4938], ['Winnipeg', 49.8951, -97.1384], ['Halifax', 44.6488, -63.5752], ['Victoria', 48.4284, -123.3656], ['Quebec City', 46.8139, -71.208]] },
  KW: { name: 'Kuwait', cities: [['Kuwait City', 29.3759, 47.9774], ['Hawalli', 29.3328, 48.0286], ['Salmiya', 29.3339, 48.0761], ['Farwaniya', 29.2775, 47.9586],
    ['Fahaheel', 29.0825, 48.1303], ['Jahra', 29.3375, 47.6581]] },
  OM: { name: 'Oman', cities: [['Muscat', 23.588, 58.3829], ['Seeb', 23.6703, 58.1891], ['Sohar', 24.347, 56.709], ['Salalah', 17.0151, 54.0924],
    ['Nizwa', 22.9333, 57.5333], ['Sur', 22.5667, 59.5289]] },
  BH: { name: 'Bahrain', cities: [['Manama', 26.2285, 50.586], ['Muharraq', 26.2572, 50.6119], ['Riffa', 26.13, 50.555], ['Isa Town', 26.1736, 50.5478],
    ['Hamad Town', 26.1153, 50.5069]] }
};
const NB = '[!"brand"][!"brand:wikidata"]';
const TYPES = {
  'All businesses': [`["shop"]${NB}`, `["office"]${NB}["office"!~"government|diplomatic|association|ngo|educational_institution|religion|political|union|foundation|charity|telecommunication"]`,
    `["craft"]${NB}`, `["healthcare"]${NB}["healthcare"!~"hospital"]`, `["tourism"~"^(hotel|guest_house|apartment|motel)$"]${NB}`, `["leisure"~"^(fitness_centre|sports_centre|dance|spa)$"]${NB}`,
    `["amenity"~"^(dentist|clinic|doctors|veterinary|car_rental|driving_school|restaurant|cafe|fast_food|ice_cream|events_venue|car_wash|language_school|music_school|childcare)$"]${NB}`],
  'Restaurant': [`["amenity"="restaurant"]${NB}`],
  'Cafe': [`["amenity"="cafe"]${NB}`],
  'Bakery': [`["shop"="bakery"]${NB}`],
  'Fast food': [`["amenity"="fast_food"]${NB}`],
  'Burger': [`["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"burger"]${NB}`],
  'Pizza': [`["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"pizza"]${NB}`],
  'Seafood': [`["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"seafood|fish"]${NB}`],
  'Dessert shop': [`["shop"~"^(confectionery|pastry|chocolate)$"]${NB}`, `["amenity"="ice_cream"]${NB}`, `["amenity"~"^(cafe|restaurant)$"]["cuisine"~"dessert|ice_cream|frozen_yogurt|waffle|crepe"]${NB}`],
  'Juice bar': [`["amenity"~"^(cafe|fast_food|bar)$"]["cuisine"~"juice|smoothie|bubble_tea"]${NB}`],
  'Catering': [`["craft"="caterer"]${NB}`, `["shop"="catering"]${NB}`],
  'Salon & beauty': [`["shop"~"^(hairdresser|beauty|cosmetics|nails|massage)$"]${NB}`, `["leisure"="spa"]${NB}`],
  'Clinic & dentist': [`["amenity"~"^(dentist|clinic|doctors)$"]${NB}`, `["healthcare"~"^(dentist|clinic|doctor|physiotherapist|optometrist)$"]${NB}`],
  'Gym & fitness': [`["leisure"~"^(fitness_centre|sports_centre)$"]${NB}`],
  'Hotel': [`["tourism"~"^(hotel|guest_house|motel)$"]${NB}`],
  'Shop & retail': [`["shop"]["shop"!~"^(supermarket|convenience|kiosk|fuel|car|car_parts)$"]${NB}`],
  'Office & services': [`["office"~"^(company|accountant|lawyer|estate_agent|architect|consulting|it|advertising_agency|insurance|travel_agent|financial|employment_agency)$"]${NB}`]
};
const FOOD_TYPES = new Set(['Restaurant', 'Cafe', 'Bakery', 'Fast food', 'Burger', 'Pizza', 'Seafood', 'Dessert shop', 'Juice bar', 'Catering']);
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const COMMISSION = '15–35% commission on every app order (industry estimates; delivery apps do not publish their rates)';

const LINK_IN_BIO = /^(linktr\.ee|beacons\.ai|taplink\.(cc|at)|lnk\.bio|bio\.link|linkin\.bio|campsite\.bio|solo\.to|linkr\.bio|msha\.ke|[a-z0-9-]*\.?carrd\.co|bio\.site|tap\.bio|allmylinks\.com|linkpop\.com|hoo\.be|snipfeed\.co|komi\.io|stan\.store)$/i;
const SOCIAL_ONLY = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|twitter\.com|x\.com|snapchat\.com|wa\.me|whatsapp\.com|google\.com|goo\.gl|g\.page|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|zomato\.com|talabat\.com|deliveroo\.[a-z.]+|ubereats\.com|doordash\.com)$/i;
const BIG_BRAND = /(huawei|samsung|apple|microsoft|google|amazon|ikea|hsbc|barclays|lloyds|natwest|santander|tesco|sainsbury|asda|boots|nhs\.uk|\.gov|gov\.|mcdonalds|kfc|starbucks|costa|subway|greggs|x-?cite|ooredoo|omantel|zain\.com|the-avenues|walmart|target\.com|costco|homedepot|lowes|bestbuy|cvs\.com|walgreens|marriott|hilton|hyatt|ihg\.com|accor)/i;
const DELIVERY = [['Talabat', /talabat\./i], ['Deliveroo', /deliveroo\./i], ['Uber Eats', /ubereats\.com|uber\.com\/[^"'\s]*eats/i], ['DoorDash', /doordash\.com/i],
  ['Grubhub', /grubhub\.com/i], ['Jahez', /jahez\./i], ['Keeta', /keeta(food)?\./i], ['HungerStation', /hungerstation\./i], ['Careem', /careem\.com/i],
  ['Just Eat', /just-?eat\./i], ['SkipTheDishes', /skipthedishes\./i], ['Postmates', /postmates\./i], ['Seamless', /seamless\.com/i], ['Menulog', /menulog\./i],
  ['foodpanda', /foodpanda\./i], ['Toters', /toters(api)?\./i]];
const OWN_ORDERING = /ordable|toasttab\.com|chownow\.com|square\.site|squareup\.com\/[^"'\s]*order|olo\.com|gloriafood|fbgcdn\.com|menufy\.com|slicelife\.com|owner\.com|popmenu\.com\/[^"'\s]*order|clover\.com\/online-ordering|flipdish|foodbooking\.com|order\.online|orderonline|getbento\.com\/[^"'\s]*order|tryotter|kukd\.com|foodhub\.co|touch2success|orderswift|slerp\.com|orderyoyo|deliverect|cdn\.shopify\.com|myshopify\.com|woocommerce|ecwid|bigcommerce|add[\s-]*to[\s-]*(cart|basket|bag)/i;
const BOOKING = /opentable|resy\.com|sevenrooms|exploretock|quandoo|thefork|eatapp|eat-app|tablein|resdiary|designmynight|bookatable|tablecheck|book\s*a\s*table|reserve\s*a\s*table|make\s*a\s*reservation|table\s*booking|reservations?\b/i;
const FORM_TOOLS = /<form|typeform|jotform|docs\.google\.com\/forms|forms\.gle|hsforms|hs-form|hubspot|wufoo|cognitoforms|formstack|formspree|wpcf7|contact-form|gform|wpforms|ninja-forms|fluentform|elementor-form|netlify|forms\.office|zoho\.com\/forms|123formbuilder|getform|formsubmit|tally\.so|paperform|calendly|wix-forms|squarespace|form-block/i;
const PLACEHOLDER = [[/lorem ipsum/i, 'lorem ipsum'], [/under construction/i, 'under construction'], [/just another wordpress site/i, 'Just another WordPress site'],
  [/\bsample page\b/i, 'Sample Page'], [/\bhello world!/i, 'Hello world!'], [/your (company|business|restaurant) name here/i, 'your company name here']];
const I18N_KEY = />\s*((?:nav|menu|home|header|footer|common|button|btn|label|title|page|general|cart|checkout)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*</i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMAIL_JUNK = /\.(png|jpe?g|gif|svg|webp|bmp|ico|css|js)$|@(example\.|sentry|.*wixpress\.com$|.*sentry\.io$)|^(no-?reply|donotreply|do-not-reply)@|@(domain|yourdomain|email|mysite|website|company)\.com$/i;
const BAD_LOCAL = /^(press|pr|media|careers?|jobs|recruit\w*|hr|privacy|gdpr|dpo|data\w*|accounts?|finance|invoices?|billing|marketing|webmaster|admin|legal|abuse|postmaster|hostmaster|security|support|x?support|investors?|wholesale|donations?|name|user|email|your\.?name|firstname\.?lastname)$/i;
const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|msn|aol|proton|protonmail)\.[a-z.]+$/i;
const GENERIC = ['info', 'hello', 'contact', 'enquiries', 'enquiry', 'office', 'sales', 'orders', 'order', 'reservations', 'reservation', 'bookings', 'booking', 'catering', 'events', 'team', 'eat', 'mail', 'reception'];

const host = u => { const m = String(u || '').trim().match(/^(?:[a-z]+:\/\/)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const normUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'http://' + u; return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; };
const visible = h => String(h || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function emailsIn(html) {
  let t = String(html || '');
  try { t = decodeURIComponent(t.replace(/%(?![0-9a-f]{2})/gi, '%25')); } catch { }
  t = t.replace(/&#64;|&#x40;/gi, '@');
  const found = new Set((t.match(EMAIL) || []).map(e => e.toLowerCase().replace(/\.+$/, '')));
  for (const m of String(html).match(/data-cfemail="([0-9a-f]+)"/gi) || []) {
    const h = m.split('"')[1]; const k = parseInt(h.slice(0, 2), 16); let out = '';
    for (let i = 2; i < h.length; i += 2) out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16) ^ k);
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(out)) found.add(out.toLowerCase());
  }
  return [...found];
}

function nameSimilarity(a, b) {
  const base = d => String(d).toLowerCase().replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/g, '');
  const grams = w => { const g = []; for (let i = 0; i < w.length - 1; i++) g.push(w.slice(i, i + 2)); return g; };
  const x = grams(base(a)), y = grams(base(b)); if (!x.length || !y.length) return 0;
  const pool = [...y]; let hit = 0; x.forEach(g => { const i = pool.indexOf(g); if (i >= 0) { hit++; pool.splice(i, 1); } });
  return 2 * hit / (x.length + y.length);
}

// The business's own email: printed on its site, on its own domain or a personal mailbox, or a closely matching mailto.
function pickEmail(pages, siteHost) {
  const all = []; pages.forEach(p => emailsIn(p.html).forEach(e => all.push({ email: e, url: p.url })));
  if (!all.length) return { reason: 'no email' };
  const seen = new Set();
  let ok = all.filter(x => { if (seen.has(x.email)) return false; seen.add(x.email); return !EMAIL_JUNK.test(x.email) && !BAD_LOCAL.test(x.email.split('@')[0]); });
  const h = String(siteHost || '').replace(/^www\./, '');
  const same = e => { const d = e.split('@')[1]; return h && (d === h || d.endsWith('.' + h) || h.endsWith('.' + d)); };
  const mailtos = new Set(); pages.forEach(p => (String(p.html).match(/mailto:[^"'?\s>]+/gi) || []).forEach(m => mailtos.add(m.slice(7).toLowerCase())));
  ok = ok.filter(x => same(x.email) || FREE_MAIL.test(x.email.split('@')[1]) || (h && mailtos.has(x.email) && nameSimilarity(x.email.split('@')[1], h) >= 0.6));
  if (!ok.length) return { reason: 'email rejected' };
  const rank = e => { const i = GENERIC.indexOf(e.split('@')[0]); return i < 0 ? 99 : i; };
  ok.sort((a, b) => (same(b.email) - same(a.email)) || (rank(a.email) - rank(b.email)));
  return { email: ok[0].email, url: ok[0].url };
}

// One problem a visitor can see on the site, or {skip}. Nothing is claimed about pages we could not read.
function weakness(pages, siteUrl, finalUrl, isLinkInBio, name, food) {
  if (isLinkInBio) return { problem: 'having only a link-in-bio page instead of a website', financialLeak: '', offer: 'a proper website (website offer)', evidence: `The website link is a link-in-bio page (${siteUrl}), not a website of its own.` };
  const html = pages.map(p => p.html).join('\n'); const text = visible(html); const hrefs = (html.match(/href\s*=\s*["'][^"']+["']/gi) || []).join(' ');
  const hostName = host(finalUrl || siteUrl);
  if (text.trim().length < 400 || /enable javascript|checking your browser|just a moment|one moment, please|verify you are (a )?human|attention required|access denied|request is being verified|captcha/i.test(text)) return { skip: 'website not readable' };
  const STOP = /^(the|and|restaurant|restaurants|cafe|café|coffee|kitchen|grill|house|bakery|pizza|pizzeria|burger|burgers|bar|lounge|shop|store|food|foods|dining|centre|center|bistro|express|branch|co|ltd|llc|inc|company|services|clinic|salon|studio|hotel)$/i;
  const tokens = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(t => t.length >= 4 && !STOP.test(t));
  const low = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (tokens.length && !tokens.some(t => low.includes(t) || hostName.includes(t))) return { skip: "website is not the business's own" };

  for (const [re, label] of PLACEHOLDER) if (re.test(text)) return { problem: `placeholder text left on your website ("${label}")`, financialLeak: '', offer: 'website clean-up and refresh', evidence: `The site shows template text "${label}".` };
  const key = html.match(I18N_KEY);
  if (key) return { problem: `placeholder text left on your website ("${key[1]}")`, financialLeak: '', offer: 'website clean-up and refresh', evidence: `The site shows a raw translation key "${key[1]}" instead of real text.` };

  const ownLink = (hrefs.match(/href\s*=\s*["'][^"']+["']/gi) || []).some(hh => {
    const u = hh.replace(/^href\s*=\s*["']|["']$/gi, ''); const uh = host(u.startsWith('/') ? (finalUrl || siteUrl) : u);
    return (uh === hostName || uh.endsWith('.' + hostName) || u.startsWith('/')) && (/^order\./i.test(uh) || /\/order(s|-online|ing)?(\/|$|\?|#)/i.test(u));
  });
  const ownOrdering = ownLink || OWN_ORDERING.test(html);
  if (food) {
    const apps = DELIVERY.filter(([, re]) => re.test(hrefs)).map(([n]) => n);
    if (apps.length && !ownOrdering) return { problem: 'relying on delivery apps for online orders', financialLeak: COMMISSION, offer: 'own commission-free online ordering', evidence: `Website links to ${apps.join(', ')} for orders; no ordering system of its own found.` };
  }
  const years = (text.match(/(?:©|copyright)\s*(?:(?:19|20)\d{2}\s*[-–]\s*)?((?:19|20)\d{2})/gi) || []).map(m => Number((m.match(/((?:19|20)\d{2})\s*$/) || [])[1])).filter(Boolean);
  const newest = years.length ? Math.max(...years) : 0; const old = newest && NOW.getFullYear() - newest >= 4;
  if (food && !ownOrdering && !BOOKING.test(text) && !BOOKING.test(hrefs)) {
    return { problem: 'the missing online ordering and table booking on your website' + (old ? ` (last updated in ${newest})` : ''), financialLeak: '', offer: 'online ordering and table booking',
      evidence: 'No online ordering and no table booking found on the home or contact pages' + (old ? `; newest © year is ${newest}.` : '.') };
  }
  if (!/<meta[^>]+name=["']viewport["']/i.test(pages[0].html)) return { problem: 'no mobile-friendly version of your website', financialLeak: '', offer: 'mobile-friendly website', evidence: 'Homepage has no viewport setting, so it does not adapt to phone screens.' };
  if (/^http:\/\//i.test(finalUrl || '')) return { problem: 'no HTTPS on your website', financialLeak: '', offer: 'secure (HTTPS) website', evidence: `Homepage loads over plain HTTP (${finalUrl}); browsers mark it "Not secure".` };
  if (old) return { problem: `an outdated website (last updated in ${newest})`, financialLeak: '', offer: 'website refresh', evidence: `Newest © year on the site is ${newest}.` };
  if (!FORM_TOOLS.test(html)) return { problem: 'no online enquiry form on your website', financialLeak: '', offer: 'online enquiry or booking form', evidence: 'No form on the home or contact pages; visitors must call or email.' };
  return { skip: food && ownOrdering ? 'own ordering' : 'no visible weakness' };
}

async function get(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', 'Accept-Language': 'en' } });
    if (!r.ok) return null;
    return { url: r.url, html: (await r.text()).slice(0, 900000) };
  } catch { return null; }
}
async function hasMx(domain) { try { return (await dns.resolveMx(domain)).length > 0; } catch { return false; } }
async function overpass(lat, lon) {
  const parts = TYPES[TYPE].map(f => `nwr(around:12000,${lat},${lon})["name"]${f};`).join('');
  const q = `[out:json][timeout:60];(${parts});out tags center 600;`;
  for (const ep of OVERPASS) {
    try {
      const r = await fetch(ep, { method: 'POST', body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(90000), headers: { 'User-Agent': 'restohunter-lead-finder/1.0' } });
      if (r.ok) return (await r.json()).elements || [];
    } catch { }
  }
  throw new Error('map search failed on all servers');
}

async function checkOne(c, known) {
  const site = normUrl(c.website); const h = host(site);
  if (!site || SOCIAL_ONLY.test(h)) return { result: 'no website' };
  if (BIG_BRAND.test(h)) return { result: 'big brand' };
  if (known.hosts.has(h) && !LINK_IN_BIO.test(h)) return { result: 'already given' };
  const lib = LINK_IN_BIO.test(h);
  const home = await get(site);
  if (!home) return { result: 'website not loading' };
  const pages = [home];
  if (!lib && !pickEmail(pages, host(home.url)).email) {
    const base = home.url.replace(/[?#].*$/, '').replace(/\/+$/, '');
    for (const p of await Promise.all(['/contact', '/contact-us'].map(x => get(base + x)))) if (p) pages.push(p);
  }
  const pick = pickEmail(pages, lib ? '' : host(home.url));
  if (!pick.email) return { result: pick.reason };
  if (known.emails.has(pick.email)) return { result: 'already given', email: pick.email };
  const w = weakness(pages, site, home.url, lib, c.name, FOOD_TYPES.has(TYPE) || /restaurant|cafe|fast_food|bakery|ice_cream|caterer|confectionery|pastry/.test(c.category));
  if (w.skip) return { result: w.skip, email: pick.email };
  if (!(await hasMx(pick.email.split('@')[1]))) return { result: 'email rejected', email: pick.email };
  return { result: 'added', email: pick.email, lead: { website: home.url, emailFoundOn: pick.url, ...w } };
}

async function main() {
  if (!COUNTRIES[CC] || !TYPES[TYPE]) throw new Error(`Unknown country "${CC}" or business type "${TYPE}"`);
  const started = Date.now();
  const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : { checked: {}, cityIndex: {} };
  const known = { emails: new Set(), hosts: new Set() };
  for (const f of ['data/leads.json', 'data/leads_pending.json']) {
    if (!fs.existsSync(f)) continue;
    for (const l of JSON.parse(fs.readFileSync(f, 'utf8'))) { if (l.email) known.emails.add(String(l.email).toLowerCase()); if (l.website) known.hosts.add(host(l.website)); }
  }
  for (const v of Object.values(history.checked)) { if (v.email) known.emails.add(v.email); if (v.website && v.result === 'added') known.hosts.add(host(v.website)); }

  const country = COUNTRIES[CC]; const cityKey = `${CC}|${TYPE}`;
  let cityIdx = history.cityIndex[cityKey] || 0;
  const leads = [], details = [];
  let citiesTried = 0;
  while (leads.length < WANT && citiesTried < country.cities.length && details.length < MAX_CHECK && Date.now() - started < TIME_BUDGET_MS) {
    const [city, lat, lon] = country.cities[cityIdx % country.cities.length];
    let els = [];
    try { els = await overpass(lat, lon); } catch (e) { console.error(city, e.message); }
    const cands = els.map(e => ({ id: `osm:${e.type}/${e.id}`, name: String((e.tags || {})['name:en'] || (e.tags || {}).name || '').trim(),
      website: (e.tags || {}).website || (e.tags || {})['contact:website'] || '', category: Object.entries(e.tags || {}).find(([k]) => ['shop', 'office', 'craft', 'healthcare', 'tourism', 'leisure', 'amenity'].includes(k))?.join('=') || '' }))
      .filter(c => c.name && !history.checked[c.id])
      .sort((a, b) => (!!b.website) - (!!a.website));
    if (!cands.length) { cityIdx++; citiesTried++; continue; }   // this city is used up: next city
    for (let i = 0; i < cands.length && leads.length < WANT && details.length < MAX_CHECK && Date.now() - started < TIME_BUDGET_MS; i += PARALLEL) {
      const batch = cands.slice(i, i + PARALLEL);
      const res = await Promise.all(batch.map(c => checkOne(c, known)));
      batch.forEach((c, j) => {
        const r = res[j];
        if (r.result === 'added') {
          if (leads.length >= WANT || known.emails.has(r.email)) return;      // left unrecorded: a later request can give it
          known.emails.add(r.email); known.hosts.add(host(r.lead.website));
          leads.push({ businessName: c.name, email: r.email, website: r.lead.website, city, country: country.name, countryCode: CC, businessType: TYPE === 'All businesses' ? c.category.split('=')[1]?.replace(/_/g, ' ') || 'business' : TYPE,
            problem: r.lead.problem, financialLeak: r.lead.financialLeak, offer: r.lead.offer, evidence: r.lead.evidence, emailFoundOn: r.lead.emailFoundOn, source: `OpenStreetMap ${c.id.slice(4)}` });
        }
        history.checked[c.id] = { name: c.name, country: CC, type: TYPE, city, website: c.website, result: r.result, email: r.email || '', at: NOW.toISOString() };
        details.push({ name: c.name, result: r.result });
      });
    }
    if (leads.length < WANT) { cityIdx++; citiesTried++; }
  }
  history.cityIndex[cityKey] = cityIdx;
  fs.writeFileSync(HISTORY, JSON.stringify(history));
  const skipped = {}; details.filter(d => d.result !== 'added').forEach(d => { skipped[d.result] = (skipped[d.result] || 0) + 1; });
  const out = { requestId: REQUEST_ID, country: country.name, type: TYPE, finishedAt: new Date().toISOString(), checked: details.length, skipped, leads };
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(`${RESULTS_DIR}/${REQUEST_ID}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ added: leads.length, checked: details.length, skipped }));
}

export { pickEmail, weakness, emailsIn, nameSimilarity };
if (process.argv[1] && process.argv[1].endsWith('finder.mjs') && CC) main().catch(e => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(`${RESULTS_DIR}/${REQUEST_ID}.json`, JSON.stringify({ requestId: REQUEST_ID, error: e.message, leads: [] }));
  console.error(e); process.exit(1);
});
