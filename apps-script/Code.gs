/**
 * RestoHunter AI — Google Apps Script Outreach Engine
 * Free, 24/7, runs on Google's servers and sends directly from your Gmail.
 *
 * SETUP (one time):
 *   1. Paste this whole file into Extensions → Apps Script (or script.google.com), Save.
 *   2. Select function "setup" at the top → Run → Allow.
 *   3. Go back to the Sheet → "Control" tab → tick the ENGINE checkbox to START, untick to STOP.
 *
 * Open tracking: Deploy → New deployment → Web app (Execute as: Me, Access: Anyone),
 *           then paste the /exec URL into CFG.TRACKING_URL and Save.
 *           The Control tab then shows open counts and a private mobile Start / Stop link.
 */

// ============================== SETTINGS ==============================
const CFG = {
  SENDER_NAME: 'Alex | MF Software Solutions',
  REPLY_TO: 'info.mfsoft@gmail.com',
  BUSINESS_NAME: 'MF Software Solutions',
  POSTAL_ADDRESS: '',              // full postal address, e.g. 'Office 12, Main Street, Karachi 74000, Pakistan' (shown under every email)
  PLAIN_TEXT: true,                // true = plain email like one typed in Gmail (no sender name, no HTML). Test showed HTML/name emails land in Spam.
  TRACKING_URL: '',                // open tracking needs PLAIN_TEXT: false; paste your Web App URL (ending in /exec) here to use it
  DAILY_LIMIT: 51,                 // total emails per day (17 new + 17 + 17 follow-ups)
  DAILY_NEW: 17,                   // cold emails per day
  DAILY_FOLLOWUP1: 17,             // stage 2 emails per day
  DAILY_FOLLOWUP2: 17,             // stage 3 emails per day
  MIN_DELAY_SEC: 180,              // human pacing between emails: 3 min
  MAX_DELAY_SEC: 420,              // … to 7 min
  FOLLOWUP2_AFTER_HOURS: 48,       // stage 2 bump
  FOLLOWUP3_AFTER_HOURS: 72,       // stage 3 breakup (after stage 2)
  REPLY_CHECK_EVERY_MIN: 10,
  MAX_BOUNCES_PER_DAY: 5,          // auto-STOP engine if exceeded (protects Gmail reputation)
  LOW_LEADS_ALERT_AT: 10,          // email you when fewer ready leads remain
  TZ: 'Asia/Karachi',
  // Checked leads on GitHub. New leads added there are copied into the Leads tab automatically.
  LEADS_SOURCE_URL: 'https://raw.githubusercontent.com/Fawwad345776/RestoHunter-AI/shorten-outreach-emails/data/leads.json',
  LEAD_SYNC_EVERY_MIN: 60
};

const LEAD_HEADERS = ['id', 'businessName', 'decisionMaker', 'email', 'website', 'city', 'country', 'countryCode',
  'niche', 'coreProblem', 'financialLeak', 'solution', 'status', 'stage', 'lastSentAt', 'threadId',
  'messageId', 'subject', 'repliedAt', 'notes', 'openCount', 'firstOpenedAt', 'lastOpenedAt', 'lastOpenedStage'];
const COL = LEAD_HEADERS.reduce((m, h, i) => (m[h] = i, m), {});
const DONE_STATUSES = ['FINISHED', 'STOP_REPLIED', 'BOUNCED', 'INVALID'];
const BLOCKING_STATUSES = ['STOP_REPLIED', 'BOUNCED', 'INVALID'];   // never email this address again

const INVALID_DOMAIN_PATTERNS = [/\.(png|jpg|jpeg|svg|gif|webp|bmp|ico)$/i, /wordpress\.org$/i, /wix\.com$/i,
  /sentry\.io$/i, /example\.com$/i, /domain\.com$/i, /test\.com$/i, /localhost$/i];

// ============================== SETUP ==============================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || createOwnSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());

  // Control sheet
  let ctl = ss.getSheetByName('Control') || ss.insertSheet('Control', 0);
  ctl.clear();
  ctl.getRange('A1:B1').setValues([['▶ ENGINE ON / OFF  (tick = Start, untick = Stop)', false]]);
  ctl.getRange('B1').insertCheckboxes();
  ctl.getRange('A1').setFontWeight('bold').setFontSize(13);
  ctl.getRange('A3:A12').setValues([['Status'], ['Current action'], ['PKT time'], ['Sent today'], ['New leads today'],
    ['Follow-ups today'], ['Ready leads left'], ['Next email at (PKT)'], ['Bounces today'], ['Last error']]);
  ctl.getRange('A3:A12').setFontWeight('bold');
  ctl.setColumnWidth(1, 330); ctl.setColumnWidth(2, 420);

  // Leads sheet
  let leads = ss.getSheetByName('Leads') || ss.insertSheet('Leads');
  if (leads.getLastRow() < 2) {
    leads.clear();
    leads.getRange(1, 1, 1, LEAD_HEADERS.length).setValues([LEAD_HEADERS]).setFontWeight('bold');
    leads.setFrozenRows(1);
    const imported = importLeadsFromGitHub_(leads);
    log_('info', `Imported ${imported} leads from GitHub.`);
  }

  // Log sheet
  let lg = ss.getSheetByName('Log') || ss.insertSheet('Log');
  if (lg.getLastRow() < 1) lg.appendRow(['Time (PKT)', 'Level', 'Message']);

  // Remove default empty sheet if present
  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) ss.deleteSheet(s1);

  // 1-minute trigger
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();

  // Touch Gmail so the permission prompt covers it
  GmailApp.getAliases();
  UrlFetchApp.fetch('https://dns.google/resolve?name=gmail.com&type=MX', { muteHttpExceptions: true });

  log_('info', 'Setup complete. Tick the ENGINE checkbox on the Control tab to start.');
  updateControl_({ status: 'STOPPED', action: 'Setup complete — tick the checkbox to start' });
  console.log('✅ SETUP DONE. Open your sheet: ' + ss.getUrl());
}

function createOwnSpreadsheet_() {
  const ss = SpreadsheetApp.create('RestoHunter AI — Outreach Engine');
  return ss;
}

function fetchSourceLeads_() {
  const res = UrlFetchApp.fetch(CFG.LEADS_SOURCE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not download leads: HTTP ' + res.getResponseCode());
  return JSON.parse(res.getContentText());
}

function leadToRow_(l) {
  const wp = l.solidWeakPoint || {};
  const r = new Array(LEAD_HEADERS.length).fill('');
  r[COL.id] = l.id || '';
  r[COL.businessName] = l.businessName || l.name || '';
  r[COL.decisionMaker] = l.decisionMaker || '';
  r[COL.email] = (l.email || '').trim();
  r[COL.website] = l.website || '';
  r[COL.city] = l.city || '';
  r[COL.country] = (l.country || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
  r[COL.countryCode] = (l.countryCode || '').toUpperCase();
  r[COL.niche] = l.nicheName || l.niche || '';
  r[COL.coreProblem] = wp.coreProblem || l.flawTitle || '';
  r[COL.financialLeak] = wp.financialLeak || l.flawLeakRange || '';
  r[COL.solution] = wp.solutionSoftware || '';
  r[COL.status] = 'ready';
  r[COL.stage] = 0;
  return r;
}

function importLeadsFromGitHub_(sheet) {
  const rows = fetchSourceLeads_().filter(l => l.email).map(leadToRow_);
  if (rows.length) sheet.getRange(2, 1, rows.length, LEAD_HEADERS.length).setValues(rows);
  return rows.length;
}

// Appends leads from GitHub whose id and email are not in the sheet yet. Never changes existing rows.
function syncNewLeads_(sheet) {
  const values = sheet.getDataRange().getValues();
  const ids = new Set(), emails = new Set();
  for (let i = 1; i < values.length; i++) {
    ids.add(String(values[i][COL.id] || ''));
    emails.add(String(values[i][COL.email] || '').trim().toLowerCase());
  }
  const rows = [];
  fetchSourceLeads_().forEach(l => {
    const email = String(l.email || '').trim().toLowerCase();
    if (!l.id || !email || ids.has(String(l.id)) || emails.has(email)) return;
    ids.add(String(l.id)); emails.add(email);
    rows.push(leadToRow_(l));
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, LEAD_HEADERS.length).setValues(rows);
    log_('success', `➕ Added ${rows.length} new lead(s) from GitHub`);
  }
  return rows.length;
}

function maybeSyncLeads_(sheet) {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('LAST_LEAD_SYNC') || 0);
  if (Date.now() - last < CFG.LEAD_SYNC_EVERY_MIN * 60000) return;
  props.setProperty('LAST_LEAD_SYNC', String(Date.now()));
  try { syncNewLeads_(sheet); } catch (e) { log_('warn', 'Lead sync skipped: ' + e); }
}

// Run by hand to pull new leads right away instead of waiting for the hourly check.
function syncLeadsNow() {
  const sheet = getSS_().getSheetByName('Leads');
  ensureLeadHeaders_(sheet);
  const n = syncNewLeads_(sheet);
  console.log(`Added ${n} new lead(s)`);
  return n;
}

// ============================== ONE-TIME CLEANUP (run by hand) ==============================
// Applies the checked lead list (emails confirmed on each business website) to the Leads sheet:
// - leads not on the list are marked INVALID, so they are never emailed
// - leads with a corrected email get it, and a bounced lead with a corrected email is queued again
// Rows that were already emailed and did not bounce are left alone.
function cleanLeads() {
  const good = {};
  fetchSourceLeads_().forEach(l => { good[l.id] = String(l.email || '').trim(); });

  const sheet = getSS_().getSheetByName('Leads');
  ensureLeadHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const counts = { removed: 0, emailFixed: 0, bouncedRequeued: 0, untouched: 0 };
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const id = String(r[COL.id] || '');
    if (!/^(us|uk|ca|kw|om|bh)_\d+$/.test(id)) { counts.untouched++; continue; }   // your own rows, e.g. test_1
    const status = String(r[COL.status] || '');
    const notSent = Number(r[COL.stage] || 0) === 0 && (status === 'ready' || status === '');
    const bounced = status === 'BOUNCED';
    if (!notSent && !bounced) { counts.untouched++; continue; }

    if (!(id in good)) {
      if (bounced) { counts.untouched++; continue; }
      r[COL.status] = 'INVALID';
      r[COL.notes] = 'Removed 2026-11-10: email not found on the business website';
      counts.removed++;
    } else if (good[id] && good[id].toLowerCase() !== String(r[COL.email]).trim().toLowerCase()) {
      r[COL.notes] = `Email changed from ${r[COL.email]} (found on the business website)`;
      r[COL.email] = good[id];
      if (bounced) {
        r[COL.status] = 'ready'; r[COL.stage] = 0;
        r[COL.lastSentAt] = ''; r[COL.threadId] = ''; r[COL.messageId] = ''; r[COL.subject] = '';
        counts.bouncedRequeued++;
      } else counts.emailFixed++;
    } else { counts.untouched++; continue; }
    sheet.getRange(i + 1, 1, 1, LEAD_HEADERS.length).setValues([r]);
  }
  log_('info', `🧹 Leads cleaned: ${JSON.stringify(counts)}`);
  console.log(JSON.stringify(counts));
  return counts;
}

