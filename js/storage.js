/**
 * SoftHunter AI - Unified Persistent Storage & Settings Manager
 */

const STORAGE_KEYS = {
  SETTINGS: 'softhunter_settings',
  LEADS: 'softhunter_leads',
  HISTORY: 'softhunter_history',
  REPLIES: 'softhunter_replies',
  AUTOPILOT: 'softhunter_autopilot',
  DISPATCHES: 'softhunter_dispatches',
  BATCHES: 'softhunter_batches'
};

const DEFAULT_SETTINGS = {
  whatsapp_number: '+923376568003',
  email_address: 'info.mfsoft@gmail.com',
  company_name: 'MF Software Solutions',
  company_website: 'https://mfsoftware.com',
  google_places_api_key: '',
  pagespeed_api_key: '',
  openai_api_key: '',
  gemini_api_key: '',
  whatsapp_cloud_token: '',
  whatsapp_phone_number_id: '',
  linkedin_status: 'add_later',
  linkedin_username: '',
  instagram_status: 'add_later',
  instagram_username: '',
  daily_target: 100,
  batch_size: 50,
  min_delay_sec: 180,
  max_delay_sec: 420,
  followup_intervals: [2, 4, 7, 10],
  default_country: 'Pakistan',
  default_city: 'Karachi',
  channels: {
    gmail: { enabled: true, daily_quota: 34 },
    whatsapp: { enabled: true, daily_quota: 33 },
    instagram: { enabled: true, daily_quota: 33 }
  }
};

const StorageService = {
  getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS) || localStorage.getItem('restohunter_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Error reading settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(newSettings) {
    try {
      const merged = { ...this.getSettings(), ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      }).catch(() => {});
      return merged;
    } catch (e) {
      console.error('Error saving settings:', e);
      return newSettings;
    }
  },

  getLeads() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LEADS) || localStorage.getItem('restohunter_leads');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Error reading leads from localStorage:', e);
    }
    return [];
  },

  saveLeads(leads) {
    try {
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads)
      }).catch(() => {});
    } catch (e) {
      console.error('Error saving leads:', e);
    }
  },

  getDispatches() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DISPATCHES);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  },

  saveDispatches(dispatches) {
    try {
      localStorage.setItem(STORAGE_KEYS.DISPATCHES, JSON.stringify(dispatches));
    } catch (e) {}
  },

  logDispatchEvent(event) {
    try {
      const dispatches = this.getDispatches();
      const record = {
        id: `dsp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        dateStr: new Date().toISOString().split('T')[0],
        timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...event
      };
      dispatches.unshift(record);
      this.saveDispatches(dispatches);

      // Sync with backend
      fetch('/api/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: record })
      }).catch(() => {});

      return record;
    } catch (e) {
      console.error('Error logging dispatch:', e);
      return null;
    }
  },

  getPitchedHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  },

  markAsPitched(leadId, businessName) {
    const history = this.getPitchedHistory();
    if (!history.includes(businessName)) {
      history.push(businessName);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    }
  },

  getReplies() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.REPLIES);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  },

  saveReplies(replies) {
    try {
      localStorage.setItem(STORAGE_KEYS.REPLIES, JSON.stringify(replies));
    } catch (e) {}
  }
};

window.StorageService = StorageService;
