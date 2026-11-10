/**
 * RestoHunter AI — Lead Finder (second file in the same Apps Script project as Code.gs)
 *
 * What it does:
 *   Pick a country (6) and a business type, press Fetch. It finds up to 5 NEW businesses with Google Places,
 *   opens each business's own website, takes an email shown there, checks the email domain can receive mail,
 *   looks for a weakness that is really visible on the site, and adds the lead to the Leads tab as "ready".
 *   Businesses with no real website (only Instagram / Linktree etc.) get the website offer when an email is found.
 *   A business is never added without an email it shows itself, and never added twice.
 *
 * One-time setup:
 *   1. Apps Script editor → Files → + → Script → name it "LeadFinder" → paste this file → Save.
 *   2. Project Settings (gear) → Script properties → Add: PLACES_API_KEY = your Google Places API (New) key.
 *   3. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone) → Deploy.
 *   4. Run "showAppLink" once and open the link it prints. Keep it private: it can start and stop the engine.
 */

const FINDER = {
  PER_FETCH: 5,              // leads added per Fetch press
  MAX_PLACES_CALLS: 4,       // Google Places requests per Fetch press (each returns up to 20 businesses)
  MAX_SITE_CHECKS: 30,       // websites opened per Fetch press
  BATCH: 8,                  // websites fetched in parallel
  OUTDATED_YEARS: 4,         // "website last updated in YYYY" when the newest © year is this old
  APP_FEE: '15–35% commission on every app order (industry estimates; delivery apps do not publish their rates)',
  COUNTRIES: {
    US: { name: 'United States', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Dallas', 'Austin', 'Miami', 'Atlanta', 'Seattle', 'Denver', 'Boston', 'Phoenix', 'San Diego', 'Philadelphia', 'Nashville'] },
    GB: { name: 'United Kingdom', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Edinburgh', 'Sheffield', 'Leicester', 'Nottingham', 'Cardiff'] },
    CA: { name: 'Canada', cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Mississauga', 'Winnipeg', 'Hamilton', 'Halifax'] },
    KW: { name: 'Kuwait', cities: ['Kuwait City', 'Salmiya', 'Hawalli', 'Farwaniya', 'Fahaheel', 'Jabriya', 'Shuwaikh', 'Mangaf', 'Jahra', 'Mahboula'] },
    OM: { name: 'Oman', cities: ['Muscat', 'Seeb', 'Bawshar', 'Salalah', 'Sohar', 'Nizwa', 'Barka', 'Sur'] },
    BH: { name: 'Bahrain', cities: ['Manama', 'Muharraq', 'Riffa', 'Seef', 'Juffair', 'Adliya', 'Isa Town', 'Hamad Town'] }
  },
  TYPES: ['Restaurant', 'Cafe', 'Bakery', 'Fast food restaurant', 'Burger restaurant', 'Pizza restaurant', 'Seafood restaurant', 'Dessert shop', 'Juice bar', 'Catering']
};

const FINDER_SHEET = 'Finder';   // every business checked, so it is never checked or added twice
const FINDER_HEADERS = ['placeId', 'businessName', 'countryCode', 'type', 'city', 'website', 'result', 'email', 'checkedAt'];

// Link-in-bio pages can be opened and often show an email. Other social pages cannot be read.
const LINK_IN_BIO = /(^|\.)(linktr\.ee|beacons\.ai|taplink\.cc|bio\.link|linkin\.bio|lnk\.bio|campsite\.bio|msha\.ke)$/i;
const SOCIAL_ONLY = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|twitter\.com|x\.com|snapchat\.com|wa\.me|whatsapp\.com|t\.me|youtube\.com|google\.com|business\.site|g\.page|maps\.app\.goo\.gl)$/i;
const DELIVERY_ONLY_HOST = /(^|\.)(talabat\.com|deliveroo\.[a-z.]+|ubereats\.com|doordash\.com|grubhub\.com|just-eat\.[a-z.]+|justeat\.[a-z.]+|skipthedishes\.com|jahez\.net|keeta[a-z-]*\.com|careemnow\.com|snoonu\.com|hungerstation\.com|menulog\.com\.au)$/i;
const DELIVERY_APPS = [['talabat', /talabat\.com/i], ['Deliveroo', /deliveroo\./i], ['Uber Eats', /ubereats\.com/i], ['DoorDash', /doordash\.com/i],
  ['Grubhub', /grubhub\.com/i], ['Just Eat', /just-?eat\./i], ['SkipTheDishes', /skipthedishes\.com/i], ['Jahez', /jahez\./i],
  ['Keeta', /keeta|mykeeta/i], ['Snoonu', /snoonu/i], ['Careem', /careem/i], ['HungerStation', /hungerstation/i]];
const OWN_ORDERING = /ordable\.com|toasttab\.com|chownow\.com|square\.site|squareup\.com\/(online|order)|clover\.com\/online-ordering|gloriafood|fbgcdn\.com|menufy\.com|slicelife\.com|order\.online|owner\.com|flipdish|orderyoyo|bentobox|popmenu|tryotter|olo\.com|order\.[a-z0-9-]+\.[a-z.]+|\/order(-online|online|now)?["'\/?#]|add[ _-]to[ _-]cart|\/cart["'\/?]|woocommerce|shopify/i;
const BOOKING = /opentable\.|resy\.com|sevenrooms\.com|eatapp\.co|tablecheck\.com|quandoo\.|designmynight\.|exploretock\.com|tock\.com|yelp\.com\/reservations|book a table|reserve a table|reservations?\b/i;
// Only text that is clearly unfinished. Not "coming soon" (often a real new branch).
const PLACEHOLDER = /lorem ipsum|(?:site|website|page) (?:is )?under construction|high performance con[a-z]*ting template|>\s*((?:nav|footer|header|contact)\.[a-z][a-zA-Z]+)\s*</i;
const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$|@(\dx|example|domain|email|yourdomain|sentry|wixpress|godaddy)\.|^(example|name|your|email|user)@|noreply|no-reply/i;
const GOOD_PREFIX = /^(info|contact|hello|hi|enquir|inquir|reservations?|bookings?|events|office|admin|manager|owner|team|orders?|catering|support)/i;

// ============================== WEB APP API (called from the page) ==============================
function webFinderConfig(key) {
  requireControlKey_(key);
  return {
    countries: Object.keys(FINDER.COUNTRIES).map(cc => ({ cc, name: FINDER.COUNTRIES[cc].name })),
    types: FINDER.TYPES,
    hasPlacesKey: !!placesKey_()
  };
}

function webFetchLeads(cc, type, key) {
  requireControlKey_(key);
  if (!FINDER.COUNTRIES[cc]) throw new Error('Unknown country');
  if (!FINDER.TYPES.includes(type)) throw new Error('Unknown business type');
  if (!placesKey_()) throw new Error('Add PLACES_API_KEY in Project Settings → Script properties first.');
  return fetchNewLeads_(cc, type);
}

function webOverview(key) {
  requireControlKey_(key);
  const sheet = getSS_().getSheetByName('Leads');
  const out = { fetched: [], emailed: [], counts: { ready: 0, emailed: 0, replied: 0, bounced: 0 } };
  if (!sheet || sheet.getLastRow() < 2) return out;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, LEAD_HEADERS.length).getValues();
  const fmt = d => d instanceof Date ? Utilities.formatDate(d, CFG.TZ, 'dd MMM, hh:mm a') : '';
  rows.forEach(r => {
    const status = String(r[COL.status] || '');
    const stage = Number(r[COL.stage] || 0);
    if (stage === 0 && (status === 'ready' || status === '')) out.counts.ready++;
    if (stage > 0) out.counts.emailed++;
    if (status === 'STOP_REPLIED' || r[COL.repliedAt]) out.counts.replied++;
    if (status === 'BOUNCED') out.counts.bounced++;
    const base = { name: String(r[COL.businessName] || ''), email: String(r[COL.email] || ''), cc: countryCode_(r), status, stage };
    if (String(r[COL.id]).startsWith('f_')) {
      out.fetched.push(Object.assign({}, base, { website: String(r[COL.website] || ''), problem: String(r[COL.coreProblem] || ''),
        offer: String(r[COL.solution] || ''), notes: String(r[COL.notes] || '') }));
    }
    if (stage > 0) {
      out.emailed.push(Object.assign({}, base, { lastSentAt: fmt(r[COL.lastSentAt]), sortAt: r[COL.lastSentAt] instanceof Date ? r[COL.lastSentAt].getTime() : 0,
        replied: fmt(r[COL.repliedAt]) || (status === 'STOP_REPLIED' ? 'yes' : ''), opens: Number(r[COL.openCount] || 0) }));
    }
  });
  out.fetched = out.fetched.reverse().slice(0, 30);
  out.emailed.sort((a, b) => b.sortAt - a.sortAt);
  out.emailed = out.emailed.slice(0, 150);
  return out;
}

// Prints the private app link (after Deploy → Web app).
function showAppLink() {
  const url = ScriptApp.getService().getUrl();
  if (!url) { console.log('Deploy first: Deploy → New deployment → Web app.'); return; }
  console.log('Your private RestoHunter link (do not share): ' + url + '?key=' + controlKey_());
}

// ============================== FINDER ==============================
function placesKey_() {
  return PropertiesService.getScriptProperties().getProperty('PLACES_API_KEY') || '';
}

function fetchNewLeads_(cc, type) {
  const country = FINDER.COUNTRIES[cc];
  const ss = getSS_();
  const leadsSheet = ss.getSheetByName('Leads');
  ensureLeadHeaders_(leadsSheet);
  const finder = finderSheet_(ss);

  // Everything already known: never check or add the same business twice.
  const seenPlaces = new Set();
  if (finder.getLastRow() > 1) finder.getRange(2, 1, finder.getLastRow() - 1, 1).getValues().forEach(r => seenPlaces.add(String(r[0])));
  // host / name -> true when that business was already emailed
  const knownEmails = new Set(), emailedEmails = new Set(), knownHosts = new Map(), knownNames = new Map();
  if (leadsSheet.getLastRow() > 1) {
    leadsSheet.getRange(2, 1, leadsSheet.getLastRow() - 1, LEAD_HEADERS.length).getValues().forEach(r => {
      const e = String(r[COL.email] || '').trim().toLowerCase();
      const sent = Number(r[COL.stage] || 0) > 0;
      if (e) knownEmails.add(e);
      if (e && sent) emailedEmails.add(e);
      const h = hostOf_(r[COL.website]);
      if (h) knownHosts.set(h, knownHosts.get(h) || sent);
      const n = normName_(r[COL.businessName]) + '|' + countryCode_(r);
      knownNames.set(n, knownNames.get(n) || sent);
    });
  }

  const props = PropertiesService.getScriptProperties();
  const posKey = 'FINDER_POS_' + cc + '_' + type.replace(/\W+/g, '_');
  let pos = {};
  try { pos = JSON.parse(props.getProperty(posKey) || '{}'); } catch (e) { }
  pos.city = Number(pos.city || 0) % country.cities.length;

  const added = [], tally = { checked: 0, noWebsiteNoEmail: 0, noEmail: 0, unreachable: 0, badEmail: 0, alreadyKnown: 0, alreadyEmailed: 0, ownOrdering: 0, closed: 0 };
  const finderRows = [];
  let calls = 0;

  while (added.length < FINDER.PER_FETCH && calls < FINDER.MAX_PLACES_CALLS && tally.checked < FINDER.MAX_SITE_CHECKS) {
    const city = country.cities[pos.city];
    const res = placesSearch_(`${type} in ${city}, ${country.name}`, cc, pos.token || '');
    calls++;
    if (res.nextPageToken) pos.token = res.nextPageToken;
    else { pos.token = ''; pos.city = (pos.city + 1) % country.cities.length; }

    const fresh = (res.places || []).filter(p => {
      if (!p.id || seenPlaces.has(p.id)) return false;
      seenPlaces.add(p.id);
      const name = (p.displayName && p.displayName.text) || '';
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') { tally.closed++; finderRows.push(finderRow_(p, cc, type, city, 'closed', '')); return false; }
      const h = hostOf_(p.websiteUri);
      const n = normName_(name) + '|' + cc;
      const byHost = h && knownHosts.has(h) && !SOCIAL_ONLY.test(h) && !LINK_IN_BIO.test(h);
      if (byHost || knownNames.has(n)) {
        const sent = (byHost && knownHosts.get(h)) || knownNames.get(n);
        if (sent) tally.alreadyEmailed++; else tally.alreadyKnown++;
        finderRows.push(finderRow_(p, cc, type, city, sent ? 'already emailed' : 'already in Leads', '')); return false;
      }
      return true;
    });

    for (let i = 0; i < fresh.length && added.length < FINDER.PER_FETCH && tally.checked < FINDER.MAX_SITE_CHECKS; i += FINDER.BATCH) {
      const batch = fresh.slice(i, i + FINDER.BATCH);
      const checks = checkBusinesses_(batch);
      checks.forEach((c, j) => {
        const p = batch[j];
        tally.checked++;
        if (added.length >= FINDER.PER_FETCH) { seenPlaces.delete(p.id); return; }   // not looked at properly: may come back next time
        if (c.result !== 'ok') {
          if (c.result === 'no website, no email') tally.noWebsiteNoEmail++;
          else if (c.result === 'no email on website') tally.noEmail++;
          else if (c.result === 'has own ordering') tally.ownOrdering++;
          else if (c.result === 'website not reachable') tally.unreachable++;
          finderRows.push(finderRow_(p, cc, type, city, c.result, ''));
          return;
        }
        const email = c.email.toLowerCase();
        if (knownEmails.has(email)) {
          if (emailedEmails.has(email)) tally.alreadyEmailed++; else tally.alreadyKnown++;
          finderRows.push(finderRow_(p, cc, type, city, emailedEmails.has(email) ? 'already emailed' : 'already in Leads', c.email));
          return;
        }
        const invalid = validateEmail_(c.email);
        if (invalid) { tally.badEmail++; finderRows.push(finderRow_(p, cc, type, city, 'email rejected: ' + invalid, c.email)); return; }
        knownEmails.add(email);
        const lead = buildFetchedLead_(p, c, cc, country, type, city);
        added.push(lead);
        finderRows.push(finderRow_(p, cc, type, city, 'added', c.email));
      });
    }
  }
  props.setProperty(posKey, JSON.stringify(pos));

  // Short lock only for writing, so the sending engine is never blocked for long.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (added.length) {
      const rows = added.map(l => l.row);
      leadsSheet.getRange(leadsSheet.getLastRow() + 1, 1, rows.length, LEAD_HEADERS.length).setValues(rows);
      log_('success', `🔎 Fetched ${added.length} new lead(s): ${country.name} / ${type}`);
    }
    if (finderRows.length) finder.getRange(finder.getLastRow() + 1, 1, finderRows.length, FINDER_HEADERS.length).setValues(finderRows);
  } finally {
    lock.releaseLock();
  }

  return { country: country.name, type, added: added.map(l => l.view), tally, placesCalls: calls };
}