// Run by hand once if old bounces were counted as today's. Safe: new bounces today are counted again.
function resetTodayBounces() {
  const s = loadState_();
  s.bounces = 0;
  saveState_(s);
  log_('warn', '🔄 Today\'s bounce counter reset by hand');
}

// ============================== MAIN LOOP (every minute) ==============================
function tick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    const ss = getSS_();
    const ctl = ss.getSheetByName('Control');
    ensureLeadHeaders_(ss.getSheetByName('Leads'));
    maybeSyncLeads_(ss.getSheetByName('Leads'));
    const enabled = ctl.getRange('B1').getValue() === true;
    const props = PropertiesService.getScriptProperties();
    const state = loadState_();

    if (!enabled) {
      if (props.getProperty('WAS_RUNNING') === '1') {
        props.setProperty('WAS_RUNNING', '0');
        log_('warn', '⏹ Engine stopped.');
      }
      updateControl_({ status: 'STOPPED', action: 'Engine is stopped', state });
      return;
    }
    if (props.getProperty('WAS_RUNNING') !== '1') {
      props.setProperty('WAS_RUNNING', '1');
      log_('success', '▶ Engine started.');
    }

    const now = new Date();

    // Replies land in REPLY_TO, so running from another account would hide every 'stop'.
    if (!ownAddresses_().includes(CFG.REPLY_TO.toLowerCase())) {
      updateControl_({ status: 'RUNNING', action: `Not sending: run this script from ${CFG.REPLY_TO} so 'stop' replies can be seen.`, state });
      return;
    }

    // Replies & bounces check
    const lastCheck = Number(props.getProperty('LAST_REPLY_CHECK') || 0);
    if (now.getTime() - lastCheck >= CFG.REPLY_CHECK_EVERY_MIN * 60000) {
      props.setProperty('LAST_REPLY_CHECK', String(now.getTime()));
      checkRepliesAndBounces_(state);
      if (ctl.getRange('B1').getValue() !== true) return; // bounce guard may have stopped it
    }

    if (state.total >= CFG.DAILY_LIMIT) {
      updateControl_({ status: 'RUNNING', action: `Daily limit reached (${state.total}/${CFG.DAILY_LIMIT}). Waiting for tomorrow.`, state });
      return;
    }

    const nextAt = Number(props.getProperty('NEXT_SEND_AT') || 0);
    if (now.getTime() < nextAt) {
      const secs = Math.round((nextAt - now.getTime()) / 1000);
      updateControl_({ status: 'RUNNING', action: `Anti-ban pause: next email in ${Math.floor(secs / 60)}m ${secs % 60}s`, state, nextAt });
      return;
    }

    const win = getActiveWindow_(now);
    if (!win.active) {
      updateControl_({ status: 'RUNNING', action: 'Waiting for next window — Gulf 10:30 AM / UK 2:00 PM / US-CA 6:30 PM PKT', state });
      return;
    }

    const sheet = ss.getSheetByName('Leads');
    const values = sheet.getDataRange().getValues();
    checkLowLeads_(values, state);

    const pick = selectCandidate_(values, win, state, now);
    if (!pick) {
      updateControl_({ status: 'RUNNING', action: `All quotas done for ${win.name}. Waiting…`, state });
      return;
    }

    const { rowIdx, stage } = pick;
    const lead = rowToLead_(values[rowIdx]);
    const rowNum = rowIdx + 1;
    if (!lead.id) lead.id = 'lead_' + rowNum;

    // Last check right before sending: never email anyone who has already replied or bounced.
    const response = findResponse_(lead);
    if (response) {
      blockAddress_(sheet, values, lead.email, response);
      if (response.status === 'BOUNCED' && pktParts_(response.when).date === state.date) { state.bounces++; saveState_(state); }
      log_('warn', `🛑 Not sending to ${lead.businessName} <${lead.email}>: ${response.status}`);
      return;
    }

    const result = sendStage_(lead, stage);

    if (result.ok) {
      const row = values[rowIdx];
      row[COL.stage] = stage;
      row[COL.lastSentAt] = now;
      row[COL.status] = stage === 1 ? 'stage1_sent' : stage === 2 ? 'stage2_sent' : 'FINISHED';
      if (stage === 1) {
        row[COL.threadId] = result.threadId;
        row[COL.messageId] = result.messageId;
        row[COL.subject] = result.subject;
      }
      if (!row[COL.id]) row[COL.id] = 'lead_' + rowNum;
      sheet.getRange(rowNum, 1, 1, LEAD_HEADERS.length).setValues([row]);

      state.total++;
      if (stage === 1) { state.newSent++; state.cc[lead.cc] = (state.cc[lead.cc] || 0) + 1; }
      else {
        state.followups++;
        if (stage === 2) state.followup1 = (state.followup1 || 0) + 1;
        else state.followup2 = (state.followup2 || 0) + 1;
      }
      saveState_(state);
      log_('success', `✅ Stage ${stage} sent to ${lead.businessName} <${lead.email}> (${lead.cc})${result.note ? ' — ' + result.note : ''}`);
    } else if (result.invalid) {
      values[rowIdx][COL.status] = 'INVALID';
      values[rowIdx][COL.notes] = result.error;
      sheet.getRange(rowNum, 1, 1, LEAD_HEADERS.length).setValues([values[rowIdx]]);
      log_('warn', `⚠️ Skipped ${lead.businessName}: ${result.error}`);
      return; // no pacing delay needed — nothing was sent
    } else {
      props.setProperty('LAST_ERROR', result.error);
      log_('error', `❌ Send failed for ${lead.businessName}: ${result.error}`);
    }

    const delay = CFG.MIN_DELAY_SEC + Math.floor(Math.random() * (CFG.MAX_DELAY_SEC - CFG.MIN_DELAY_SEC + 1));
    const next = now.getTime() + delay * 1000;
    props.setProperty('NEXT_SEND_AT', String(next));
    updateControl_({ status: 'RUNNING', action: `Sent. Human pause ~${Math.round(delay / 60)} min`, state, nextAt: next });
  } catch (e) {
    PropertiesService.getScriptProperties().setProperty('LAST_ERROR', String(e));
    log_('error', 'Tick error: ' + e);
  } finally {
    lock.releaseLock();
  }
}

