/**
 * RestoHunter AI — Google Apps Script Outreach Engine
 * Free, 24/7, runs on Google's servers and sends directly from your Gmail.
 *
 * SETUP (one time):
 *   1. Paste this whole file into Extensions → Apps Script (or script.google.com), Save.
 *   2. Select function "setup" at the top → Run → Allow.
 *   3. Go back to the Sheet → "Control" tab → tick the ENGINE checkbox to START, untick to STOP.
 *
 * Optional: Deploy → New deployment → Web app (Execute as: Me, Access: Only myself)
 *           gives you a mobile page with big Start / Stop buttons.
 */

// ============================== SETTINGS ==============================
const CFG = {
  SENDER_NAME: 'Alex | MF Software Solutions',
  REPLY_TO: 'info.mfsoft@gmail.com',
  DAILY_LIMIT: 45,                 // total emails per day (new + follow-ups)
  MIN_DELAY_SEC: 180,              // human pacing between emails: 3 min
  MAX_DELAY_SEC: 420,              // … to 7 min
  FOLLOWUP2_AFTER_HOURS: 48,       // stage 2 bump
  FOLLOWUP3_AFTER_HOURS: 72,       // stage 3 breakup (after stage 2)
  REPLY_CHECK_EVERY_MIN: 10,
  MAX_BOUNCES_PER_DAY: 5,          // auto-STOP engine if exceeded (protects Gmail reputation)
  LOW_LEADS_ALERT_AT: 10,          // email you when fewer ready leads remain
  TZ: 'Asia/Karachi',
  LEADS_SOURCE_URL: 'https://raw.githubusercontent.com/Fawwad345776/RestoHunter-AI/main/data/leads.json'
};

const LEAD_HEADERS = ['id', 'businessName', 'decisionMaker', 'email', 'website', 'city', 'country', 'countryCode',
  'niche', 'coreProblem', 'financialLeak', 'solution', 'status', 'stage', 'lastSentAt', 'threadId',
  'messageId', 'subject', 'repliedAt', 'notes'];
const COL = LEAD_HEADERS.reduce((m, h, i) => (m[h] = i, m), {});
const DONE_STATUSES = ['FINISHED', 'STOP_REPLIED', 'BOUNCED', 'INVALID'];

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

function importLeadsFromGitHub_(sheet) {
  const res = UrlFetchApp.fetch(CFG.LEADS_SOURCE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not download leads: HTTP ' + res.getResponseCode());
  const data = JSON.parse(res.getContentText());
  const rows = data.filter(l => l.email).map(l => {
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
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, LEAD_HEADERS.length).setValues(rows);
  return rows.length;
}

// ============================== MAIN LOOP (every minute) ==============================
function tick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    const ss = getSS_();
    const ctl = ss.getSheetByName('Control');
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
    const result = sendStage_(lead, stage);
    const rowNum = rowIdx + 1;

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
      else state.followups++;
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
  if ([6, 0, 1, 2, 3].includes(wd) && hm >= '10:30' && hm <= '13:30')
    return { active: true, name: 'Gulf Window', countries: ['KW', 'BH', 'OM'] };
  if ([0, 1, 2, 3, 4].includes(wd) && hm >= '14:00' && hm <= '17:00')
    return { active: true, name: 'UK Window', countries: ['GB'] };
  if ([0, 1, 2, 3, 4].includes(wd) && hm >= '18:30' && hm <= '21:30')
    return { active: true, name: 'North America Window', countries: ['US', 'CA'] };
  return { active: false, name: 'None', countries: [] };
}

function getQuotas_(d) {
  const { wd } = pktParts_(d);
  if (wd === 6) return { KW: 5, BH: 5, OM: 5, GB: 0, US: 0, CA: 0 };   // Sunday: Gulf
  if (wd === 4) return { KW: 0, BH: 0, OM: 0, GB: 5, US: 5, CA: 5 };   // Friday: West
  if (wd === 5) return { KW: 0, BH: 0, OM: 0, GB: 0, US: 0, CA: 0 };   // Saturday: off
  return { KW: 4, BH: 4, OM: 2, GB: 2, US: 3, CA: 2 };                 // Mon–Thu
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
  // Priority 1: due follow-ups
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!win.countries.includes(countryCode_(r))) continue;
    if (DONE_STATUSES.includes(r[COL.status])) continue;
    const stage = Number(r[COL.stage] || 0);
    const last = r[COL.lastSentAt] instanceof Date ? r[COL.lastSentAt] : null;
    if (!last) continue;
    const hrs = (now - last) / 3600000;
    if (stage === 1 && hrs >= CFG.FOLLOWUP2_AFTER_HOURS) return { rowIdx: i, stage: 2 };
    if (stage === 2 && hrs >= CFG.FOLLOWUP3_AFTER_HOURS) return { rowIdx: i, stage: 3 };
  }
  // Priority 2: new leads within today's country quota
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const cc = countryCode_(r);
    if (!win.countries.includes(cc)) continue;
    if ((state.cc[cc] || 0) >= (quotas[cc] || 0)) continue;
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
    problem: r[COL.coreProblem] || 'ordering bottleneck', leak: r[COL.financialLeak] || 'substantial margin',
    solution: r[COL.solution] || 'direct digital ordering', threadId: r[COL.threadId], messageId: r[COL.messageId],
    subject: r[COL.subject]
  };
}