function placesSearch_(query, cc, pageToken) {
  const body = { textQuery: query, regionCode: cc === 'GB' ? 'GB' : cc, pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;
  const res = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
    headers: {
      'X-Goog-Api-Key': placesKey_(),
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.businessStatus,nextPageToken'
    }
  });
  if (res.getResponseCode() !== 200) {
    let msg = res.getContentText();
    try { msg = JSON.parse(msg).error.message; } catch (e) { }
    throw new Error('Google Places error ' + res.getResponseCode() + ': ' + msg);
  }
  return JSON.parse(res.getContentText());
}

// Opens each business's website (or link-in-bio page) and decides: email + visible weakness, or why not.
function checkBusinesses_(places) {
  const plan = places.map(p => {
    const url = String(p.websiteUri || '').trim();
    const host = hostOf_(url);
    if (!host) return { kind: 'none' };
    if (LINK_IN_BIO.test(host)) return { kind: 'bio', url, host };
    if (SOCIAL_ONLY.test(host) || DELIVERY_ONLY_HOST.test(host)) return { kind: 'social', url, host };
    return { kind: 'site', url, host };
  });

  // Round 1: home page / link-in-bio page
  const first = fetchPages_(plan.map(x => (x.kind === 'site' || x.kind === 'bio') ? x.url : ''));
  // Round 2: contact pages for websites whose home page shows no email
  const second = fetchPages_(plan.map((x, i) => {
    if (x.kind !== 'site' || !first[i].ok || pickEmail_(first[i].html, x.host)) return '';
    return originOf_(first[i].finalUrl || x.url) + '/contact';
  }));
  const third = fetchPages_(plan.map((x, i) => {
    if (x.kind !== 'site' || !first[i].ok || pickEmail_(first[i].html, x.host) || (second[i].ok && pickEmail_(second[i].html, x.host))) return '';
    return originOf_(first[i].finalUrl || x.url) + '/contact-us';
  }));

  return plan.map((x, i) => {
    if (x.kind === 'none' || x.kind === 'social') return { result: 'no website, no email' };
    if (!first[i].ok) return { result: x.kind === 'bio' ? 'no website, no email' : 'website not reachable' };
    const pages = [first[i], second[i], third[i]].filter(pg => pg.ok);
    const html = pages.map(pg => pg.html).join('\n');
    let email = '', emailPage = '';
    for (const pg of pages) { email = pickEmail_(pg.html, x.host); if (email) { emailPage = pg.url; break; } }
    if (!email) return { result: x.kind === 'bio' ? 'no website, no email' : 'no email on website' };

    const w = x.kind === 'bio' ? bioWeakness_(html, x.host) : siteWeakness_(html);
    if (!w) return { result: 'has own ordering' };
    return Object.assign({ result: 'ok', email, emailPage, website: x.url }, w);
  });
}