// ============================== SCHEDULING RULES ==============================
// weekday: 0=Mon … 6=Sun (PKT)
function pktParts_(d) {
  const wd = Number(Utilities.formatDate(d, CFG.TZ, 'u')) - 1;
  return { wd, hm: Utilities.formatDate(d, CFG.TZ, 'HH:mm'), date: Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd') };
}

function getActiveWindow_(d) {
  const { wd, hm } = pktParts_(d);
  if ([5, 6, 0, 1, 2, 3].includes(wd) && hm >= '10:30' && hm <= '13:30')
    return { active: true, name: 'Gulf Window', countries: ['KW', 'BH', 'OM'] };
  if ([0, 1, 2, 3, 4, 5].includes(wd) && hm >= '14:00' && hm <= '17:00')
    return { active: true, name: 'UK Window', countries: ['GB'] };
  if ([0, 1, 2, 3, 4, 5].includes(wd) && hm >= '18:30' && hm <= '21:30')
    return { active: true, name: 'North America Window', countries: ['US', 'CA'] };
  return { active: false, name: 'None', countries: [] };
}

function getQuotas_(d) {
  const { wd } = pktParts_(d);
  if (wd === 6) return { KW: 6, BH: 6, OM: 5, GB: 0, US: 0, CA: 0 };   // Sunday: Gulf
  if (wd === 4) return { KW: 0, BH: 0, OM: 0, GB: 6, US: 6, CA: 5 };   // Friday: West
  return { KW: 4, BH: 4, OM: 2, GB: 2, US: 3, CA: 2 };                 // Mon–Thu and Saturday: all countries
}

function countryCode_(row) {
  const code = String(row[COL.countryCode] || '').toUpperCase().trim();
  if (code) return code === 'UK' ? 'GB' : code;
  const c = String(row[COL.country] || '').toLowerCase();
  if (c.includes('kuwait')) return 'KW';
  if (c.includes('bahrain')) return 'BH';
  if (c.includes('oman')) return 'OM';
  if (c.includes('united kingdom') || c === 'uk' || c.includes('england')) return 'GB';
  if (c.includes('united states') || c.includes('usa')) return 'US';
  if (c.includes('canada')) return 'CA';
  return 'OTHER';
}

function selectCandidate_(values, win, state, now) {
  const quotas = getQuotas_(now);
  const emailOf = r => String(r[COL.email] || '').trim().toLowerCase();

  // Several rows can share one address, so blocks and first contact apply to the address, not the row.
  const blocked = new Set(), contacted = new Set();
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (BLOCKING_STATUSES.includes(r[COL.status])) blocked.add(emailOf(r));
    if (Number(r[COL.stage] || 0) > 0) contacted.add(emailOf(r));
  }

  // Priority 1: due follow-ups
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!win.countries.includes(countryCode_(r))) continue;
    if (DONE_STATUSES.includes(r[COL.status]) || blocked.has(emailOf(r))) continue;
    const stage = Number(r[COL.stage] || 0);
    const last = r[COL.lastSentAt] instanceof Date ? r[COL.lastSentAt] : null;
    if (!last) continue;
    const hrs = (now - last) / 3600000;
    if (stage === 1 && hrs >= CFG.FOLLOWUP2_AFTER_HOURS && (state.followup1 || 0) < CFG.DAILY_FOLLOWUP1) return { rowIdx: i, stage: 2 };
    if (stage === 2 && hrs >= CFG.FOLLOWUP3_AFTER_HOURS && (state.followup2 || 0) < CFG.DAILY_FOLLOWUP2) return { rowIdx: i, stage: 3 };
  }
  // Priority 2: new leads within today's country quota
  if ((state.newSent || 0) >= CFG.DAILY_NEW) return null;
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const cc = countryCode_(r);
    if (!win.countries.includes(cc)) continue;
    if ((state.cc[cc] || 0) >= (quotas[cc] || 0)) continue;
    if (blocked.has(emailOf(r)) || contacted.has(emailOf(r))) continue;
    const status = String(r[COL.status] || 'ready');
    if (Number(r[COL.stage] || 0) === 0 && (status === 'ready' || status === '') && r[COL.email]) return { rowIdx: i, stage: 1 };
  }
  return null;
}

// ============================== EMAIL ==============================
function rowToLead_(r) {
  return {
    id: r[COL.id], businessName: r[COL.businessName] || 'your business', decisionMaker: r[COL.decisionMaker] || '',
    email: String(r[COL.email] || '').trim(), city: r[COL.city] || 'your city', cc: countryCode_(r),
    problem: r[COL.coreProblem] || '', leak: r[COL.financialLeak] || '',
    solution: r[COL.solution] || 'direct digital ordering', threadId: r[COL.threadId], messageId: r[COL.messageId],
    subject: r[COL.subject]
  };
}

// Lower-cases an issue for use mid-sentence, keeping acronyms such as HTTPS, GCC or VIP.
function lowerIssue_(p) {
  return String(p || '').split(' ').map(w => /^[A-Z0-9&]{2,}[a-z]?$/.test(w) ? w : w.toLowerCase()).join(' ');
}

// Picks the sentence variants that bring the first email closest to 48 words (target: 45–50).
// Keep in sync with build_short_pitch in scripts/outreach_engine.py and js/pitchEngine.js.
function buildShortPitch_(first, biz, city, problem, leak) {
  const name = biz.replace(/\s*\([^)]*\)/g, '').trim() || biz;
  const issue = lowerIssue_(problem).replace(/\.+$/, '');
  const cost = String(leak || '').split('(')[0].trim().replace(/\s*[–-]\s*/g, '–');
  // No issue found for a lead: ask a question instead of claiming one.
  const opens = issue ? [
    `While looking into ${name} online, I noticed a possible issue: ${issue}.`,
    `Looking at ${name} online, I noticed a possible issue: ${issue}.`,
    `I noticed a possible issue at ${name}: ${issue}.`
  ] : [
    `I came across ${name} online and had a quick question: is your website bringing in as many enquiries as it could?`,
    `Quick question about ${name}: is your website bringing in as many enquiries as it could?`
  ];
  // No proven figure for a lead: say so in general terms instead of quoting a number.
  const costs = !issue ? [''] : cost
    ? [`This typically costs businesses like yours around ${cost}.`, `This typically costs around ${cost}.`]
    : ['Issues like this usually cost businesses enquiries.', 'This usually costs enquiries.'];
  const fixes = issue
    ? ['We build custom systems that fix this and keep revenue direct.', 'We build systems that fix this directly.', 'We fix this directly.']
    : ['We build websites and booking systems that turn more visitors into customers.', 'We help businesses get more enquiries from their website.', 'We help with exactly that.'];
  const asks = ['Would you be open to a 2-minute video walkthrough?', 'Open to a 2-minute video walkthrough?'];
  const stops = ["If you're not interested, just reply 'stop'.", "Not interested? Reply 'stop'."];

  let best = '', bestScore = Infinity;
  opens.forEach(o => costs.forEach(c => fixes.forEach(f => asks.forEach(a => stops.forEach(s => {
    const body = `Hi ${first},\n\n${[o, c].filter(Boolean).join(' ')}\n\n${f} ${a}\n\n${s}`;
    const score = Math.abs(body.trim().split(/\s+/).length - 48);
    if (score < bestScore) { best = body; bestScore = score; }
  })))));
  return best;
}

// Adds the sender's postal address under every email once CFG.POSTAL_ADDRESS is filled in
// (US CAN-SPAM requires a valid physical postal address; check UK and Canadian rules too).
function buildEmail_(lead, stage) {
  const email = buildEmailCore_(lead, stage);
  if (CFG.POSTAL_ADDRESS) email.body += `\n\n--\n${CFG.BUSINESS_NAME}, ${CFG.POSTAL_ADDRESS}`;
  return email;
}

function buildEmailCore_(lead, stage) {
  const dm = lead.decisionMaker || 'there';
  let first = dm.split(/\s+/)[0].replace('&', '').trim();
  if (!first || ['The', 'Mr.', 'Dr.'].includes(first)) first = dm;
  const biz = lead.businessName;
  const name = biz.replace(/\s*\([^)]*\)/g, '').trim() || biz;
  const baseSubject = lead.subject || `Quick observation regarding ${biz} direct revenue funnel`;

  if (stage === 1) {
    return { subject: baseSubject, body: buildShortPitch_(first, biz, lead.city, lead.problem, lead.leak) };
  }
  if (stage === 2) {
    return {
      subject: 'Re: ' + baseSubject,
      body: `Hi ${first},\n\nFloating this back up in case it got buried.\n\n` +
        `Still open to a 2-minute video walkthrough on ${lead.problem ? 'fixing this' : 'getting more enquiries'} for ${name}?\n\nNot interested? Reply 'stop'.`
    };
  }
  const topic = lead.problem ? lowerIssue_(lead.problem) : 'getting more from your website';
  return {
    subject: 'Re: ' + baseSubject,
    body: `Hi ${first},\n\nI won't follow up again. If ${topic} ever becomes a priority, just reply here.\n\n` +
      `Wishing ${name} continued success!`
  };
}

function toHtml_(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1e293b">' +
    text.split('\n\n').map(p => `<p style="margin:0 0 12px 0">${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + '</div>';
}

function trackingPixel_(lead, stage) {
  if (!CFG.TRACKING_URL || !lead.id) return '';
  const src = `${CFG.TRACKING_URL}?o=${encodeURIComponent(lead.id)}&s=${stage}`;
  return `<img src="${src}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">`;
}

function validateEmail_(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
  const domain = email.split('@')[1].toLowerCase();
  if (INVALID_DOMAIN_PATTERNS.some(p => p.test(domain) || p.test(email))) return 'Blacklisted domain: ' + domain;
  try {
    const res = UrlFetchApp.fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const j = JSON.parse(res.getContentText());
      if (!j.Answer || !j.Answer.some(a => a.type === 15)) return 'No MX records for ' + domain;
    }
  } catch (e) { /* DNS check unavailable — allow */ }
  return '';
}

function sendStage_(lead, stage) {
  const invalid = validateEmail_(lead.email);
  if (invalid) return { ok: false, invalid: true, error: invalid };

  const { subject, body } = buildEmail_(lead, stage);
  const html = CFG.PLAIN_TEXT ? '' : toHtml_(body) + trackingPixel_(lead, stage);
  const opts = CFG.PLAIN_TEXT ? {} : { htmlBody: html, name: CFG.SENDER_NAME, replyTo: CFG.REPLY_TO };
  try {
    if (stage === 1) {
      const msg = GmailApp.createDraft(lead.email, subject, body, opts).send();
      return { ok: true, threadId: msg.getThread().getId(), messageId: msg.getHeader('Message-ID') || '', subject };
    }
    // Follow-up: try a properly threaded reply via Gmail API, fall back to a "Re:" email.
    if (lead.threadId && lead.messageId) {
      const threaded = sendThreadedReply_(lead.email, subject, body, html, lead.threadId, lead.messageId);
      if (threaded === true) return { ok: true };
    }
    GmailApp.sendEmail(lead.email, subject, body, opts);
    return { ok: true, note: 'sent as Re: (not threaded)' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function sendThreadedReply_(to, subject, text, html, threadId, parentMsgId) {
  try {
    const me = Session.getEffectiveUser().getEmail();
    const b64 = s => Utilities.base64Encode(Utilities.newBlob(s).getBytes());
    const boundary = 'rh_' + Utilities.getUuid().replace(/-/g, '');
    const threadHeaders = [`Subject: =?UTF-8?B?${b64(subject)}?=`, `In-Reply-To: ${parentMsgId}`, `References: ${parentMsgId}`, 'MIME-Version: 1.0'];
    const mime = (CFG.PLAIN_TEXT ? [
      `From: ${me}`, `To: ${to}`, ...threadHeaders,
      'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text)
    ] : [
      `From: =?UTF-8?B?${b64(CFG.SENDER_NAME)}?= <${me}>`, `To: ${to}`, `Reply-To: ${CFG.REPLY_TO}`, ...threadHeaders,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text),
      `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html),
      `--${boundary}--`
    ]).join('\r\n');
    const res = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()), threadId })
    });
    return res.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