function buildEmail_(lead, stage) {
  const dm = lead.decisionMaker || 'there';
  let first = dm.split(/\s+/)[0].replace('&', '').trim();
  if (!first || ['The', 'Mr.', 'Dr.'].includes(first)) first = dm;
  const biz = lead.businessName;
  const optOut = "\n\n---\nPS: If you're not the right person or not interested, just reply 'stop' and I won't reach out again.";
  const baseSubject = lead.subject || `Quick observation regarding ${biz} direct revenue funnel`;

  if (stage === 1) {
    return {
      subject: baseSubject,
      body: `Hi ${first},\n\nWhile reviewing ${biz}'s Google Maps profile in ${lead.city}, I noticed an operational bottleneck regarding your ${String(lead.problem).toLowerCase()}.\n\n` +
        `For a high-volume venue with your strong reviews, this typically causes around ${lead.leak} in lost margin every month.\n\n` +
        `We build custom ${String(lead.solution).toLowerCase()} systems that eliminate this commission bleed and capture customer revenue directly.\n\n` +
        `Would you be open to a 2-minute video walkthrough showing how this works for your team?${optOut}`
    };
  }
  if (stage === 2) {
    return {
      subject: 'Re: ' + baseSubject,
      body: `Hi ${first},\n\nWanted to float this back up in case it got buried under service prep.\n\n` +
        `Were you open to taking a look at that 2-minute video walkthrough showing how to stop the ${lead.leak} bottleneck for ${biz}?${optOut}`
    };
  }
  return {
    subject: 'Re: ' + baseSubject,
    body: `Hi ${first},\n\nI know you're super focused on running operations, so I won't follow up again.\n\n` +
      `If you ever want to revisit plugging the ${String(lead.problem).toLowerCase()} leakage down the road, feel free to reach out anytime. Wishing ${biz} continued success!${optOut}`
  };
}