function fetchPages_(urls) {
  const reqs = [], idx = [];
  urls.forEach((u, i) => { if (u) { reqs.push({ url: u, muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: false,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } }); idx.push(i); } });
  const out = urls.map(u => ({ ok: false, url: u, html: '' }));
  if (!reqs.length) return out;
  let resps = [];
  try { resps = UrlFetchApp.fetchAll(reqs); } catch (e) {
    // One bad host can fail the whole batch: retry one by one.
    resps = reqs.map(r => { try { return UrlFetchApp.fetch(r.url, r); } catch (err) { return null; } });
  }
  resps.forEach((r, k) => {
    const i = idx[k];
    if (!r) return;
    const code = r.getResponseCode();
    if (code >= 200 && code < 400) {
      const html = r.getContentText().slice(0, 600000);
      out[i] = { ok: true, url: urls[i], finalUrl: urls[i], html };
    }
  });
  return out;
}

function pickEmail_(html, host) {
  if (!html) return '';
  const found = new Set();
  (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach(e => found.add(e));
  // Cloudflare hides emails: data-cfemail="..." or /cdn-cgi/l/email-protection#...
  (html.match(/data-cfemail="([0-9a-fA-F]+)"|email-protection#([0-9a-fA-F]+)/g) || []).forEach(m => {
    const hex = m.replace(/.*(?:data-cfemail="|#)/, '').replace(/"$/, '');
    const k = parseInt(hex.substr(0, 2), 16);
    let s = '';
    for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ k);
    found.add(s);
  });
  const emails = [...found].map(e => e.trim().replace(/^mailto:/i, '').replace(/[.,;]+$/, '')).filter(e => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && !JUNK_EMAIL.test(e));
  if (!emails.length) return '';
  const root = String(host || '').replace(/^www\./, '').split('.').slice(-2).join('.');
  const score = e => {
    const d = e.split('@')[1].toLowerCase();
    let s = 0;
    if (root && d.endsWith(root)) s += 10;
    if (GOOD_PREFIX.test(e)) s += 3;
    return s;
  };
  emails.sort((a, b) => score(b) - score(a));
  return emails[0];
}

// Only facts seen in the page. Returns null when the site already has its own ordering and nothing else is wrong.
function siteWeakness_(html) {
  const apps = DELIVERY_APPS.filter(([, rx]) => hrefs_(html).some(h => rx.test(h))).map(([n]) => n);
  const own = OWN_ORDERING.test(html);
  const booking = BOOKING.test(html);
  const ph = html.match(PLACEHOLDER);
  const years = (html.match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2}|19\d{2})/gi) || []).map(m => Number(m.match(/(\d{4})\s*$/)[1]));
  const lastYear = years.length ? Math.max.apply(null, years) : 0;
  const outdated = lastYear && lastYear <= new Date().getFullYear() - FINDER.OUTDATED_YEARS;

  if (ph) {
    const sample = (ph[1] || ph[0]).replace(/[<>]/g, '').trim().slice(0, 40);
    return { problem: `a website that still shows placeholder text such as "${sample}"`, leak: '',
      offer: 'Website rebuild with menu and direct ordering', evidence: `Placeholder text on the site: "${sample}"` };
  }
  if (apps.length && !own) {
    return { problem: 'the lack of direct ordering on your website, which sends delivery orders to third-party apps', leak: FINDER.APP_FEE,
      offer: 'Direct online ordering on your own website', evidence: `Delivery links: ${apps.join(', ')}; no own ordering on the site` };
  }
  if (!own && !booking && !apps.length) {
    return { problem: 'a website with no online ordering or table booking' + (outdated ? `, last updated in ${lastYear}` : ''), leak: '',
      offer: 'Website with menu, direct ordering and table booking', evidence: 'No ordering, booking or delivery links on the site' + (outdated ? `; newest © year ${lastYear}` : '') };
  }
  if (!own && booking && !apps.length) {
    return { problem: 'a website with table booking but no online ordering' + (outdated ? `, last updated in ${lastYear}` : ''), leak: '',
      offer: 'Direct online ordering on your own website', evidence: 'Booking found, no ordering or delivery links on the site' + (outdated ? `; newest © year ${lastYear}` : '') };
  }
  return null;
}

