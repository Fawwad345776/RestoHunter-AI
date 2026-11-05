#!/usr/bin/env python3
"""
RestoHunter AI - 100% Ban-Safe Cold Outreach & Follow-Up Engine
Automated multi-stage SMTP sender with human-like pacing, PKT timezone scheduling,
same-thread RFC header follow-ups, IMAP reply detection, and MX record pre-validation.
"""

import os
import sys
import json
import time
import random
import re
import socket
import subprocess
import smtplib
import imaplib
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from datetime import datetime, timezone, timedelta
import threading

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.environ.get('DATA_DIR') or os.path.join(BASE_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)
# In the cloud the config lives on the persistent volume; locally it stays in the project root.
CONFIG_FILE = os.path.join(DATA_DIR, 'config.json') if os.environ.get('DATA_DIR') else os.path.join(BASE_DIR, 'config.json')
LEADS_FILE = os.path.join(DATA_DIR, 'leads.json')
DISPATCHES_FILE = os.path.join(DATA_DIR, 'dispatches.json')
REPLIES_FILE = os.path.join(DATA_DIR, 'replies.json')
OUTREACH_STATE_FILE = os.path.join(DATA_DIR, 'outreach_state.json')

# PKT Timezone is UTC + 5 hours
PKT_TZ = timezone(timedelta(hours=5))

# Blacklisted domain patterns / image extensions
INVALID_DOMAIN_PATTERNS = [
    r'\.(png|jpg|jpeg|svg|gif|webp|bmp|ico)$',
    r'wordpress\.org$',
    r'wix\.com$',
    r'sentry\.io$',
    r'example\.com$',
    r'domain\.com$',
    r'test\.com$',
    r'localhost$'
]

DEFAULT_CONFIG = {
    "gmail_address": "info.mfsoft@gmail.com",
    "gmail_app_password": "",
    "sender_name": "Alex | MF Software Solutions",
    "reply_to": "info.mfsoft@gmail.com",
    "daily_limit": 45,
    "min_delay_seconds": 180,
    "max_delay_seconds": 420,
    "auto_sender_enabled": False,
    "tracking_enabled": True,
    "tracking_base_url": "http://127.0.0.1:8765",
    "imap_check_interval_seconds": 300
}

def build_short_pitch(first, biz, city, problem, leak):
    """Picks the sentence variants that bring the first email closest to 48 words (target: 45-50).
    Keep in sync with buildShortPitch_ in apps-script/Code.gs and buildShortPitch in js/pitchEngine.js."""
    name = re.sub(r'\s*\([^)]*\)', '', biz).strip() or biz
    issue = str(problem).lower().rstrip('.')
    cost = re.sub(r'\s*[–-]\s*', '–', str(leak).split('(')[0].strip())
    opens = [
        f"While reviewing {name}'s Google Maps profile in {city}, I noticed a possible issue: {issue}.",
        f"Reviewing {name}'s Google Maps profile, I noticed a possible issue: {issue}.",
        f"I noticed a possible issue at {name}: {issue}.",
    ]
    costs = [f"This typically costs venues like yours around {cost}.", f"This typically costs around {cost}."]
    fixes = ["We build custom systems that fix this and keep revenue direct.", "We build systems that fix this directly.", "We fix this directly."]
    asks = ["Would you be open to a 2-minute video walkthrough?", "Open to a 2-minute video walkthrough?"]
    stops = ["If you're not interested, just reply 'stop'.", "Not interested? Reply 'stop'."]

    best, best_score = '', float('inf')
    for o in opens:
        for c in costs:
            for f in fixes:
                for a in asks:
                    for s in stops:
                        body = f"Hi {first},\n\n{o} {c}\n\n{f} {a}\n\n{s}"
                        score = abs(len(body.split()) - 48)
                        if score < best_score:
                            best, best_score = body, score
    return best


