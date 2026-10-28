/**
 * RestoHunter AI - Persistent Storage & Settings Manager
 */

const STORAGE_KEYS = {
  SETTINGS: 'restohunter_settings',
  LEADS: 'restohunter_leads',
  HISTORY: 'restohunter_history',
  REPLIES: 'restohunter_replies',
  AUTOPILOT: 'restohunter_autopilot'
};

const DEFAULT_SETTINGS = {
  whatsapp_number: '+923376568003',
  email_address: 'info.mfsoft@gmail.com',
  linkedin_status: 'add_later',
  linkedin_username: '',
  linkedin_cookie_li_at: '',
  instagram_status: 'add_later',
  instagram_username: '',
  gemini_api_key: '',
  daily_target: 100,
  channels: {
    gmail: { enabled: true, quota: 34 },
    linkedin: { enabled: true, quota: 33 },
    instagram: { enabled: true, quota: 33 }
  },
  min_delay_sec: 180, // 3 minutes
  max_delay_sec: 420, // 7 minutes
  auto_followup_days: 3,
  default_country: 'USA',
  default_city: 'Austin, Texas'
};

const StorageService = {
  getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
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
      // Try to sync with local backend if available
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      }).catch(() => {/* Offline/standalone mode */});
      return merged;
    } catch (e) {
      console.error('Error saving settings:', e);
      return newSettings;
    }
  },

  getLeads() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LEADS);
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
      }).catch(() => {/* Standalone */});
    } catch (e) {
      console.error('Error saving leads:', e);
    }
  },

  getPitchedHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Error reading history:', e);
    }
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
    } catch (e) {
      console.warn('Error reading replies:', e);
    }
    return [];
  },

  saveReplies(replies) {
    try {
      localStorage.setItem(STORAGE_KEYS.REPLIES, JSON.stringify(replies));
    } catch (e) {
      console.error('Error saving replies:', e);
    }
  }
};

window.StorageService = StorageService;