// ============================== REPLIES, BOUNCES, ALERTS ==============================
function ownAddresses_() {
  return [Session.getEffectiveUser().getEmail()].concat(GmailApp.getAliases()).map(a => String(a).toLowerCase());
}

// Looks for any response from this lead, however old and whichever Gmail folder it landed in.
function findResponse_(lead) {
  const own = ownAddresses_();
  const email = lead.email.toLowerCase();
  if (!own.includes(email) && GmailApp.search(`in:anywhere from:${email}`, 0, 1).length) {
    return { status: 'STOP_REPLIED', when: new Date() };
  }
  if (!lead.threadId) return null;
  let messages = [];
  try { messages = GmailApp.getThreadById(lead.threadId).getMessages(); } catch (e) { return null; }
  for (const m of messages) {
    const from = (m.getFrom().match(/<([^>]+)>/) || [null, m.getFrom()])[1].toLowerCase().trim();
    if (own.includes(from)) continue;
    return { status: /mailer-daemon|postmaster/.test(from) ? 'BOUNCED' : 'STOP_REPLIED', when: m.getDate() };
  }
  return null;
}

// Applies a stop or bounce to every row sharing this address.
function blockAddress_(sheet, values, email, response) {
  const target = String(email).trim().toLowerCase();
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (String(r[COL.email] || '').trim().toLowerCase() !== target) continue;
    if (BLOCKING_STATUSES.includes(r[COL.status])) continue;
    r[COL.status] = response.status;
    if (response.status === 'STOP_REPLIED') r[COL.repliedAt] = response.when;
    else r[COL.notes] = 'Bounced ' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm');
    sheet.getRange(i + 1, 1, 1, LEAD_HEADERS.length).setValues([r]);
  }
}

function checkRepliesAndBounces_(state) {
  const ss = getSS_();
  const sheet = ss.getSheetByName('Leads');
  const values = sheet.getDataRange().getValues();
  const byEmail = {}, byThread = {};
  for (let i = 1; i < values.length; i++) {
    const st = values[i][COL.status];
    if (!['stage1_sent', 'stage2_sent', 'FINISHED'].includes(st)) continue;
    byEmail[String(values[i][COL.email]).toLowerCase()] = i;
    if (values[i][COL.threadId]) byThread[values[i][COL.threadId]] = i;
  }
  if (!Object.keys(byEmail).length) return;

  const changed = new Set();
  const own = ownAddresses_();

  // Bounces
  GmailApp.search('in:anywhere from:(mailer-daemon OR postmaster) newer_than:14d', 0, 50).forEach(th => {
    let idx = byThread[th.getId()];
    if (idx === undefined) {
      const txt = th.getMessages().map(m => (m.getHeader('X-Failed-Recipients') || '') + ' ' + m.getPlainBody()).join(' ').toLowerCase();
      for (const em in byEmail) if (txt.includes(em)) { idx = byEmail[em]; break; }
    }
    if (idx !== undefined && values[idx][COL.status] !== 'BOUNCED') {
      values[idx][COL.status] = 'BOUNCED';
      values[idx][COL.notes] = 'Bounced ' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm');
      changed.add(idx);
      // Only bounces that arrived today count toward the daily auto-stop; older ones just get marked.
      const fresh = pktParts_(th.getLastMessageDate()).date === state.date;
      if (fresh) state.bounces++;
      log_('warn', `📭 Bounce${fresh ? '' : ' (old, not counted today)'}: ${values[idx][COL.businessName]} <${values[idx][COL.email]}> — removed from sequence`);
    }
  });

  // Replies
  GmailApp.search('in:anywhere -from:me newer_than:14d', 0, 100).forEach(th => {
    th.getMessages().forEach(m => {
      const from = (m.getFrom().match(/<([^>]+)>/) || [null, m.getFrom()])[1].toLowerCase().trim();
      if (own.includes(from) || /mailer-daemon|postmaster/.test(from)) return;
      let idx = byEmail[from];
      if (idx === undefined) idx = byThread[th.getId()];
      if (idx !== undefined && !['STOP_REPLIED', 'BOUNCED'].includes(values[idx][COL.status])) {
        values[idx][COL.status] = 'STOP_REPLIED';
        values[idx][COL.repliedAt] = m.getDate();
        changed.add(idx);
        log_('success', `🚨 REPLY from ${values[idx][COL.businessName]} <${from}> — follow-ups stopped. Subject: ${m.getSubject()}`);
      }
    });
  });

  changed.forEach(i => sheet.getRange(i + 1, 1, 1, LEAD_HEADERS.length).setValues([values[i]]));
  // Other rows with the same address must stop too.
  changed.forEach(i => blockAddress_(sheet, values, values[i][COL.email],
    { status: values[i][COL.status], when: values[i][COL.repliedAt] }));
  saveState_(state);

  if (state.bounces >= CFG.MAX_BOUNCES_PER_DAY) {
    ss.getSheetByName('Control').getRange('B1').setValue(false);
    PropertiesService.getScriptProperties().setProperty('WAS_RUNNING', '0');
    log_('error', `🛑 ${state.bounces} bounces today — engine auto-STOPPED to protect your Gmail account.`);
    GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), '🛑 RestoHunter engine auto-stopped (bounces)',
      `${state.bounces} emails bounced today, so the engine stopped itself to protect your Gmail reputation.\n\nCheck the Leads sheet (status = BOUNCED), fix or remove bad emails, then tick the ENGINE checkbox again.\n\n${ss.getUrl()}`);
  }
}

function checkLowLeads_(values, state) {
  if (state.lowAlertSent) return;
  const left = {};
  let total = 0;
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (Number(r[COL.stage] || 0) === 0 && ['ready', ''].includes(String(r[COL.status])) && r[COL.email]) {
      const cc = countryCode_(r); left[cc] = (left[cc] || 0) + 1; total++;
    }
  }
  const low = ['KW', 'BH', 'OM', 'GB', 'US', 'CA'].filter(cc => (left[cc] || 0) < 3);
  if (total < CFG.LOW_LEADS_ALERT_AT || low.length) {
    state.lowAlertSent = true;
    saveState_(state);
    const lines = ['KW', 'BH', 'OM', 'GB', 'US', 'CA'].map(cc => `${cc}: ${left[cc] || 0} left`).join('\n');
    GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), '⚠️ RestoHunter: leads khatam hone wale hain',
      `Ready (new) leads remaining: ${total}\n\n${lines}\n\nNaye leads add karein (Leads sheet mein nayi rows) ya Claude ko bolein "leads daal do".\n\n${getSS_().getUrl()}`);
    log_('warn', `⚠️ Low leads alert sent (${total} left; low: ${low.join(', ') || '—'})`);
  }
}

// ============================== STATE / UI HELPERS ==============================
function getSS_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function loadState_() {
  const today = pktParts_(new Date()).date;
  let s = {};
  try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('DAY_STATE') || '{}'); } catch (e) { }
  if (s.date !== today) s = { date: today, total: 0, newSent: 0, followups: 0, cc: {}, bounces: 0, lowAlertSent: false };
  return s;
}

function saveState_(s) {
  PropertiesService.getScriptProperties().setProperty('DAY_STATE', JSON.stringify(s));
}

function updateControl_(o) {
  const ctl = getSS_().getSheetByName('Control');
  if (!ctl) return;
  const s = o.state || loadState_();
  const props = PropertiesService.getScriptProperties();
  const nextAt = o.nextAt || Number(props.getProperty('NEXT_SEND_AT') || 0);
  const leadsSheet = getSS_().getSheetByName('Leads');
  let ready = '', emailed = 0, opened = 0, totalOpens = 0;
  if (leadsSheet && leadsSheet.getLastRow() > 1) {
    leadsSheet.getRange(2, 1, leadsSheet.getLastRow() - 1, LEAD_HEADERS.length).getValues().forEach(r => {
      if (ready === '') ready = 0;
      if (r[COL.status] === 'ready' || r[COL.status] === '') ready++;
      if (Number(r[COL.stage] || 0) > 0) emailed++;
      const count = Number(r[COL.openCount] || 0);
      if (count > 0) { opened++; totalOpens += count; }
    });
  }
  ctl.getRange('B3:B12').setValues([
    [o.status === 'RUNNING' ? '🟢 RUNNING' : '⚪ STOPPED'],
    [o.action || ''],
    [Utilities.formatDate(new Date(), CFG.TZ, 'EEE dd MMM, hh:mm a')],
    [`${s.total || 0} / ${CFG.DAILY_LIMIT}`],
    [`${s.newSent || 0} / ${CFG.DAILY_NEW}`],
    [`1st: ${s.followup1 || 0} / ${CFG.DAILY_FOLLOWUP1}, 2nd: ${s.followup2 || 0} / ${CFG.DAILY_FOLLOWUP2}`],
    [ready],
    [nextAt > Date.now() ? Utilities.formatDate(new Date(nextAt), CFG.TZ, 'hh:mm:ss a') : '—'],
    [s.bounces || 0],
    [props.getProperty('LAST_ERROR') || '—']
  ]);
  ctl.getRange('A13:B16').setValues([
    ['Businesses emailed', emailed],
    ['Businesses that opened', opened],
    ['Total opens', totalOpens],
    ['App link (Fetch, Start/Stop)', webAppUrl_() ? `${webAppUrl_()}?key=${controlKey_()}` : 'Deploy as Web app first']
  ]);
  ctl.getRange('A13:A16').setFontWeight('bold');
}