function bioWeakness_(html, host) {
  const apps = DELIVERY_APPS.filter(([, rx]) => hrefs_(html).some(h => rx.test(h))).map(([n]) => n);
  return { problem: 'no website of your own, only a link page', leak: apps.length ? FINDER.APP_FEE : '',
    offer: 'Own website with menu and direct ordering (website offer)',
    evidence: `Google lists ${host} as the website` + (apps.length ? `; it links to ${apps.join(', ')}` : '') };
}

function buildFetchedLead_(p, c, cc, country, type, city) {
  const name = (p.displayName && p.displayName.text) || 'Business';
  const now = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm');
  const r = new Array(LEAD_HEADERS.length).fill('');
  r[COL.id] = 'f_' + cc.toLowerCase() + '_' + String(p.id).slice(-12);
  r[COL.businessName] = name;
  r[COL.email] = c.email;
  r[COL.website] = c.website;
  r[COL.city] = city;
  r[COL.country] = country.name;
  r[COL.countryCode] = cc;
  r[COL.niche] = type;
  r[COL.coreProblem] = c.problem;
  r[COL.financialLeak] = c.leak;
  r[COL.solution] = c.offer;
  r[COL.status] = 'ready';
  r[COL.stage] = 0;
  r[COL.notes] = `Fetched ${now} | email seen on ${c.emailPage} | ${c.evidence} | Place ID ${p.id}`;
  return {
    row: r,
    view: { name, email: c.email, website: c.website, city, address: p.formattedAddress || '', problem: c.problem, offer: c.offer, evidence: c.evidence }
  };
}