function toHtml_(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1e293b">' +
    text.split('\n\n').map(p => `<p style="margin:0 0 12px 0">${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + '</div>';
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
  const html = toHtml_(body);
  try {
    if (stage === 1) {
      const msg = GmailApp.createDraft(lead.email, subject, body, { htmlBody: html, name: CFG.SENDER_NAME, replyTo: CFG.REPLY_TO }).send();
      return { ok: true, threadId: msg.getThread().getId(), messageId: msg.getHeader('Message-ID') || '', subject };
    }
    // Follow-up: try a properly threaded reply via Gmail API, fall back to a "Re:" email.
    if (lead.threadId && lead.messageId) {
      const threaded = sendThreadedReply_(lead.email, subject, body, html, lead.threadId, lead.messageId);
      if (threaded === true) return { ok: true };
    }
    GmailApp.sendEmail(lead.email, subject, body, { htmlBody: html, name: CFG.SENDER_NAME, replyTo: CFG.REPLY_TO });
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
    const mime = [
      `From: =?UTF-8?B?${b64(CFG.SENDER_NAME)}?= <${me}>`,
      `To: ${to}`,
      `Reply-To: ${CFG.REPLY_TO}`,
      `Subject: =?UTF-8?B?${b64(subject)}?=`,
      `In-Reply-To: ${parentMsgId}`,
      `References: ${parentMsgId}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text),
      `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html),
      `--${boundary}--`
    ].join('\r\n');
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
  const me = Session.getEffectiveUser().getEmail().toLowerCase();

  // Bounces
  GmailApp.search('from:(mailer-daemon OR postmaster) newer_than:3d', 0, 50).forEach(th => {
    let idx = byThread[th.getId()];
    if (idx === undefined) {
      const txt = th.getMessages().map(m => (m.getHeader('X-Failed-Recipients') || '') + ' ' + m.getPlainBody()).join(' ').toLowerCase();
      for (const em in byEmail) if (txt.includes(em)) { idx = byEmail[em]; break; }
    }
    if (idx !== undefined && values[idx][COL.status] !== 'BOUNCED') {
      values[idx][COL.status] = 'BOUNCED';
      values[idx][COL.notes] = 'Bounced ' + Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm');
      changed.add(idx);
      state.bounces++;
      log_('warn', `📭 Bounce: ${values[idx][COL.businessName]} <${values[idx][COL.email]}> — removed from sequence`);
    }
  });

  // Replies
  GmailApp.search('in:inbox -from:me newer_than:3d', 0, 100).forEach(th => {
    th.getMessages().forEach(m => {
      const from = (m.getFrom().match(/<([^>]+)>/) || [null, m.getFrom()])[1].toLowerCase().trim();
      if (from === me || /mailer-daemon|postmaster/.test(from)) return;
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
  let ready = '';
  if (leadsSheet && leadsSheet.getLastRow() > 1) {
    const st = leadsSheet.getRange(2, COL.status + 1, leadsSheet.getLastRow() - 1, 1).getValues();
    ready = st.filter(r => r[0] === 'ready' || r[0] === '').length;
  }
  ctl.getRange('B3:B12').setValues([
    [o.status === 'RUNNING' ? '🟢 RUNNING' : '⚪ STOPPED'],
    [o.action || ''],
    [Utilities.formatDate(new Date(), CFG.TZ, 'EEE dd MMM, hh:mm a')],
    [`${s.total || 0} / ${CFG.DAILY_LIMIT}`],
    [s.newSent || 0],
    [s.followups || 0],
    [ready],
    [nextAt > Date.now() ? Utilities.formatDate(new Date(nextAt), CFG.TZ, 'hh:mm:ss a') : '—'],
    [s.bounces || 0],
    [props.getProperty('LAST_ERROR') || '—']
  ]);
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

// ============================== OPTIONAL MOBILE WEB APP (Start / Stop) ==============================
function doGet() {
  return HtmlService.createHtmlOutput(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RestoHunter Engine</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px 16px;text-align:center}
h1{font-size:20px;margin:0 0 4px}#st{font-size:15px;margin:14px 0 22px;color:#94a3b8;line-height:1.6}
button{width:100%;max-width:340px;height:64px;font-size:20px;font-weight:800;border:0;border-radius:14px;margin:8px 0;color:#fff;cursor:pointer}
#go{background:#059669}#stop{background:#dc2626}button:disabled{opacity:.35}</style></head><body>
<h1>⚡ RestoHunter Engine</h1><div id="st">Loading…</div>
<button id="go" onclick="set(true)">▶ START</button><br><button id="stop" onclick="set(false)">■ STOP</button>
<script>
function show(s){document.getElementById('st').innerHTML='<b style="font-size:18px;color:'+(s.on?'#34d399':'#94a3b8')+'">'+(s.on?'🟢 RUNNING':'⚪ STOPPED')+'</b><br>'+s.action+'<br>Sent today: '+s.sent+'<br>Ready leads: '+s.ready;
document.getElementById('go').disabled=s.on;document.getElementById('stop').disabled=!s.on;}
function load(){google.script.run.withSuccessHandler(show).webStatus();}
function set(on){google.script.run.withSuccessHandler(show).webSetEngine(on);}
load();setInterval(load,15000);
</script></body></html>`).setTitle('RestoHunter Engine').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function webStatus() {
  const ctl = getSS_().getSheetByName('Control');
  const v = ctl.getRange('B1:B12').getValues();
  return { on: v[0][0] === true, action: String(v[3][0] || ''), sent: String(v[5][0] || '0'), ready: String(v[8][0] || '') };
}

function webSetEngine(on) {
  getSS_().getSheetByName('Control').getRange('B1').setValue(Boolean(on));
  log_(on ? 'success' : 'warn', on ? '▶ Start pressed (web app)' : '■ Stop pressed (web app)');
  updateControl_({ status: on ? 'RUNNING' : 'STOPPED', action: on ? 'Starting… first check within 1 minute' : 'Engine is stopped' });
  return webStatus();
}