function ensureLeadHeaders_(sheet) {
  if (!sheet) return;
  const have = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (have[LEAD_HEADERS.length - 1] === LEAD_HEADERS[LEAD_HEADERS.length - 1]) return;
  sheet.getRange(1, 1, 1, LEAD_HEADERS.length).setValues([LEAD_HEADERS]).setFontWeight('bold');
}

function controlKey_() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('CONTROL_KEY');
  if (!key) { key = Utilities.getUuid(); props.setProperty('CONTROL_KEY', key); }
  return key;
}

function requireControlKey_(key) {
  if (key !== controlKey_()) throw new Error('Not allowed');
}

function log_(level, msg) {
  try {
    const ss = getSS_();
    let lg = ss.getSheetByName('Log');
    if (!lg) { lg = ss.insertSheet('Log'); lg.appendRow(['Time (PKT)', 'Level', 'Message']); }
    lg.insertRowAfter(1);
    lg.getRange(2, 1, 1, 3).setValues([[Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm:ss'), level, msg]]);
    if (lg.getLastRow() > 500) lg.deleteRows(501, lg.getLastRow() - 500);
  } catch (e) { console.log(level, msg); }
}

// ============================== LEAD FINDER (Fetch button) ==============================
// Finds food businesses on OpenStreetMap, reads each business's own website, and adds at most
// FINDER.MAX_ADD leads per Fetch. An email is used only if it is printed on the business's site,
// and a weakness only if it can be seen on that site. Nothing is invented.
const FINDER = {
  MAX_ADD: 5,
  MAX_CHECK: 30,             // websites checked per Fetch
  MAX_OVERPASS: 2,           // map searches per Fetch (moves to the next city if one is used up)
  RADIUS_M: 12000,
  BATCH: 10,                 // websites fetched in parallel
  TIME_BUDGET_MS: 50000,
  OVERPASS: ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'],
  SHEET: 'Finder',
  HEADERS: ['placeId', 'name', 'country', 'type', 'city', 'website', 'result', 'email', 'time'],
  COUNTRIES: {
    US: { name: 'United States', cities: [['New York', 40.7128, -74.006], ['Los Angeles', 34.0522, -118.2437], ['Chicago', 41.8781, -87.6298], ['Houston', 29.7604, -95.3698],
      ['Austin', 30.2672, -97.7431], ['Miami', 25.7617, -80.1918], ['Seattle', 47.6062, -122.3321], ['Denver', 39.7392, -104.9903], ['Boston', 42.3601, -71.0589], ['Atlanta', 33.749, -84.388]] },
    GB: { name: 'United Kingdom', cities: [['London', 51.5074, -0.1278], ['Manchester', 53.4808, -2.2426], ['Birmingham', 52.4862, -1.8904], ['Leeds', 53.8008, -1.5491],
      ['Glasgow', 55.8642, -4.2518], ['Liverpool', 53.4084, -2.9916], ['Bristol', 51.4545, -2.5879], ['Edinburgh', 55.9533, -3.1883]] },
    CA: { name: 'Canada', cities: [['Toronto', 43.6532, -79.3832], ['Vancouver', 49.2827, -123.1207], ['Montreal', 45.5017, -73.5673], ['Calgary', 51.0447, -114.0719],
      ['Ottawa', 45.4215, -75.6972], ['Edmonton', 53.5461, -113.4938]] },
    KW: { name: 'Kuwait', cities: [['Kuwait City', 29.3759, 47.9774], ['Hawalli', 29.3328, 48.0286], ['Salmiya', 29.3339, 48.0761], ['Farwaniya', 29.2775, 47.9586],
      ['Fahaheel', 29.0825, 48.1303], ['Jahra', 29.3375, 47.6581]] },
    OM: { name: 'Oman', cities: [['Muscat', 23.588, 58.3829], ['Seeb', 23.6703, 58.1891], ['Sohar', 24.347, 56.709], ['Salalah', 17.0151, 54.0924],
      ['Nizwa', 22.9333, 57.5333], ['Sur', 22.5667, 59.5289]] },
    BH: { name: 'Bahrain', cities: [['Manama', 26.2285, 50.586], ['Muharraq', 26.2572, 50.6119], ['Riffa', 26.13, 50.555], ['Isa Town', 26.1736, 50.5478],
      ['Hamad Town', 26.1153, 50.5069]] }
  },
  // OpenStreetMap tags for each business type
  TYPES: {
    'Restaurant': ['["amenity"="restaurant"]'],
    'Cafe': ['["amenity"="cafe"]'],
    'Bakery': ['["shop"="bakery"]'],
    'Fast food': ['["amenity"="fast_food"]'],
    'Burger': ['["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"burger"]'],
    'Pizza': ['["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"pizza"]'],
    'Seafood': ['["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"seafood|fish"]'],
    'Dessert shop': ['["shop"~"^(confectionery|pastry|chocolate)$"]', '["amenity"="ice_cream"]', '["amenity"~"^(cafe|restaurant)$"]["cuisine"~"dessert|ice_cream|frozen_yogurt|waffle|crepe"]'],
    'Juice bar': ['["amenity"~"^(cafe|fast_food|bar)$"]["cuisine"~"juice|smoothie|bubble_tea"]', '["shop"="beverages"]["cuisine"~"juice"]'],
    'Catering': ['["craft"="caterer"]', '["shop"="catering"]']
  },
  COMMISSION: '15–35% commission on every app order (industry estimates; delivery apps do not publish their rates)'
};

const FINDER_LINK_IN_BIO = /^(linktr\.ee|beacons\.ai|taplink\.(cc|at)|lnk\.bio|bio\.link|linkin\.bio|campsite\.bio|solo\.to|linkr\.bio|msha\.ke|carrd\.co|[a-z0-9-]+\.carrd\.co|bio\.site|tap\.bio|allmylinks\.com|linkpop\.com|hoo\.be|snipfeed\.co|komi\.io|stan\.store)$/i;
const FINDER_SOCIAL_ONLY = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|twitter\.com|x\.com|snapchat\.com|wa\.me|whatsapp\.com|google\.com|goo\.gl|g\.page|maps\.app\.goo\.gl|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|zomato\.com|talabat\.com|deliveroo\.[a-z.]+|ubereats\.com|doordash\.com)$/i;
const FINDER_DELIVERY = [['Talabat', /talabat\./i], ['Deliveroo', /deliveroo\./i], ['Uber Eats', /ubereats\.com|uber\.com\/[^"'\s]*eats/i], ['DoorDash', /doordash\.com/i],
  ['Grubhub', /grubhub\.com/i], ['Jahez', /jahez\./i], ['Keeta', /keeta(food)?\./i], ['HungerStation', /hungerstation\./i], ['Careem', /careem\.com/i],
  ['Just Eat', /just-?eat\./i], ['SkipTheDishes', /skipthedishes\./i], ['Postmates', /postmates\./i], ['Seamless', /seamless\.com/i], ['Menulog', /menulog\./i],
  ['foodpanda', /foodpanda\./i], ['Toters', /toters(api)?\./i], ['Noon Food', /noon\.com\/[^"'\s]*food/i]];
const FINDER_OWN_ORDERING = /ordable|toasttab\.com|chownow\.com|square\.site|squareup\.com\/[^"'\s]*order|olo\.com|gloriafood|fbgcdn\.com|menufy\.com|slicelife\.com|owner\.com|popmenu\.com\/[^"'\s]*order|clover\.com\/online-ordering|flipdish|foodbooking\.com|order\.online|orderonline|getbento\.com\/[^"'\s]*order|tryotter|kukd\.com|foodhub\.co|touch2success|orderswift|slerp\.com|orderyoyo|deliverect|cdn\.shopify\.com|myshopify\.com|woocommerce|ecwid|bigcommerce|add[\s-]*to[\s-]*(cart|basket|bag)/i;
const FINDER_BOOKING = /opentable|resy\.com|sevenrooms|exploretock|quandoo|thefork|eatapp|eat-app|tablein|resdiary|designmynight|bookatable|tablecheck|book\s*a\s*table|reserve\s*a\s*table|make\s*a\s*reservation|table\s*booking|reservations?\b/i;
const FINDER_PLACEHOLDER = [[/lorem ipsum/i, 'lorem ipsum'], [/under construction/i, 'under construction'], [/just another wordpress site/i, 'Just another WordPress site'],
  [/\bsample page\b/i, 'Sample Page'], [/\bhello world!/i, 'Hello world!'], [/your (company|business|restaurant) name here/i, 'your company name here']];
const FINDER_I18N_KEY = />\s*((?:nav|menu|home|header|footer|common|button|btn|label|title|page|general|cart|checkout)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*</i;
const FINDER_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const FINDER_EMAIL_JUNK = /\.(png|jpe?g|gif|svg|webp|bmp|ico|css|js)$|@(example\.|sentry|.*wixpress\.com$|.*sentry\.io$)|^(no-?reply|donotreply|do-not-reply)@|@(domain|yourdomain|email|mysite|website)\.com$/i;
const FINDER_BAD_LOCAL = /^(press|pr|media|careers?|jobs|recruit\w*|hr|privacy|gdpr|dpo|data\w*|accounts?|finance|invoices?|billing|marketing|webmaster|admin|legal|abuse|postmaster|hostmaster|security|support|investors?|wholesale|donations?)$/i;
const FINDER_FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|msn|aol|proton|protonmail)\.[a-z.]+$/i;
const FINDER_GENERIC = ['info', 'hello', 'contact', 'enquiries', 'enquiry', 'orders', 'order', 'reservations', 'reservation', 'bookings', 'booking', 'catering', 'events', 'office', 'team', 'eat', 'mail'];

function finderHost_(url) {
  const m = String(url || '').trim().match(/^(?:[a-z]+:\/\/)?([^\/?#:]+)/i);
  return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
}

function finderNormaliseUrl_(url) {
  let u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
}

// Emails printed on the pages: mailto links, plain text and Cloudflare-protected addresses.
function finderEmailsIn_(html) {
  let t = String(html || '');
  try { t = decodeURIComponent(t.replace(/%(?![0-9a-f]{2})/gi, '%25')); } catch (e) { }
  t = t.replace(/&#64;|&#x40;/gi, '@');
  const found = new Set((t.match(FINDER_EMAIL) || []).map(e => e.toLowerCase().replace(/\.+$/, '')));
  (String(html).match(/data-cfemail="([0-9a-f]+)"/gi) || []).forEach(m => {
    const h = m.split('"')[1];
    const k = parseInt(h.substr(0, 2), 16);
    let out = '';
    for (let i = 2; i < h.length; i += 2) out += String.fromCharCode(parseInt(h.substr(i, 2), 16) ^ k);
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(out)) found.add(out.toLowerCase());
  });
  return [...found];
}

// Bigram similarity of two domain names without their endings (kobedenver vs kobeandenver ≈ 0.8, kukd vs haweli = 0).
function finderNameSimilarity_(a, b) {
  const base = d => String(d).toLowerCase().replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/g, '');
  const grams = w => { const g = []; for (let i = 0; i < w.length - 1; i++) g.push(w.substr(i, 2)); return g; };
  const x = grams(base(a)), y = grams(base(b));
  if (!x.length || !y.length) return 0;
  const pool = y.slice(); let hit = 0;
  x.forEach(g => { const i = pool.indexOf(g); if (i >= 0) { hit++; pool.splice(i, 1); } });
  return 2 * hit / (x.length + y.length);
}

// pages: [{url, html}]. Returns {email, url} or {reason: 'no email' | 'email rejected'}.
function finderPickEmail_(pages, siteHost) {
  const all = [];
  pages.forEach(p => finderEmailsIn_(p.html).forEach(e => all.push({ email: e, url: p.url })));
  if (!all.length) return { reason: 'no email' };
  const seen = new Set();
  const ok = all.filter(x => {
    if (seen.has(x.email)) return false;
    seen.add(x.email);
    const local = x.email.split('@')[0];
    return !FINDER_EMAIL_JUNK.test(x.email) && !FINDER_BAD_LOCAL.test(local);
  });
  const host = String(siteHost || '').replace(/^www\./, '');
  const sameDomain = e => { const d = e.split('@')[1]; return host && (d === host || d.endsWith('.' + host) || host.endsWith('.' + d)); };
  // Another company's address on the page (web designer, ordering platform, hijacked domain) is not the business's email.
  // A different domain counts only as a mailto link whose name closely matches the site's (kobedenver.com on kobeandenver.com).
  const mailtos = new Set();
  pages.forEach(p => (String(p.html).match(/mailto:[^"'?\s>]+/gi) || []).forEach(m => mailtos.add(m.slice(7).toLowerCase())));
  const similar = e => host && mailtos.has(e) && finderNameSimilarity_(e.split('@')[1], host) >= 0.6;
  const usable = ok.filter(x => sameDomain(x.email) || FINDER_FREE_MAIL.test(x.email.split('@')[1]) || similar(x.email));
  if (!usable.length) return { reason: 'email rejected' };
  ok.length = 0; usable.forEach(x => ok.push(x));
  const rank = e => FINDER_GENERIC.indexOf(e.split('@')[0]) < 0 ? 99 : FINDER_GENERIC.indexOf(e.split('@')[0]);
  ok.sort((a, b) => (sameDomain(b.email) - sameDomain(a.email)) || (rank(a.email) - rank(b.email)));
  return { email: ok[0].email, url: ok[0].url };
}

function finderVisibleText_(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

// What can be seen on the site. Returns a lead weakness, or {skip: reason}.
function finderWeakness_(pages, siteUrl, isLinkInBio, now, businessName) {
  if (isLinkInBio) {
    return { problem: 'having only a link-in-bio page instead of a website', financialLeak: '', offer: 'website offer',
      evidence: `Website field points to a link-in-bio page (${siteUrl}), not a website of its own.` };
  }
  const html = pages.map(p => p.html).join('\n');
  const text = finderVisibleText_(html);
  const hrefs = (html.match(/href\s*=\s*["'][^"']+["']/gi) || []).join(' ');
  const host = finderHost_(siteUrl);

  // Claim nothing about a page we could not really read (JavaScript-only app, bot check, empty page),
  // or a page that is not this business's own (shared campus or mall page, expired domain).
  if (text.trim().length < 400 || /enable javascript|checking your browser|just a moment|one moment, please|verify you are (a )?human|attention required|access denied|request is being verified|captcha/i.test(text)) {
    return { skip: 'website not readable' };
  }
  const STOP = /^(the|and|restaurant|restaurants|cafe|café|coffee|kitchen|grill|house|bakery|pizza|pizzeria|burger|burgers|bar|lounge|shop|food|foods|dining|centre|center|bistro|express|branch|co|ltd|llc)$/i;
  const tokens = String(businessName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(t => t.length >= 4 && !STOP.test(t));
  const lowText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (tokens.length && !tokens.some(t => lowText.includes(t) || host.includes(t))) return { skip: 'website is not the business\'s own' };

  for (const [re, label] of FINDER_PLACEHOLDER) {
    if (re.test(text)) {
      return { problem: `placeholder text left on your website ("${label}")`, financialLeak: '', offer: 'website clean-up and refresh',
        evidence: `The site shows template text "${label}".` };
    }
  }
  const key = html.match(FINDER_I18N_KEY);
  if (key) {
    return { problem: `placeholder text left on your website ("${key[1]}")`, financialLeak: '', offer: 'website clean-up and refresh',
      evidence: `The site shows a raw translation key "${key[1]}" instead of real text.` };
  }

  const ownOrderLink = (hrefs.match(/href\s*=\s*["'][^"']+["']/gi) || []).some(h => {
    const u = h.replace(/^href\s*=\s*["']|["']$/gi, '');
    const uh = finderHost_(u.startsWith('/') ? siteUrl : u);
    return (uh === host || uh.endsWith('.' + host) || u.startsWith('/')) && (/^order\./i.test(uh) || /\/order(s|-online|ing)?(\/|$|\?|#)/i.test(u));
  });
  const ownOrdering = ownOrderLink || FINDER_OWN_ORDERING.test(html);
  const apps = FINDER_DELIVERY.filter(([, re]) => re.test(hrefs)).map(([n]) => n);
  if (apps.length && !ownOrdering) {
    return { problem: 'relying on delivery apps for online orders', financialLeak: FINDER.COMMISSION, offer: 'own commission-free online ordering',
      evidence: `Website links to ${apps.join(', ')} for orders; no ordering system of its own found.` };
  }
  const booking = FINDER_BOOKING.test(text) || FINDER_BOOKING.test(hrefs);
  if (!ownOrdering && !booking) {
    const years = (text.match(/(?:©|&copy;|copyright)\s*(?:(?:19|20)\d{2}\s*[-–]\s*)?((?:19|20)\d{2})/gi) || [])
      .map(m => Number((m.match(/((?:19|20)\d{2})\s*$/) || [])[1])).filter(Boolean);
    const newest = years.length ? Math.max.apply(null, years) : 0;
    const old = newest && (now || new Date()).getFullYear() - newest >= 4;
    return { problem: 'the missing online ordering and table booking on your website' + (old ? ` (last updated in ${newest})` : ''),
      financialLeak: '', offer: 'online ordering and table booking',
      evidence: 'No online ordering and no table booking found on the home or contact pages' + (old ? `; newest © year is ${newest}.` : '.') };
  }
  return { skip: ownOrdering ? 'own ordering' : 'no visible weakness' };
}

function finderFetchAll_(urls) {
  const reqs = urls.map(u => ({ url: u, muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: false,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', 'Accept-Language': 'en' } }));
  const text = r => { try { return r.getResponseCode() === 200 ? r.getContentText().slice(0, 900000) : ''; } catch (e) { return ''; } };
  try { return UrlFetchApp.fetchAll(reqs).map(text); } catch (e) {
    return reqs.map(r => { try { return text(UrlFetchApp.fetch(r.url, r)); } catch (err) { return ''; } });
  }
}

function finderHasMx_(domains) {
  const res = finderFetchAll_(domains.map(d => `https://dns.google/resolve?name=${encodeURIComponent(d)}&type=MX`));
  return res.map(t => { try { const j = JSON.parse(t); return !!(j.Answer && j.Answer.some(a => a.type === 15)); } catch (e) { return false; } });
}

function finderOverpass_(type, lat, lon) {
  const parts = FINDER.TYPES[type].map(f => `nwr(around:${FINDER.RADIUS_M},${lat},${lon})["name"]${f}[!"brand:wikidata"];`).join('');
  const q = `[out:json][timeout:25];(${parts});out tags center 400;`;
  let lastError = '';
  for (const ep of FINDER.OVERPASS) {
    try {
      const r = UrlFetchApp.fetch(ep, { method: 'post', payload: { data: q }, muteHttpExceptions: true });
      if (r.getResponseCode() === 200) return JSON.parse(r.getContentText()).elements || [];
      lastError = `HTTP ${r.getResponseCode()}`;
    } catch (e) { lastError = String(e); }
  }
  throw new Error('Map search failed on all servers: ' + lastError);
}

function finderSheet_(ss) {
  let sh = ss.getSheetByName(FINDER.SHEET);
  if (!sh) {
    sh = ss.insertSheet(FINDER.SHEET);
    sh.getRange(1, 1, 1, FINDER.HEADERS.length).setValues([FINDER.HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function fetchLeads(key, cc, type) {
  requireControlKey_(key);
  const country = FINDER.COUNTRIES[cc];
  if (!country || !FINDER.TYPES[type]) throw new Error('Pick a country and a business type.');
  const started = Date.now();
  const now = new Date();
  const ss = getSS_();
  const leadsSheet = ss.getSheetByName('Leads');
  ensureLeadHeaders_(leadsSheet);
  const finder = finderSheet_(ss);

  // What is already known: leads (by email, website host and name) and every business checked before.
  const leadRows = leadsSheet.getLastRow() > 1 ? leadsSheet.getRange(2, 1, leadsSheet.getLastRow() - 1, LEAD_HEADERS.length).getValues() : [];
  const known = { email: {}, host: {}, name: {} };
  leadRows.forEach(r => {
    const emailed = Number(r[COL.stage] || 0) > 0;
    const mark = (map, k) => { if (k) map[k] = map[k] || emailed; };
    mark(known.email, String(r[COL.email] || '').trim().toLowerCase());
    mark(known.host, finderHost_(r[COL.website]));
    mark(known.name, `${String(r[COL.countryCode] || '').toUpperCase()}|${String(r[COL.businessName] || '').trim().toLowerCase()}`);
  });
  const checkedIds = new Set(finder.getLastRow() > 1 ? finder.getRange(2, 1, finder.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : []);
  const duplicateOf = (emailed) => emailed ? 'already emailed' : 'already in list';

  // Map search, moving to the next city when one has nothing new left.
  const props = PropertiesService.getScriptProperties();
  const cityKey = `FINDER_CITY_${cc}_${type}`;
  let cityIdx = Number(props.getProperty(cityKey) || 0);
  let candidates = [], city = '';
  for (let i = 0; i < FINDER.MAX_OVERPASS && !candidates.length; i++) {
    const c = country.cities[cityIdx % country.cities.length];
    city = c[0];
    candidates = finderOverpass_(type, c[1], c[2])
      .map(el => ({ placeId: `osm:${el.type}/${el.id}`, name: String((el.tags || {})['name:en'] || (el.tags || {}).name || '').trim(),
        website: (el.tags || {}).website || (el.tags || {})['contact:website'] || '' }))
      .filter(c2 => c2.name && !checkedIds.has(c2.placeId));
    if (!candidates.length) cityIdx++;
  }
  props.setProperty(cityKey, String(cityIdx));
  candidates.sort((a, b) => (!!b.website) - (!!a.website));
  candidates = candidates.slice(0, FINDER.MAX_CHECK);

  const results = [];   // {cand, result, email, row}
  const added = [];
  const queue = [];
  candidates.forEach(cand => {
    const site = finderNormaliseUrl_(cand.website);
    const host = finderHost_(site);
    const nameKey = `${cc}|${cand.name.toLowerCase()}`;
    if (!site || FINDER_SOCIAL_ONLY.test(host)) return results.push({ cand, result: 'no website' });
    if (host in known.host && !FINDER_LINK_IN_BIO.test(host)) return results.push({ cand, result: duplicateOf(known.host[host]) });
    if (nameKey in known.name) return results.push({ cand, result: duplicateOf(known.name[nameKey]) });
    queue.push({ cand, site, host, linkInBio: FINDER_LINK_IN_BIO.test(host) });
  });

  for (let b = 0; b < queue.length && added.length < FINDER.MAX_ADD && Date.now() - started < FINDER.TIME_BUDGET_MS; b += FINDER.BATCH) {
    const batch = queue.slice(b, b + FINDER.BATCH);
    const homes = finderFetchAll_(batch.map(x => x.site));
    batch.forEach((x, i) => { x.pages = homes[i] ? [{ url: x.site, html: homes[i] }] : []; });
    // contact pages for real websites that loaded but showed no usable email
    const needContact = batch.filter(x => x.pages.length && !x.linkInBio && !finderPickEmail_(x.pages, x.host).email);
    const contactUrls = [];
    needContact.forEach(x => { const base = x.site.replace(/\/+$/, ''); contactUrls.push(base + '/contact', base + '/contact-us'); });
    const contacts = contactUrls.length ? finderFetchAll_(contactUrls) : [];
    needContact.forEach((x, i) => [contacts[2 * i], contacts[2 * i + 1]].forEach((html, j) => {
      if (html) x.pages.push({ url: contactUrls[2 * i + j], html });
    }));

    const ready = [];
    batch.forEach(x => {
      if (!x.pages.length) return results.push({ cand: x.cand, result: 'website not loading' });
      const pick = finderPickEmail_(x.pages, x.linkInBio ? '' : x.host);
      if (!pick.email) return results.push({ cand: x.cand, result: pick.reason });
      if (pick.email in known.email) return results.push({ cand: x.cand, result: duplicateOf(known.email[pick.email]), email: pick.email });
      const weak = finderWeakness_(x.pages, x.site, x.linkInBio, now, x.cand.name);
      if (weak.skip) return results.push({ cand: x.cand, result: weak.skip, email: pick.email });
      ready.push({ x, pick, weak });
    });
    const mx = ready.length ? finderHasMx_(ready.map(r => r.pick.email.split('@')[1])) : [];
    ready.forEach((r, i) => {
      if (!mx[i]) return results.push({ cand: r.x.cand, result: 'email rejected', email: r.pick.email });
      if (added.length >= FINDER.MAX_ADD) return;          // not recorded: can be added by a later Fetch
      if (r.pick.email in known.email) return results.push({ cand: r.x.cand, result: 'already in list', email: r.pick.email });
      known.email[r.pick.email] = false;
      const row = new Array(LEAD_HEADERS.length).fill('');
      row[COL.id] = 'f_' + cc.toLowerCase() + '_' + r.x.cand.placeId.replace(/^osm:/, '').replace('/', '_');
      row[COL.businessName] = r.x.cand.name;
      row[COL.email] = r.pick.email;
      row[COL.website] = r.x.site;
      row[COL.city] = city;
      row[COL.country] = country.name;
      row[COL.countryCode] = cc;
      row[COL.niche] = type;
      row[COL.coreProblem] = r.weak.problem;
      row[COL.financialLeak] = r.weak.financialLeak;
      row[COL.solution] = r.weak.offer;
      row[COL.status] = 'ready';
      row[COL.stage] = 0;
      row[COL.notes] = `${r.weak.evidence} | Email shown on ${r.pick.url} | Source: OpenStreetMap ${r.x.cand.placeId.replace(/^osm:/, '')} | Checked ${Utilities.formatDate(now, CFG.TZ, 'yyyy-MM-dd')}`;
      added.push({ row, cand: r.x.cand });
      results.push({ cand: r.x.cand, result: 'added', email: r.pick.email });
    });
  }

  // Write: append only, holding the lock briefly.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (added.length) leadsSheet.getRange(leadsSheet.getLastRow() + 1, 1, added.length, LEAD_HEADERS.length).setValues(added.map(a => a.row));
    if (results.length) {
      const t = Utilities.formatDate(now, CFG.TZ, 'yyyy-MM-dd HH:mm');
      finder.getRange(finder.getLastRow() + 1, 1, results.length, FINDER.HEADERS.length)
        .setValues(results.map(r => [r.cand.placeId, r.cand.name, cc, type, city, r.cand.website || '', r.result, r.email || '', t]));
    }
  } finally {
    lock.releaseLock();
  }
  if (added.length) log_('success', `➕ Fetch added ${added.length} ${type} lead(s) in ${city}, ${country.name}`);

  const skipped = {};
  results.filter(r => r.result !== 'added').forEach(r => { skipped[r.result] = (skipped[r.result] || 0) + 1; });
  return {
    country: country.name, type, city, checked: results.length, skipped,
    details: results.map(r => ({ name: r.cand.name, website: r.cand.website || '', result: r.result, email: r.email || '' })),
    added: added.map(a => ({
      name: a.row[COL.businessName], email: a.row[COL.email], website: a.row[COL.website], weakness: a.row[COL.coreProblem], offer: a.row[COL.solution],
      firstEmail: buildEmail_(rowToLead_(a.row), 1)
    }))
  };
}

function getSentEmails(key) {
  requireControlKey_(key);
  const sheet = getSS_().getSheetByName('Leads');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const label = { STOP_REPLIED: 'replied', BOUNCED: 'bounced', FINISHED: 'finished', INVALID: 'invalid' };
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, LEAD_HEADERS.length).getValues()
    .filter(r => Number(r[COL.stage] || 0) > 0)
    .map(r => ({
      business: String(r[COL.businessName] || ''), email: String(r[COL.email] || ''), country: countryCode_(r),
      stage: ['', '1st email', '2nd email', '3rd email'][Number(r[COL.stage])] || String(r[COL.stage]),
      lastSent: r[COL.lastSentAt] instanceof Date ? Utilities.formatDate(r[COL.lastSentAt], CFG.TZ, 'yyyy-MM-dd HH:mm') : '',
      status: label[r[COL.status]] || 'waiting for reply'
    }))
    .sort((a, b) => (a.lastSent < b.lastSent ? 1 : -1));
}

function webAppUrl_() {
  try { const u = ScriptApp.getService().getUrl(); if (u) return u; } catch (e) { }
  return CFG.TRACKING_URL || '';
}

// ============================== OPEN TRACKING ==============================
function recordOpen_(leadId, stageParam) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const sheet = getSS_().getSheetByName('Leads');
    if (!sheet || sheet.getLastRow() < 2) return;
    ensureLeadHeaders_(sheet);
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, LEAD_HEADERS.length).getValues();
    const idx = rows.findIndex(r => String(r[COL.id]) === String(leadId));
    if (idx < 0) return;
    const r = rows[idx];
    const now = new Date();
    if (!(r[COL.lastSentAt] instanceof Date)) return;                  // never emailed: not a real open
    if (now - r[COL.lastSentAt] < 60000) return;                       // mail scanners load images on delivery
    if (r[COL.lastOpenedAt] instanceof Date && now - r[COL.lastOpenedAt] < 60000) return;  // same view reloaded
    const count = Number(r[COL.openCount] || 0);
    const stage = ['1', '2', '3'].includes(String(stageParam)) ? Number(stageParam) : '';
    sheet.getRange(idx + 2, COL.openCount + 1, 1, 4).setValues([[count + 1, r[COL.firstOpenedAt] || now, now, stage]]);
    if (count === 0) log_('success', `👁 Opened: ${r[COL.businessName]} <${r[COL.email]}> (stage ${stage})`);
  } finally {
    lock.releaseLock();
  }
}

// ============================== WEB APP: open tracking + Fetch / Emails sent / Start-Stop page ==============================
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.o) {
    try { recordOpen_(params.o, params.s); } catch (err) { console.log(err); }
    return HtmlService.createHtmlOutput('');
  }
  // Tracking needs public access, so the app page stays behind a private key.
  if (params.key !== controlKey_()) return HtmlService.createHtmlOutput('Not found');
  const opts = {
    countries: Object.keys(FINDER.COUNTRIES).map(cc => [cc, FINDER.COUNTRIES[cc].name]),
    types: Object.keys(FINDER.TYPES)
  };
  return HtmlService.createHtmlOutput(APP_HTML_
    .replace('__KEY__', JSON.stringify(controlKey_()))
    .replace('__OPTS__', JSON.stringify(opts)))
    .setTitle('RestoHunter').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

const APP_HTML_ = [
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RestoHunter</title>',
  '<style>',
  ':root{--bg:#f6f7f9;--card:#fff;--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--accent:#0f766e;--danger:#b91c1c;--ok:#047857}',
  '@media (prefers-color-scheme:dark){:root{--bg:#0f172a;--card:#111827;--ink:#e5e7eb;--muted:#9ca3af;--line:#1f2937;--accent:#14b8a6;--danger:#f87171;--ok:#34d399}}',
  '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif}',
  'main{max-width:960px;margin:0 auto;padding:16px}h1{font-size:20px;margin:4px 0 12px}h2{font-size:16px;margin:0 0 10px}',
  '.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 14px}',
  '.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}select,button{font:inherit;padding:9px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink)}',
  'button{cursor:pointer;font-weight:600}button.primary{background:var(--accent);border-color:var(--accent);color:#fff}button.danger{color:var(--danger)}button:disabled{opacity:.5;cursor:default}',
  '.muted{color:var(--muted)}.ok{color:var(--ok)}.bad{color:var(--danger)}table{width:100%;border-collapse:collapse;font-size:13px}',
  'th,td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--line);vertical-align:top;word-break:break-word}th{color:var(--muted);font-weight:600}',
  '.scroll{overflow-x:auto}pre{white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;margin:6px 0 0;font:12px/1.5 ui-monospace,Menlo,monospace}',
  '.pill{display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid var(--line);font-size:12px}',
  '</style></head><body><main>',
  '<h1>RestoHunter</h1>',
  '<section class="card"><h2>Engine</h2><div class="row"><span id="st" class="muted">Loading…</span>',
  '<button id="go" class="primary">Start</button><button id="stop" class="danger">Stop</button></div></section>',
  '<section class="card"><h2>Fetch leads</h2><div class="row">',
  '<select id="cc"></select><select id="type"></select><button id="fetch" class="primary">Fetch</button></div>',
  '<p class="muted" style="margin:8px 0 0">Adds at most 5 new leads per press, straight into the Leads tab. Emails come only from each business\'s own website.</p>',
  '<div id="out"></div></section>',
  '<section class="card"><div class="row" style="justify-content:space-between"><h2>Emails sent</h2><button id="refresh">Refresh</button></div>',
  '<div id="sent" class="scroll muted">Loading…</div></section>',
  '</main><script>',
  'var KEY=__KEY__, OPTS=__OPTS__;',
  'function $(id){return document.getElementById(id);}',
  'function esc(s){return String(s==null?"":s).replace(/[&<>"\']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c];});}',
  'OPTS.countries.forEach(function(c){var o=document.createElement("option");o.value=c[0];o.textContent=c[1];$("cc").appendChild(o);});',
  'OPTS.types.forEach(function(t){var o=document.createElement("option");o.value=t;o.textContent=t;$("type").appendChild(o);});',
  'function fail(where){return function(e){where.innerHTML="<p class=\\"bad\\">"+esc(e&&e.message||e)+"</p>";};}',
  'function showStatus(s){$("st").innerHTML=(s.on?"<b class=\\"ok\\">Running</b>":"<b>Stopped</b>")+" · "+esc(s.action)+" · sent today "+esc(s.sent);$("go").disabled=s.on;$("stop").disabled=!s.on;}',
  'function loadStatus(){google.script.run.withSuccessHandler(showStatus).withFailureHandler(fail($("st"))).webStatus(KEY);}',
  '$("go").onclick=function(){if(!confirm("Start the engine? It will email ready leads during the sending windows."))return;google.script.run.withSuccessHandler(showStatus).webSetEngine(true,KEY);};',
  '$("stop").onclick=function(){google.script.run.withSuccessHandler(showStatus).webSetEngine(false,KEY);};',
  '$("fetch").onclick=function(){var b=$("fetch");b.disabled=true;b.textContent="Fetching… (up to a minute)";$("out").innerHTML="";',
  '  google.script.run.withSuccessHandler(function(r){b.disabled=false;b.textContent="Fetch";showResult(r);loadSent();}).withFailureHandler(function(e){b.disabled=false;b.textContent="Fetch";fail($("out"))(e);}).fetchLeads(KEY,$("cc").value,$("type").value);};',
  'function showResult(r){var h="<p><b>"+r.added.length+" added</b> · "+r.checked+" businesses checked in "+esc(r.city)+", "+esc(r.country)+"</p>";',
  '  if(r.added.length){h+="<div class=\\"scroll\\"><table><tr><th>Business</th><th>Email</th><th>Weakness</th><th>Offer</th></tr>";',
  '    r.added.forEach(function(a){h+="<tr><td>"+esc(a.name)+"<br><a href=\\""+esc(a.website)+"\\" target=\\"_blank\\" rel=\\"noopener\\">"+esc(a.website)+"</a></td><td>"+esc(a.email)+"</td><td>"+esc(a.weakness)+"</td><td>"+esc(a.offer)+"</td></tr>"+',
  '      "<tr><td colspan=\\"4\\"><details><summary class=\\"muted\\">First email</summary><pre>"+esc(a.firstEmail.subject)+"\\n\\n"+esc(a.firstEmail.body)+"</pre></details></td></tr>";});h+="</table></div>";}',
  '  var keys=Object.keys(r.skipped);if(keys.length){h+="<p style=\\"margin-top:12px\\"><b>Skipped:</b> "+keys.map(function(k){return "<span class=\\"pill\\">"+esc(k)+" "+r.skipped[k]+"</span>";}).join(" ")+"</p>";}',
  '  if(r.details.length){h+="<details><summary class=\\"muted\\">Every business checked</summary><div class=\\"scroll\\"><table><tr><th>Business</th><th>Result</th><th>Email</th></tr>";',
  '    r.details.forEach(function(d){h+="<tr><td>"+esc(d.name)+"</td><td>"+esc(d.result)+"</td><td>"+esc(d.email)+"</td></tr>";});h+="</table></div></details>";}',
  '  if(!r.checked)h+="<p class=\\"muted\\">Nothing new found here. Press Fetch again to try the next city, or pick another type.</p>";',
  '  $("out").innerHTML=h;}',
  'function loadSent(){google.script.run.withSuccessHandler(function(rows){if(!rows.length){$("sent").innerHTML="No emails sent yet.";return;}',
  '  var h="<table><tr><th>Business</th><th>Email</th><th>Country</th><th>Stage</th><th>Last sent</th><th>Status</th></tr>";',
  '  rows.forEach(function(x){h+="<tr><td>"+esc(x.business)+"</td><td>"+esc(x.email)+"</td><td>"+esc(x.country)+"</td><td>"+esc(x.stage)+"</td><td>"+esc(x.lastSent)+"</td><td>"+esc(x.status)+"</td></tr>";});',
  '  $("sent").innerHTML="<p class=\\"muted\\">"+rows.length+" businesses emailed</p>"+h+"</table>";$("sent").className="scroll";}).withFailureHandler(fail($("sent"))).getSentEmails(KEY);}',
  '$("refresh").onclick=loadSent;loadStatus();loadSent();setInterval(loadStatus,30000);',
  '</script></body></html>'
].join('\n');

function webStatus(key) {
  requireControlKey_(key);
  const ctl = getSS_().getSheetByName('Control');
  const v = ctl.getRange('B1:B12').getValues();
  return { on: v[0][0] === true, action: String(v[3][0] || ''), sent: String(v[5][0] || '0'), ready: String(v[8][0] || '') };
}

function webSetEngine(on, key) {
  requireControlKey_(key);
  getSS_().getSheetByName('Control').getRange('B1').setValue(Boolean(on));
  log_(on ? 'success' : 'warn', on ? '▶ Start pressed (web app)' : '■ Stop pressed (web app)');
  updateControl_({ status: on ? 'RUNNING' : 'STOPPED', action: on ? 'Starting… first check within 1 minute' : 'Engine is stopped' });
  return webStatus(key);
}