function finderSheet_(ss) {
  let sh = ss.getSheetByName(FINDER_SHEET);
  if (!sh) {
    sh = ss.insertSheet(FINDER_SHEET);
    sh.getRange(1, 1, 1, FINDER_HEADERS.length).setValues([FINDER_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function finderRow_(p, cc, type, city, result, email) {
  return [p.id, (p.displayName && p.displayName.text) || '', cc, type, city, p.websiteUri || '', result, email || '',
    Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm')];
}

function hrefs_(html) {
  return (String(html).match(/href\s*=\s*["']([^"']+)["']/gi) || []).map(h => h.replace(/^href\s*=\s*["']/i, ''));
}

function hostOf_(url) {
  const m = String(url || '').trim().match(/^(?:https?:\/\/)?([^\/?#:]+)/i);
  return m && m[1].includes('.') ? m[1].toLowerCase().replace(/^www\./, '') : '';
}

function originOf_(url) {
  const m = String(url).match(/^(https?:\/\/[^\/?#]+)/i);
  return m ? m[1] : String(url).replace(/\/+$/, '');
}

function normName_(s) {
  return String(s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
}

// ============================== THE PAGE ==============================
function renderAppPage_() {
  const key = JSON.stringify(controlKey_());
  return HtmlService.createHtmlOutput(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RestoHunter</title>
<style>
:root{--bg:#0f172a;--card:#1e293b;--line:#334155;--text:#e2e8f0;--muted:#94a3b8;--go:#059669;--stop:#dc2626;--acc:#38bdf8;--warn:#fbbf24}
*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:16px;max-width:980px;margin:auto}
h1{font-size:20px;margin:4px 0 14px}h2{font-size:16px;margin:0 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
select,button{font-size:15px;border-radius:10px;border:1px solid var(--line);padding:10px 12px;background:#0b1220;color:var(--text)}
select{flex:1;min-width:150px}button{cursor:pointer;font-weight:700}button:disabled{opacity:.4;cursor:default}
#fetch{background:var(--acc);color:#04111d;border:0;flex:1;min-width:120px}#go{background:var(--go);border:0}#stop{background:var(--stop);border:0}
.muted{color:var(--muted);font-size:13px}.err{color:#fca5a5}
.lead{border-top:1px solid var(--line);padding:10px 0}.lead:first-child{border-top:0}
.lead b{font-size:15px}.tag{display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;background:#0b1220;border:1px solid var(--line);margin:3px 4px 0 0}
.tag.web{border-color:var(--warn);color:var(--warn)}
.tabs button{background:transparent;border:1px solid var(--line)}.tabs button.on{background:var(--line)}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:7px 6px;border-top:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600;border-top:0}.scroll{overflow-x:auto}
.stat{flex:1;min-width:90px;background:#0b1220;border-radius:10px;padding:8px 10px}.stat b{display:block;font-size:18px}
</style></head><body>
<h1>⚡ RestoHunter</h1>

<div class="card"><div class="row" style="justify-content:space-between">
  <div id="st" class="muted">Loading…</div>
  <div class="row"><button id="go" onclick="setEngine(true)">▶ Start</button><button id="stop" onclick="setEngine(false)">■ Stop</button></div>
</div></div>

<div class="card">
  <h2>Fetch new leads</h2>
  <div class="row">
    <select id="cc"></select><select id="type"></select>
    <button id="fetch" onclick="fetchLeads()">Fetch 5 leads</button>
  </div>
  <div id="fmsg" class="muted" style="margin-top:8px"></div>
  <div id="newLeads"></div>
</div>

<div class="card">
  <div class="row" style="margin-bottom:10px" id="stats"></div>
  <div class="row tabs" style="margin-bottom:8px">
    <button id="t1" class="on" onclick="tab(1)">Newly added</button><button id="t2" onclick="tab(2)">Emails sent</button>
  </div>
  <div id="p1"></div><div id="p2" class="scroll" style="display:none"></div>
</div>

<script>
var KEY=${key};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function run(fn,args,ok){var r=google.script.run.withSuccessHandler(ok).withFailureHandler(function(e){fail(e);});r[fn].apply(r,args);}
function fail(e){var m=document.getElementById('fmsg');m.className='err';m.textContent=(e&&e.message)||String(e);document.getElementById('fetch').disabled=false;}
function showStatus(s){document.getElementById('st').innerHTML='<b style="color:'+(s.on?'#34d399':'#94a3b8')+'">'+(s.on?'🟢 Engine running':'⚪ Engine stopped')+'</b><br>'+esc(s.action)+'<br>Sent today: '+esc(s.sent)+' · Ready leads: '+esc(s.ready);
  document.getElementById('go').disabled=s.on;document.getElementById('stop').disabled=!s.on;}
function setEngine(on){if(on&&!confirm('Start sending emails?'))return;run('webSetEngine',[on,KEY],showStatus);}
function leadCard(l){var web=/website offer/i.test(l.offer||'');
  return '<div class="lead"><b>'+esc(l.name)+'</b> <span class="muted">'+esc(l.city||'')+(l.cc?' · '+esc(l.cc):'')+'</span><br>'+
  '📧 '+esc(l.email)+(l.website?' · <a style="color:#38bdf8" target="_blank" rel="noopener" href="'+esc(l.website)+'">website</a>':'')+'<br>'+
  '<span class="muted">Weakness:</span> '+esc(l.problem)+'<br>'+
  '<span class="tag'+(web?' web':'')+'">'+esc(l.offer)+'</span>'+(l.evidence?'<div class="muted">Seen: '+esc(l.evidence)+'</div>':'')+
  (l.status&&l.status!=='ready'?'<span class="tag">'+esc(l.status)+'</span>':'')+'</div>';}
function fetchLeads(){var b=document.getElementById('fetch');b.disabled=true;var m=document.getElementById('fmsg');m.className='muted';
  m.textContent='Searching and checking websites… this can take up to a minute.';document.getElementById('newLeads').innerHTML='';
  run('webFetchLeads',[document.getElementById('cc').value,document.getElementById('type').value,KEY],function(r){b.disabled=false;var t=r.tally;
    m.innerHTML='<b>'+r.added.length+' new lead(s)</b> added for '+esc(r.country)+' / '+esc(r.type)+'. Checked '+t.checked+' businesses: '+
    t.noWebsiteNoEmail+' no website and no email, '+t.noEmail+' no email on website, '+t.unreachable+' website not reachable, '+t.ownOrdering+' already have own ordering, '+
    t.badEmail+' email rejected, '+(t.alreadyKnown+t.alreadyEmailed)+' already in your list ('+t.alreadyEmailed+' already emailed).'+
    (r.added.length<5?' Press Fetch again to keep searching.':'');
    document.getElementById('newLeads').innerHTML=r.added.map(leadCard).join('');loadOverview();});}
function tab(n){document.getElementById('p1').style.display=n==1?'':'none';document.getElementById('p2').style.display=n==2?'':'none';
  document.getElementById('t1').className=n==1?'on':'';document.getElementById('t2').className=n==2?'on':'';}
function loadOverview(){run('webOverview',[KEY],function(o){var c=o.counts;
  document.getElementById('stats').innerHTML=['Ready to send',c.ready,'Emailed',c.emailed,'Replied',c.replied,'Bounced',c.bounced].reduce(function(h,v,i,a){return i%2?h:h+'<div class="stat"><span class="muted">'+a[i]+'</span><b>'+a[i+1]+'</b></div>';},'');
  document.getElementById('p1').innerHTML=o.fetched.length?o.fetched.map(leadCard).join(''):'<div class="muted">No fetched leads yet.</div>';
  var st={1:'1st email sent',2:'2nd email sent',3:'All 3 sent'};
  document.getElementById('p2').innerHTML=o.emailed.length?'<table><tr><th>Business</th><th>Email</th><th>Country</th><th>Sent</th><th>Last sent</th><th>Status</th></tr>'+
    o.emailed.map(function(e){return '<tr><td>'+esc(e.name)+'</td><td>'+esc(e.email)+'</td><td>'+esc(e.cc)+'</td><td>'+esc(st[e.stage]||e.stage)+'</td><td>'+esc(e.lastSentAt)+'</td><td>'+
    esc(e.status==='STOP_REPLIED'?'Replied — stopped':e.status==='BOUNCED'?'Bounced':e.status==='FINISHED'?'Finished':'In sequence')+(e.opens?' · 👁 '+e.opens:'')+'</td></tr>';}).join('')+'</table>'
    :'<div class="muted">No emails sent yet.</div>';});}
run('webFinderConfig',[KEY],function(c){
  document.getElementById('cc').innerHTML=c.countries.map(function(x){return '<option value="'+x.cc+'">'+esc(x.name)+'</option>';}).join('');
  document.getElementById('type').innerHTML=c.types.map(function(t){return '<option>'+esc(t)+'</option>';}).join('');
  if(!c.hasPlacesKey){fail({message:'Google Places API key missing: Project Settings → Script properties → PLACES_API_KEY'});document.getElementById('fetch').disabled=true;}});
run('webStatus',[KEY],showStatus);loadOverview();setInterval(function(){run('webStatus',[KEY],showStatus);},20000);
</script></body></html>`).setTitle('RestoHunter').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
