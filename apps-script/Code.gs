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
 *
 * Fetch new leads: add LeadFinder.gs as a second file in this project (setup steps are at its top).
 * Its private page (run showAppLink) has engine Start / Stop, Fetch 5 leads by country and type,
 * the newly added leads, and every business already emailed.
 */

// ============================== SETTINGS ==============================
const CFG = {
  SENDER_NAME: 'Alex | MF Software Solutions',
  REPLY_TO: 'info.mfsoft@gmail.com',
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
    problem: r[COL.coreProblem] || 'ordering bottleneck', leak: r[COL.financialLeak] || 'a noticeable share of monthly revenue',
    solution: r[COL.solution] || 'direct digital ordering', threadId: r[COL.threadId], messageId: r[COL.messageId],
    subject: r[COL.subject]
  };
}

// Picks the sentence variants that bring the first email closest to 48 words (target: 45–50).
// Keep in sync with build_short_pitch in scripts/outreach_engine.py and js/pitchEngine.js.
function buildShortPitch_(first, biz, city, problem, leak) {
  const name = biz.replace(/\s*\([^)]*\)/g, '').trim() || biz;
  const issue = String(problem).toLowerCase().replace(/\.+$/, '');
  const cost = String(leak).split('(')[0].trim().replace(/\s*[–-]\s*/g, '–');
  const opens = [
    `While reviewing ${name}'s Google Maps profile in ${city}, I noticed a possible issue: ${issue}.`,
    `Reviewing ${name}'s Google Maps profile, I noticed a possible issue: ${issue}.`,
    `I noticed a possible issue at ${name}: ${issue}.`
  ];
  const costs = [`This typically costs venues like yours around ${cost}.`, `This typically costs around ${cost}.`];
  const fixes = ['We build custom systems that fix this and keep revenue direct.', 'We build systems that fix this directly.', 'We fix this directly.'];
  const asks = ['Would you be open to a 2-minute video walkthrough?', 'Open to a 2-minute video walkthrough?'];
  const stops = ["If you're not interested, just reply 'stop'.", "Not interested? Reply 'stop'."];

  let best = '', bestScore = Infinity;
  opens.forEach(o => costs.forEach(c => fixes.forEach(f => asks.forEach(a => stops.forEach(s => {
    const body = `Hi ${first},\n\n${o} ${c}\n\n${f} ${a}\n\n${s}`;
    const score = Math.abs(body.trim().split(/\s+/).length - 48);
    if (score < bestScore) { best = body; bestScore = score; }
  })))));
  return best;
}

function buildEmail_(lead, stage) {
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
        `Still open to a 2-minute video walkthrough on fixing this for ${name}?\n\nNot interested? Reply 'stop'.`
    };
  }
  return {
    subject: 'Re: ' + baseSubject,
    body: `Hi ${first},\n\nI won't follow up again. If ${String(lead.problem).toLowerCase()} ever becomes a priority, just reply here.\n\n` +
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
    ['Mobile control link', CFG.TRACKING_URL ? `${CFG.TRACKING_URL}?key=${controlKey_()}` : 'Add TRACKING_URL first']
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

// ============================== WEB APP: open tracking + optional mobile Start / Stop ==============================
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.o) {
    try { recordOpen_(params.o, params.s); } catch (err) { console.log(err); }
    return HtmlService.createHtmlOutput('');
  }
  // Tracking needs public access, so the app page stays behind a private key.
  if (params.key !== controlKey_()) return HtmlService.createHtmlOutput('Not found');
  return renderAppPage_();   // LeadFinder.gs: engine Start/Stop + Fetch leads + emails sent
}

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