class OutreachEngine:
    def __init__(self):
        self.lock = threading.Lock()
        self.worker_thread = None
        self.running = False
        self.next_action_time = 0
        self.current_action_desc = "Idle"
        self.last_imap_check = 0
        self.recent_logs = []
        self._init_files()

    def _init_files(self):
        if not os.path.exists(CONFIG_FILE):
            self.save_config(DEFAULT_CONFIG)
        if not os.path.exists(OUTREACH_STATE_FILE):
            self._save_state({
                "date": self.get_pkt_now().strftime('%Y-%m-%d'),
                "total_sent_today": 0,
                "new_leads_sent_today": 0,
                "followups_sent_today": 0,
                "country_counts_today": {},
                "history": []
            })

    def get_pkt_now(self):
        return datetime.now(timezone.utc).astimezone(PKT_TZ)

    def load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                    # Environment variable overrides
                    if os.environ.get('GMAIL_ADDRESS'):
                        cfg['gmail_address'] = os.environ['GMAIL_ADDRESS']
                    if os.environ.get('GMAIL_APP_PASSWORD'):
                        cfg['gmail_app_password'] = os.environ['GMAIL_APP_PASSWORD']
                    if os.environ.get('RAILWAY_PUBLIC_DOMAIN'):
                        cfg['tracking_base_url'] = 'https://' + os.environ['RAILWAY_PUBLIC_DOMAIN']
                    return cfg
            except Exception as e:
                self.log(f"Error reading config.json: {e}", "error")
        return DEFAULT_CONFIG.copy()

    def save_config(self, cfg):
        try:
            cfg = dict(cfg)
            if os.environ.get('GMAIL_APP_PASSWORD'):
                cfg['gmail_app_password'] = ''  # secret comes from env, never written to disk
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2)
            return True
        except Exception as e:
            self.log(f"Error saving config.json: {e}", "error")
            return False

    def _load_state(self):
        today_str = self.get_pkt_now().strftime('%Y-%m-%d')
        state = {
            "date": today_str,
            "total_sent_today": 0,
            "new_leads_sent_today": 0,
            "followups_sent_today": 0,
            "country_counts_today": {},
            "history": []
        }
        if os.path.exists(OUTREACH_STATE_FILE):
            try:
                with open(OUTREACH_STATE_FILE, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                    if saved.get('date') == today_str:
                        return saved
                    else:
                        # Reset for the new day
                        state['date'] = today_str
                        self._save_state(state)
                        return state
            except Exception:
                pass
        return state

    def _save_state(self, state):
        try:
            with open(OUTREACH_STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            self.log(f"Error saving outreach_state.json: {e}", "error")

    def log(self, message, level="info"):
        timestamp = self.get_pkt_now().strftime('%H:%M:%S PKT')
        entry = {"time": timestamp, "message": message, "level": level}
        print(f"[{timestamp}] [{level.upper()}] {message}")
        with self.lock:
            self.recent_logs.insert(0, entry)
            if len(self.recent_logs) > 60:
                self.recent_logs.pop()

    # =========================================================================
    # PRE-SEND VALIDATION & DEAD EMAIL FILTER
    # =========================================================================
    def validate_recipient_email(self, email_str):
        if not email_str or '@' not in email_str:
            return False, "Invalid email format"

        email_clean = email_str.strip().lower()
        parts = email_clean.split('@')
        if len(parts) != 2:
            return False, "Malformed email address"

        domain = parts[1]

        # 1. Blacklist check
        for pat in INVALID_DOMAIN_PATTERNS:
            if re.search(pat, domain, re.IGNORECASE) or re.search(pat, email_clean, re.IGNORECASE):
                return False, f"Domain blacklisted or image file artifact: {domain}"

        # 2. DNS MX Record Verification (zero-dependency native check with fallback)
        has_mx, mx_info = self._check_mx_records(domain)
        if not has_mx:
            return False, f"No active MX records found for domain: {domain}"

        return True, f"Verified (MX: {mx_info})"

    def _check_mx_records(self, domain):
        # 1. Native macOS/Linux `host -t MX` command
        try:
            res = subprocess.run(['host', '-t', 'MX', domain], capture_output=True, text=True, timeout=4)
            if res.returncode == 0 and 'mail is handled by' in res.stdout:
                first_line = res.stdout.strip().split('\n')[0]
                return True, first_line.split('handled by')[-1].strip()
        except Exception:
            pass

        # 2. Native `nslookup -query=mx` fallback
        try:
            res = subprocess.run(['nslookup', '-query=mx', domain], capture_output=True, text=True, timeout=4)
            if res.returncode == 0 and 'mail exchanger' in res.stdout:
                return True, 'nslookup MX OK'
        except Exception:
            pass

        # 3. Socket fallback (checks if domain resolves at all)
        try:
            socket.gethostbyname(domain)
            return True, 'A-record verified'
        except Exception:
            return False, 'Domain does not resolve'

    # =========================================================================
    # REGION, TIMEZONE SCHEDULING & DAILY QUOTA LOGIC
    # =========================================================================
    def get_country_code(self, lead):
        code = (lead.get('countryCode') or '').upper()
        if code:
            return code
        c = (lead.get('country') or '').lower()
        if 'kuwait' in c: return 'KW'
        if 'bahrain' in c: return 'BH'
        if 'oman' in c: return 'OM'
        if 'united kingdom' in c or 'uk' in c: return 'GB'
        if 'united states' in c or 'usa' in c: return 'US'
        if 'canada' in c: return 'CA'
        return 'OTHER'

    def get_region_group(self, country_code):
        if country_code in ['KW', 'BH', 'OM']:
            return 'GULF'
        if country_code == 'GB':
            return 'UK'
        if country_code in ['US', 'CA']:
            return 'NORTH_AMERICA'
        return 'OTHER'

    def get_daily_quota_targets(self, now_pkt=None):
        """
        Returns quota targets for today based on User's explicit rule:
        - Sunday: Gulf countries (Kuwait, Bahrain, Oman) = 5 each. West = 0 (closed).
        - Friday: West countries (US, UK, Canada) = 5 each. Gulf = 0 (closed).
        - Mon-Thu: Kuwait: 4, Bahrain: 4, Oman: 2, UK: 2, USA: 3, Canada: 2.
        - Saturday: Weekend (0 new leads).
        """
        if now_pkt is None:
            now_pkt = self.get_pkt_now()

        weekday = now_pkt.weekday()  # Monday is 0, Sunday is 6

        # Sunday (weekday == 6)
        if weekday == 6:
            return {
                "KW": 5, "BH": 5, "OM": 5,
                "GB": 0, "US": 0, "CA": 0,
                "is_special_day": True,
                "special_name": "Sunday Gulf Power Dispatch (5 each)"
            }

        # Friday (weekday == 4)
        if weekday == 4:
            return {
                "KW": 0, "BH": 0, "OM": 0,
                "GB": 5, "US": 5, "CA": 5,
                "is_special_day": True,
                "special_name": "Friday Western Surge Dispatch (5 each)"
            }

        # Saturday (weekday == 5) - Full Weekend
        if weekday == 5:
            return {
                "KW": 0, "BH": 0, "OM": 0,
                "GB": 0, "US": 0, "CA": 0,
                "is_special_day": True,
                "special_name": "Saturday Global Weekend (Off)"
            }

        # Monday (0), Tuesday (1), Wednesday (2), Thursday (3) - Standard Business Days
        return {
            "KW": 4,
            "BH": 4,
            "OM": 2,
            "GB": 2,
            "US": 3,
            "CA": 2,
            "is_special_day": False,
            "special_name": "Standard Business Week Schedule"
        }

    def get_active_sending_window(self, now_pkt=None):
        """
        Enforces automated sending windows based on target country and working days:
        1. GULF (Kuwait, Oman, Bahrain):
           - 10:30 AM – 1:30 PM PKT
           - Sun to Thu ONLY (Strictly block Friday & Saturday).
        2. UK:
           - 2:00 PM – 5:00 PM PKT
           - Mon to Fri ONLY.
        3. NORTH AMERICA (US & Canada):
           - 6:30 PM – 9:30 PM PKT
           - Mon to Fri ONLY.
        """
        if now_pkt is None:
            now_pkt = self.get_pkt_now()

        weekday = now_pkt.weekday() # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
        current_time = now_pkt.time()

        # Gulf Window: 10:30 to 13:30 PKT (Sun=6, Mon=0, Tue=1, Wed=2, Thu=3)
        gulf_start = datetime.strptime("10:30", "%H:%M").time()
        gulf_end = datetime.strptime("13:30", "%H:%M").time()
        gulf_active_days = [6, 0, 1, 2, 3] # Sun, Mon, Tue, Wed, Thu

        if weekday in gulf_active_days and gulf_start <= current_time <= gulf_end:
            return {
                "active": True,
                "region": "GULF",
                "countries": ["KW", "BH", "OM"],
                "window_name": "Gulf Window (Kuwait, Bahrain, Oman)",
                "hours_pkt": "10:30 AM – 1:30 PM PKT"
            }

        # UK Window: 14:00 to 17:00 PKT (Mon=0 to Fri=4)
        uk_start = datetime.strptime("14:00", "%H:%M").time()
        uk_end = datetime.strptime("17:00", "%H:%M").time()
        uk_active_days = [0, 1, 2, 3, 4]

        if weekday in uk_active_days and uk_start <= current_time <= uk_end:
            return {
                "active": True,
                "region": "UK",
                "countries": ["GB"],
                "window_name": "United Kingdom Window",
                "hours_pkt": "2:00 PM – 5:00 PM PKT"
            }

        # North America Window: 18:30 to 21:30 PKT (Mon=0 to Fri=4)
        na_start = datetime.strptime("18:30", "%H:%M").time()
        na_end = datetime.strptime("21:30", "%H:%M").time()
        na_active_days = [0, 1, 2, 3, 4]

        if weekday in na_active_days and na_start <= current_time <= na_end:
            return {
                "active": True,
                "region": "NORTH_AMERICA",
                "countries": ["US", "CA"],
                "window_name": "North America Window (US & Canada)",
                "hours_pkt": "6:30 PM – 9:30 PM PKT"
            }

        # If no window is active right now
        return {
            "active": False,
            "region": "NONE",
            "countries": [],
            "window_name": "No active window right now",
            "hours_pkt": "Outside active timezone windows"
        }

    # =========================================================================
    # 3-STAGE FOLLOW-UP ENGINE IN THE SAME THREAD (COPYWRITING)
    # =========================================================================
    def build_email_content(self, lead, stage, initial_subject=None):
        biz_name = lead.get('businessName') or lead.get('name') or 'your venue'
        dm = lead.get('decisionMaker') or 'there'
        first_name = dm.split()[0].replace('&', '').strip()
        if not first_name or first_name in ['The', 'Mr.', 'Dr.']:
            first_name = dm

        solid_wp = lead.get('solidWeakPoint') or {}
        problem = solid_wp.get('coreProblem') or lead.get('flawTitle') or 'ordering bottleneck'
        leak = solid_wp.get('financialLeak') or lead.get('flawLeakRange') or 'a noticeable share of monthly revenue'
        city = lead.get('city') or 'your city'
        short_name = re.sub(r'\s*\([^)]*\)', '', biz_name).strip() or biz_name

        # Stage 1: Day 0 Initial Pitch (45-50 words, no links, soft CTA)
        if stage == 1:
            subject = f"Quick observation regarding {biz_name} direct revenue funnel"
            body = build_short_pitch(first_name, biz_name, city, problem, leak)
            return subject, body

        # Stage 2: Day 2 / 48 hours later (Quick 2-line bump in SAME thread)
        elif stage == 2:
            subject = f"Re: {initial_subject or f'Quick observation regarding {biz_name} direct revenue funnel'}"
            body = (
                f"Hi {first_name},\n\n"
                f"Floating this back up in case it got buried.\n\n"
                f"Still open to a 2-minute video walkthrough on fixing this for {short_name}?\n\n"
                f"Not interested? Reply 'stop'."
            )
            return subject, body

        # Stage 3: Day 5 / 72 hours later (Polite breakup message, same thread)
        elif stage == 3:
            subject = f"Re: {initial_subject or f'Quick observation regarding {biz_name} direct revenue funnel'}"
            body = (
                f"Hi {first_name},\n\n"
                f"I won't follow up again. If {problem.lower()} ever becomes a priority, just reply here.\n\n"
                f"Wishing {short_name} continued success!"
            )
            return subject, body

        return "Quick observation", "Hello"

    # =========================================================================
    # SMTP DISPATCHER WITH RFC SAME-THREAD HEADERS
    # =========================================================================
    def send_smtp_email(self, lead, stage, initial_subject=None, initial_message_id=None):
        cfg = self.load_config()
        gmail_user = cfg.get('gmail_address', '').strip()
        gmail_pass = cfg.get('gmail_app_password', '').replace(' ', '').strip()

        if not gmail_user or not gmail_pass:
            return False, "Gmail address or 16-digit App Password missing in config.json", None, None

        to_email = lead.get('email', '').strip()
        valid, val_msg = self.validate_recipient_email(to_email)
        if not valid:
            return False, f"Pre-send validation failed: {val_msg}", None, None

        subject, text_body = self.build_email_content(lead, stage, initial_subject)

        # Build clean HTML fallback
        html_paragraphs = "".join([f"<p style='margin: 0 0 12px 0;'>{p.replace(chr(10), '<br>')}</p>" for p in text_body.split('\n\n')])
        tracking_pixel = ""
        if cfg.get('tracking_enabled', True):
            base_url = cfg.get('tracking_base_url', 'http://127.0.0.1:8765').rstrip('/')
            tracking_pixel = f"<img src='{base_url}/api/track/open?lead={lead.get('id')}&stage={stage}&t={int(time.time())}' width='1' height='1' style='display:none;' alt='' />"

        html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1e293b;">
{html_paragraphs}
{tracking_pixel}
</body>
</html>"""

        msg = MIMEMultipart('alternative')
        msg['From'] = f"{cfg.get('sender_name', 'Alex')} <{gmail_user}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg['Date'] = formatdate(localtime=True)

        # RFC Message-ID Generation
        domain = gmail_user.split('@')[-1] if '@' in gmail_user else 'mfsoft.com'
        msg_id = make_msgid(idstring=f"rh_{lead.get('id')}_s{stage}", domain=domain)
        msg['Message-ID'] = msg_id

        if cfg.get('reply_to'):
            msg['Reply-To'] = cfg.get('reply_to')

        # 🚨 SAME-THREAD EMAIL HEADERS (For Stage 2 and Stage 3)
        if stage in [2, 3] and initial_message_id:
            clean_parent_id = initial_message_id.strip()
            if not clean_parent_id.startswith('<'):
                clean_parent_id = f"<{clean_parent_id}>"
            msg['In-Reply-To'] = clean_parent_id
            msg['References'] = clean_parent_id

        # Attach text primary and HTML fallback
        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))

        try:
            with smtplib.SMTP('smtp.gmail.com', 587, timeout=20) as server:
                server.starttls()
                server.login(gmail_user, gmail_pass)
                server.sendmail(gmail_user, [to_email], msg.as_string())

            return True, "Email delivered via Gmail SMTP TLS", msg_id, subject
        except smtplib.SMTPAuthenticationError:
            return False, "SMTP Authentication Failed: Please check your 16-digit Google App Password", None, None
        except Exception as e:
            return False, f"SMTP Send Error: {str(e)}", None, None

    # =========================================================================
    # INCOMING REPLY DETECTION (IMAP SCANNER)
    # =========================================================================
    def check_imap_replies(self):
        cfg = self.load_config()
        gmail_user = cfg.get('gmail_address', '').strip()
        gmail_pass = cfg.get('gmail_app_password', '').replace(' ', '').strip()

        if not gmail_user or not gmail_pass:
            return 0

        now_ts = time.time()
        # Rate-limit IMAP checks
        if (now_ts - self.last_imap_check) < cfg.get('imap_check_interval_seconds', 300):
            return 0
        self.last_imap_check = now_ts

        replies_found = 0
        try:
            with imaplib.IMAP4_SSL('imap.gmail.com', 993) as mail:
                mail.login(gmail_user, gmail_pass)
                mail.select('INBOX', readonly=True)

                # Search recent messages from last 7 days
                date_criterion = (datetime.now() - timedelta(days=7)).strftime("%d-%b-%Y")
                typ, data = mail.search(None, f'(SINCE "{date_criterion}")')
                if typ != 'OK':
                    return 0

                msg_nums = data[0].split()
                if not msg_nums:
                    return 0

                # Check last 30 messages
                recent_nums = msg_nums[-30:]

                # Load leads
                leads = []
                if os.path.exists(LEADS_FILE):
                    with open(LEADS_FILE, 'r', encoding='utf-8') as f:
                        leads = json.load(f)

                email_map = {l.get('email', '').lower(): l for l in leads if l.get('email')}
                updated_leads = False

                for num in reversed(recent_nums):
                    typ, msg_data = mail.fetch(num, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT IN-REPLY-TO DATE)])')
                    if typ != 'OK' or not msg_data:
                        continue

                    raw_headers = msg_data[0][1].decode('utf-8', errors='ignore')
                    header_msg = email.message_from_string(raw_headers)
                    sender = header_msg.get('From', '').lower()

                    for lead_email, lead in email_map.items():
                        if lead_email in sender:
                            # Matched an incoming reply!
                            if lead.get('outreach_status') != 'STOP_REPLIED':
                                lead['outreach_status'] = 'STOP_REPLIED'
                                lead['status'] = 'replied'
                                lead['crmStatus'] = 'replied'
                                lead['followupPaused'] = True
                                lead['replied_at'] = self.get_pkt_now().strftime('%Y-%m-%d %H:%M:%S PKT')
                                lead['reply_subject'] = header_msg.get('Subject', '')
                                updated_leads = True
                                replies_found += 1
                                self.log(f"🚨 INCOMING REPLY from {lead.get('businessName')} ({lead_email})! Auto-paused all follow-ups.", "warn")

                                # Save reply record
                                self._record_reply(lead, header_msg.get('Subject', 'Re: Outreach'))

                if updated_leads:
                    with open(LEADS_FILE, 'w', encoding='utf-8') as f:
                        json.dump(leads, f, indent=2)

        except Exception as e:
            self.log(f"IMAP reply scanner error: {e}", "warn")

        return replies_found

    def _record_reply(self, lead, subject):
        replies = []
        if os.path.exists(REPLIES_FILE):
            try:
                with open(REPLIES_FILE, 'r', encoding='utf-8') as f:
                    replies = json.load(f)
            except Exception:
                pass

        reply_record = {
            "id": f"rep_{int(time.time()*1000)}",
            "leadId": lead.get('id'),
            "businessName": lead.get('businessName'),
            "email": lead.get('email'),
            "subject": subject,
            "receivedAt": self.get_pkt_now().strftime('%Y-%m-%d %H:%M:%S PKT'),
            "status": "STOP_REPLIED (Follow-ups Cancelled)"
        }
        replies.insert(0, reply_record)
        try:
            with open(REPLIES_FILE, 'w', encoding='utf-8') as f:
                json.dump(replies, f, indent=2)
        except Exception:
            pass

    # =========================================================================
    # CANDIDATE SELECTION: FOLLOW-UPS (PRIORITY 1) + NEW LEADS (PRIORITY 2)
    # =========================================================================
    def select_next_candidate(self, active_window, state):
        if not os.path.exists(LEADS_FILE):
            return None, 0

        leads = []
        with open(LEADS_FILE, 'r', encoding='utf-8') as f:
            leads = json.load(f)

        now_pkt = self.get_pkt_now()
        active_countries = active_window.get('countries', [])
        quotas = self.get_daily_quota_targets(now_pkt)

        # -------------------------------------------------------------
        # 1. PRIORITY 1: DUE FOLLOW-UPS (STAGES 2 & 3 in the same thread)
        # -------------------------------------------------------------
        for lead in leads:
            cc = self.get_country_code(lead)
            if cc not in active_countries:
                continue

            status = lead.get('outreach_status', 'ready')
            if status in ['STOP_REPLIED', 'FINISHED', 'INVALID_DOMAIN']:
                continue

            stage = lead.get('outreach_stage', 0)
            last_sent_str = lead.get('last_sent_at')

            if stage == 1 and last_sent_str:
                # Stage 2 is due after 48 hours (2 days)
                try:
                    last_sent_dt = datetime.fromisoformat(last_sent_str)
                    if (now_pkt - last_sent_dt) >= timedelta(hours=48):
                        return lead, 2
                except Exception:
                    pass

            elif stage == 2 and last_sent_str:
                # Stage 3 is due after 72 hours (3 days after Stage 2)
                try:
                    last_sent_dt = datetime.fromisoformat(last_sent_str)
                    if (now_pkt - last_sent_dt) >= timedelta(hours=72):
                        return lead, 3
                except Exception:
                    pass

        # -------------------------------------------------------------
        # 2. PRIORITY 2: NEW LEADS (STAGE 1) RESPECTING USER DAILY QUOTAS
        # -------------------------------------------------------------
        country_counts_today = state.get('country_counts_today', {})

        for lead in leads:
            cc = self.get_country_code(lead)
            if cc not in active_countries:
                continue

            target = quotas.get(cc, 0)
            sent_so_far = country_counts_today.get(cc, 0)

            if sent_so_far >= target:
                continue # Quota for this country already fulfilled today!

            status = lead.get('outreach_status', 'ready')
            stage = lead.get('outreach_stage', 0)

            if stage == 0 and status not in ['STOP_REPLIED', 'FINISHED', 'INVALID_DOMAIN', 'sent']:
                return lead, 1

        return None, 0

    # =========================================================================
    # SINGLE DISPATCH WORKFLOW (EXECUTION)
    # =========================================================================
    def dispatch_candidate(self, lead, stage):
        now_pkt = self.get_pkt_now()
        cc = self.get_country_code(lead)
        biz_name = lead.get('businessName') or lead.get('name')
        to_email = lead.get('email', '')

        self.log(f"Preparing Stage {stage} dispatch for '{biz_name}' ({to_email}) in {lead.get('city')}, {lead.get('country')}...", "info")

        initial_subject = lead.get('initial_subject')
        initial_msg_id = lead.get('initial_message_id')

        # Send via SMTP
        success, msg, message_id, subject_used = self.send_smtp_email(lead, stage, initial_subject, initial_msg_id)

        if not success:
            if "validation failed" in msg.lower():
                self.log(f"❌ Skipped '{biz_name}': {msg}", "warn")
                self._update_lead_status(lead.get('id'), {
                    "outreach_status": "INVALID_DOMAIN",
                    "validation_error": msg
                })
            else:
                self.log(f"❌ SMTP Error for '{biz_name}': {msg}", "error")
            return False, msg

        # SUCCESSFUL SEND: Update database records
        now_iso = now_pkt.isoformat()
        updates = {
            "outreach_stage": stage,
            "last_sent_at": now_iso,
            "batchPitched": True,
            "status": "dispatched",
            "crmStatus": "sent"
        }

        if stage == 1:
            updates["outreach_status"] = "stage1_sent"
            updates["initial_sent_at"] = now_iso
            updates["initial_message_id"] = message_id
            updates["initial_subject"] = subject_used
            updates["thread_id"] = f"th_{lead.get('id')}"
        elif stage == 2:
            updates["outreach_status"] = "stage2_bump_sent"
            updates["stage2_sent_at"] = now_iso
        elif stage == 3:
            updates["outreach_status"] = "FINISHED"
            updates["stage3_breakup_sent_at"] = now_iso

        self._update_lead_status(lead.get('id'), updates)

        # Update Daily Quota State
        state = self._load_state()
        state["total_sent_today"] = state.get("total_sent_today", 0) + 1
        if stage == 1:
            state["new_leads_sent_today"] = state.get("new_leads_sent_today", 0) + 1
            cc_counts = state.get("country_counts_today", {})
            cc_counts[cc] = cc_counts.get(cc, 0) + 1
            state["country_counts_today"] = cc_counts
        else:
            state["followups_sent_today"] = state.get("followups_sent_today", 0) + 1

        state["history"].insert(0, {
            "time": now_pkt.strftime('%Y-%m-%d %H:%M:%S PKT'),
            "leadId": lead.get('id'),
            "businessName": biz_name,
            "country": lead.get('country'),
            "countryCode": cc,
            "stage": stage,
            "messageId": message_id
        })
        self._save_state(state)

        # Record Dispatch
        self._record_dispatch(lead, stage, subject_used)

        self.log(f"✅ Stage {stage} sent successfully to '{biz_name}' ({to_email})! [Message-ID: {message_id}]", "success")
        return True, "Success"

    def _update_lead_status(self, lead_id, fields):
        if not os.path.exists(LEADS_FILE):
            return
        with open(LEADS_FILE, 'r', encoding='utf-8') as f:
            leads = json.load(f)
        for l in leads:
            if l.get('id') == lead_id:
                l.update(fields)
                break
        with open(LEADS_FILE, 'w', encoding='utf-8') as f:
            json.dump(leads, f, indent=2)

    def _record_dispatch(self, lead, stage, subject):
        dispatches = []
        if os.path.exists(DISPATCHES_FILE):
            try:
                with open(DISPATCHES_FILE, 'r', encoding='utf-8') as f:
                    dispatches = json.load(f)
            except Exception:
                pass
        dispatches.insert(0, {
            "id": f"disp_{int(time.time()*1000)}",
            "leadId": lead.get('id'),
            "businessName": lead.get('businessName'),
            "channel": "gmail",
            "stage": stage,
            "subject": subject,
            "dispatchedAt": self.get_pkt_now().strftime('%Y-%m-%d %H:%M:%S PKT'),
            "email": lead.get('email')
        })
        try:
            with open(DISPATCHES_FILE, 'w', encoding='utf-8') as f:
                json.dump(dispatches, f, indent=2)
        except Exception:
            pass

    # =========================================================================
    # BACKGROUND WORKER LOOP (PACING & SCHEDULING)
    # =========================================================================
    def start_worker(self):
        with self.lock:
            if self.running:
                return
            self.running = True
            cfg = self.load_config()
            cfg['auto_sender_enabled'] = True
            self.save_config(cfg)
            self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.worker_thread.start()
            self.log("🚀 Background Auto-Outreach Engine STARTED.", "info")

    def pause_worker(self):
        with self.lock:
            self.running = False
            cfg = self.load_config()
            cfg['auto_sender_enabled'] = False
            self.save_config(cfg)
            self.current_action_desc = "Paused by user"
            self.log("⏸️ Background Auto-Outreach Engine PAUSED.", "info")

    def _worker_loop(self):
        while self.running:
            try:
                cfg = self.load_config()
                if not cfg.get('auto_sender_enabled', False):
                    self.running = False
                    break

                now_pkt = self.get_pkt_now()
                state = self._load_state()

                # 1. Check daily hard limit (45 emails total)
                daily_limit = int(cfg.get('daily_limit', 45))
                if state.get('total_sent_today', 0) >= daily_limit:
                    self.current_action_desc = f"Daily limit reached ({state.get('total_sent_today')}/{daily_limit}). Engine waiting for tomorrow."
                    time.sleep(60)
                    continue

                # 2. Check IMAP for incoming replies
                self.check_imap_replies()

                # 3. Check Active Timezone Window in PKT
                active_win = self.get_active_sending_window(now_pkt)
                if not active_win.get('active', False):
                    self.current_action_desc = f"Waiting for next active window. Currently: {now_pkt.strftime('%I:%M %p PKT')} ({active_win.get('hours_pkt')})"
                    time.sleep(30)
                    continue

                # 4. Select candidate lead (Priority 1: Due follow-ups, Priority 2: New lead within country quota)
                candidate, stage = self.select_next_candidate(active_win, state)

                if not candidate:
                    self.current_action_desc = f"All quota targets fulfilled for current window ({active_win.get('window_name')}). Waiting for next window or follow-up due time."
                    time.sleep(45)
                    continue

                # 5. Execute Dispatch
                biz_name = candidate.get('businessName') or candidate.get('name')
                self.current_action_desc = f"Sending Stage {stage} to '{biz_name}' ({candidate.get('country')})"
                success, _ = self.dispatch_candidate(candidate, stage)

                # 6. ANTI-BAN HUMAN DELAY: 180 to 420 seconds (3 to 7 minutes)
                min_sec = int(cfg.get('min_delay_seconds', 180))
                max_sec = int(cfg.get('max_delay_seconds', 420))
                delay = random.randint(min_sec, max_sec)

                self.next_action_time = time.time() + delay
                delay_min = round(delay / 60, 1)
                self.log(f"⏳ Anti-ban randomized human delay active: sleeping {delay}s (~{delay_min} min) before next email...", "info")

                sleep_intervals = delay
                while sleep_intervals > 0 and self.running:
                    mins_rem = sleep_intervals // 60
                    secs_rem = sleep_intervals % 60
                    self.current_action_desc = f"Anti-Ban Pause: next email in {mins_rem}m {secs_rem}s"
                    time.sleep(1)
                    sleep_intervals -= 1

            except Exception as e:
                self.log(f"Worker Loop Exception: {e}", "error")
                time.sleep(30)

    # =========================================================================
    # STATUS & TELEMETRY FOR UI
    # =========================================================================
    def get_telemetry(self):
        now_pkt = self.get_pkt_now()
        active_win = self.get_active_sending_window(now_pkt)
        state = self._load_state()
        quotas = self.get_daily_quota_targets(now_pkt)
        cfg = self.load_config()

        # Compute next window info if idle
        next_window_info = "Active right now" if active_win.get('active') else "Gulf (10:30 AM PKT) / UK (2:00 PM PKT) / US-CA (6:30 PM PKT)"

        seconds_until_next = max(0, int(self.next_action_time - time.time())) if self.next_action_time > 0 else 0

        return {
            "running": self.running,
            "auto_sender_enabled": cfg.get('auto_sender_enabled', False),
            "current_action": self.current_action_desc,
            "pkt_time": now_pkt.strftime('%I:%M:%S %p'),
            "pkt_date": now_pkt.strftime('%A, %B %d, %Y'),
            "active_window": active_win,
            "next_window_info": next_window_info,
            "seconds_until_next_action": seconds_until_next,
            "daily_limit": cfg.get('daily_limit', 45),
            "sent_today": state.get('total_sent_today', 0),
            "new_leads_sent_today": state.get('new_leads_sent_today', 0),
            "followups_sent_today": state.get('followups_sent_today', 0),
            "quotas_today": quotas,
            "country_progress": {
                cc: {
                    "sent": state.get('country_counts_today', {}).get(cc, 0),
                    "target": quotas.get(cc, 0)
                } for cc in ["KW", "BH", "OM", "GB", "US", "CA"]
            },
            "recent_logs": self.recent_logs[:15],
            "smtp_configured": bool(cfg.get('gmail_address') and cfg.get('gmail_app_password'))
        }

# Singleton instance
engine = OutreachEngine()

if __name__ == '__main__':
    print("=== Testing Outreach Engine Locally ===")
    print("PKT Time:", engine.get_pkt_now())
    print("Active Window:", engine.get_active_sending_window())
    print("Quotas Today:", engine.get_daily_quota_targets())
    print("MX Check 'gmail.com':", engine.validate_recipient_email('test@gmail.com'))
    print("MX Check 'fake12345nonexistent.com':", engine.validate_recipient_email('test@fake12345nonexistent.com'))
