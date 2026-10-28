/**
 * RestoHunter AI - Master Application Coordinator
 */

const App = {
  leads: [],
  filteredLeads: [],
  currentChannelFilter: 'all',
  activeLeadForModal: null,
  settings: {},

  init() {
    this.settings = StorageService.getSettings();
    this.setupUI();
    this.setupEventListeners();
    ReplyCenter.init();

    // Check if we have saved leads, else generate initial 100
    const savedLeads = StorageService.getLeads();
    if (savedLeads && savedLeads.length > 0) {
      this.leads = savedLeads;
    } else {
      this.leads = LeadGenerator.generate100Leads('Austin, Texas', 'USA', 'all');
      StorageService.saveLeads(this.leads);
    }

    this.applyFilter('all');
    this.updateMetrics();
  },

  setupUI() {
    // Populate settings in top bar and inputs
    const waPill = document.getElementById('nav-wa-number');
    const emailPill = document.getElementById('nav-email-address');
    if (waPill) waPill.textContent = this.settings.whatsapp_number || '+923376568003';
    if (emailPill) emailPill.textContent = this.settings.email_address || 'info.mfsoft@gmail.com';

    // Populate Settings Modal Inputs
    const waInput = document.getElementById('setting-wa-number');
    const emailInput = document.getElementById('setting-email-address');
    const geminiInput = document.getElementById('setting-gemini-key');
    const instaStatus = document.getElementById('setting-insta-status');
    const linkedinStatus = document.getElementById('setting-linkedin-status');

    if (waInput) waInput.value = this.settings.whatsapp_number || '+923376568003';
    if (emailInput) emailInput.value = this.settings.email_address || 'info.mfsoft@gmail.com';
    if (geminiInput) geminiInput.value = this.settings.gemini_api_key || '';
    if (instaStatus) instaStatus.textContent = this.settings.instagram_status === 'add_later' ? 'Pending / Add Later' : 'Configured';
    if (linkedinStatus) linkedinStatus.textContent = this.settings.linkedin_status === 'add_later' ? 'Pending / Add Later' : 'Configured';
  },

  setupEventListeners() {
    // Start 100-Lead Hunt
    const startHuntBtn = document.getElementById('btn-start-hunt');
    if (startHuntBtn) {
      startHuntBtn.addEventListener('click', () => this.handleStartHunt());
    }

    // Target Market Toggle (Dropdown vs Custom EditText)
    const toggleCountryBtn = document.getElementById('btn-toggle-custom-country');
    const countrySelect = document.getElementById('target-country-select');
    const wrapperSelect = document.getElementById('wrapper-country-select');
    const wrapperCustom = document.getElementById('wrapper-country-custom');
    const customInput = document.getElementById('target-country-custom-input');
    const toggleIcon = document.getElementById('toggle-country-icon');
    const toggleLabel = document.getElementById('toggle-country-label');

    const switchToCustom = () => {
      if (wrapperSelect) wrapperSelect.style.display = 'none';
      if (wrapperCustom) wrapperCustom.style.display = 'block';
      if (toggleIcon) toggleIcon.textContent = '🌐';
      if (toggleLabel) toggleLabel.textContent = 'Worldwide List';
      if (customInput) customInput.focus();
    };

    const switchToSelect = () => {
      if (wrapperCustom) wrapperCustom.style.display = 'none';
      if (wrapperSelect) wrapperSelect.style.display = 'block';
      if (toggleIcon) toggleIcon.textContent = '✏️';
      if (toggleLabel) toggleLabel.textContent = 'Type Custom';
    };

    if (toggleCountryBtn) {
      toggleCountryBtn.addEventListener('click', () => {
        if (wrapperCustom && wrapperCustom.style.display !== 'none') {
          switchToSelect();
        } else {
          switchToCustom();
        }
      });
    }

    if (countrySelect) {
      const defaultCities = {
        'UAE': 'Dubai, UAE',
        'Saudi Arabia': 'Riyadh, Saudi Arabia',
        'UK': 'London, UK',
        'Pakistan': 'Lahore, Pakistan',
        'India': 'Mumbai, India',
        'Germany': 'Berlin, Germany',
        'France': 'Paris, France',
        'Canada': 'Toronto, Ontario',
        'Australia': 'Sydney, NSW',
        'Singapore': 'Singapore',
        'Spain': 'Madrid, Spain',
        'Italy': 'Rome, Italy',
        'Netherlands': 'Amsterdam, Netherlands',
        'Ireland': 'Dublin, Ireland',
        'Qatar': 'Doha, Qatar',
        'Turkey': 'Istanbul, Turkey',
        'Japan': 'Tokyo, Japan',
        'USA': 'Austin, Texas',
        'Worldwide': 'Global Markets'
      };

      countrySelect.addEventListener('change', () => {
        if (countrySelect.value === 'CUSTOM') {
          switchToCustom();
        } else {
          const cityInput = document.getElementById('target-city-input');
          const suggested = defaultCities[countrySelect.value];
          if (cityInput && suggested) {
            cityInput.value = suggested;
          }
        }
      });
    }

    // Quick City Chips
    document.querySelectorAll('.city-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.city-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const cityInput = document.getElementById('target-city-input');
        if (cityInput) cityInput.value = chip.dataset.city;

        const cVal = chip.dataset.country;
        if (cVal && countrySelect) {
          switchToSelect();
          let matched = false;
          for (let opt of countrySelect.options) {
            if (opt.value.toUpperCase() === cVal.toUpperCase() || cVal.toUpperCase().includes(opt.value.toUpperCase())) {
              countrySelect.value = opt.value;
              matched = true;
              break;
            }
          }
          if (!matched) {
            switchToCustom();
            if (customInput) customInput.value = cVal;
          }
        }
      });
    });

    // Channel Tabs
    document.querySelectorAll('.channel-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.channel-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.applyFilter(tab.dataset.filter);
      });
    });

    // Search Input
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }

    // Approve & Dispatch All 100
    const approveAllBtn = document.getElementById('btn-approve-all');
    if (approveAllBtn) {
      approveAllBtn.addEventListener('click', () => this.handleApproveAll());
    }

    // Stop Batch Dispatch
    const stopBatchBtn = document.getElementById('btn-stop-batch');
    if (stopBatchBtn) {
      stopBatchBtn.addEventListener('click', () => {
        AutopilotEngine.stopBatchDispatch();
        this.showToast('Batch dispatch paused.', 'info');
      });
    }

    // Load Next 100 Leads
    const loadNextBtn = document.getElementById('btn-load-next-100');
    if (loadNextBtn) {
      loadNextBtn.addEventListener('click', () => this.handleLoadNext100());
    }

    // Export Buttons
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportCSV());
    }

    const exportJsonBtn = document.getElementById('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportJSON());
    }

    // Test WhatsApp Alert
    const testWaBtn = document.getElementById('btn-test-whatsapp');
    if (testWaBtn) {
      testWaBtn.addEventListener('click', () => {
        ReplyCenter.simulateIncomingReply();
      });
    }

    // Settings Modal Open/Close
    const openSettingsBtn = document.getElementById('btn-open-settings');
    const closeSettingsBtn = document.getElementById('modal-settings-close');
    const settingsModal = document.getElementById('settings-modal');
    const saveSettingsBtn = document.getElementById('btn-save-settings');

    if (openSettingsBtn && settingsModal) {
      openSettingsBtn.addEventListener('click', () => settingsModal.classList.add('open'));
    }
    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('open'));
    }
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
    }

    // Pitch Modal Close
    const closePitchBtn = document.getElementById('modal-pitch-close');
    const pitchModal = document.getElementById('pitch-preview-modal');
    if (closePitchBtn && pitchModal) {
      closePitchBtn.addEventListener('click', () => pitchModal.classList.remove('open'));
    }

    // WhatsApp Alert Modal Close
    const closeWaAlertBtn = document.getElementById('modal-wa-alert-close');
    const waAlertModal = document.getElementById('whatsapp-alert-modal');
    if (closeWaAlertBtn && waAlertModal) {
      closeWaAlertBtn.addEventListener('click', () => waAlertModal.classList.remove('open'));
    }

    // Autopilot / Social Authority Modal
    const openSocialBtn = document.getElementById('btn-open-social-autopilot');
    const closeSocialBtn = document.getElementById('modal-social-close');
    const socialModal = document.getElementById('social-autopilot-modal');
    if (openSocialBtn && socialModal) {
      openSocialBtn.addEventListener('click', () => {
        this.renderSocialTemplates();
        socialModal.classList.add('open');
      });
    }
    if (closeSocialBtn && socialModal) {
      closeSocialBtn.addEventListener('click', () => socialModal.classList.remove('open'));
    }
  },

  getCountryValue() {
    const customWrap = document.getElementById('wrapper-country-custom');
    const customInput = document.getElementById('target-country-custom-input');
    const select = document.getElementById('target-country-select');

    if (customWrap && customWrap.style.display !== 'none' && customInput && customInput.value.trim()) {
      return customInput.value.trim();
    }
    if (select && select.value && select.value !== 'CUSTOM') {
      return select.value;
    }
    if (customInput && customInput.value.trim()) {
      return customInput.value.trim();
    }
    return 'Worldwide';
  },

  handleStartHunt() {
    const cityInput = document.getElementById('target-city-input');
    const nicheSelect = document.getElementById('target-niche-select');
    const banner = document.getElementById('hunt-status-banner');
    const progressBar = document.getElementById('scan-progress-bar-fill');
    const progressText = document.getElementById('hunt-status-text');

    const city = cityInput && cityInput.value.trim() ? cityInput.value.trim() : 'Austin, Texas';
    const country = this.getCountryValue();
    const niche = nicheSelect ? nicheSelect.value : 'all';

    if (banner) banner.classList.add('active');
    if (progressBar) progressBar.style.width = '10%';
    if (progressText) progressText.textContent = `Scanning Google Local Pack in ${city} [${country}] (4.0+ Stars, 30+ Reviews)...`;

    let step = 10;
    const interval = setInterval(() => {
      step += 22;
      if (progressBar) progressBar.style.width = `${Math.min(step, 95)}%`;

      if (step >= 35 && step < 65) {
        if (progressText) progressText.textContent = `Diagnosing digital flaws & calculating DoorDash/commission leaks in ${city}...`;
      } else if (step >= 65 && step < 90) {
        if (progressText) progressText.textContent = `Allocating 34 Gmail, 33 LinkedIn, 33 Instagram tailored pitches for ${country}...`;
      }

      if (step >= 100) {
        clearInterval(interval);
        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = `✅ Successfully prospected 100 high-ticket local businesses in ${city}!`;

        setTimeout(() => {
          this.leads = LeadGenerator.generate100Leads(city, country, niche);
          StorageService.saveLeads(this.leads);
          this.applyFilter('all');
          this.updateMetrics();
          this.showToast(`100 Verified Leads Loaded for ${city} (${country})!`, 'success');
          if (banner) banner.classList.remove('active');
        }, 600);
      }
    }, 280);
  },

  handleLoadNext100() {
    const cityInput = document.getElementById('target-city-input');
    const nicheSelect = document.getElementById('target-niche-select');
    const city = cityInput && cityInput.value.trim() ? cityInput.value.trim() : 'Austin, Texas';
    const country = this.getCountryValue();
    const niche = nicheSelect ? nicheSelect.value : 'all';

    const next100 = LeadGenerator.generate100Leads(city, country, niche);
    this.leads = next100;
    StorageService.saveLeads(this.leads);
    this.applyFilter('all');
    this.updateMetrics();
    this.showToast(`🔄 Loaded Next 100 Fresh Leads for ${city} (Deduplicated)!`, 'success');
  },

  applyFilter(filter) {
    this.currentChannelFilter = filter;
    if (filter === 'all') {
      this.filteredLeads = [...this.leads];
    } else if (filter === 'gmail' || filter === 'linkedin' || filter === 'instagram') {
      this.filteredLeads = this.leads.filter(l => l.channel === filter);
    } else if (filter === 'replied') {
      this.filteredLeads = this.leads.filter(l => l.status === 'replied');
    } else if (filter === 'followup') {
      this.filteredLeads = AutopilotEngine.getDueFollowUps(this.leads);
    }
    this.renderTable();
  },

  filterByChannel(channel) {
    if (!channel) {
      this.applyFilter('all');
      return;
    }
    const tab = document.querySelector(`.channel-tab-btn[data-filter="${channel}"]`);
    if (tab) {
      document.querySelectorAll('.channel-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    }
    this.applyFilter(channel);
  },

  handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.applyFilter(this.currentChannelFilter);
      return;
    }
    this.filteredLeads = this.leads.filter(l =>
      l.businessName.toLowerCase().includes(q) ||
      l.nicheName.toLowerCase().includes(q) ||
      l.flawTitle.toLowerCase().includes(q) ||
      l.decisionMaker.toLowerCase().includes(q) ||
      l.channel.toLowerCase().includes(q)
    );
    this.renderTable();
  },

  renderTable() {
    const tbody = document.getElementById('leads-table-body');
    const countLabel = document.getElementById('leads-count-label');
    if (countLabel) countLabel.textContent = `Showing ${this.filteredLeads.length} of ${this.leads.length} Leads`;
    if (!tbody) return;

    if (this.filteredLeads.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No leads found matching current filter or search criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.filteredLeads.map((lead, idx) => {
      const channelBadge = lead.channel === 'gmail'
        ? `<span class="badge-channel gmail">📧 Gmail</span>`
        : lead.channel === 'linkedin'
        ? `<span class="badge-channel linkedin">👔 LinkedIn</span>`
        : `<span class="badge-channel instagram">📸 Instagram</span>`;

      const statusBadge = lead.status === 'dispatched'
        ? `<span class="status-pill dispatched">🚀 Dispatched</span>`
        : lead.status === 'replied'
        ? `<span class="status-pill replied">🔴 Replied</span>`
        : lead.status === 'followup_due'
        ? `<span class="status-pill followup">⏰ Follow-Up Due</span>`
        : `<span class="status-pill ready">Ready to Pitch</span>`;

      return `
        <tr data-lead-id="${lead.id}">
          <td>
            <div class="biz-name-cell">
              <span class="biz-title">${lead.businessName}</span>
              <span class="biz-location">📍 ${lead.city} • <span class="google-rating-chip">⭐ ${lead.rating} (${lead.reviews})</span></span>
              <span style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">👤 ${lead.decisionMaker} (${lead.decisionMakerTitle})</span>
            </div>
          </td>
          <td>
            <span class="badge-niche">${lead.nicheIcon} ${lead.nicheName.split(',')[0]}</span>
          </td>
          <td>
            <div class="flaw-tag">
              <span class="flaw-label">⚠️ ${lead.flawTitle}</span>
              <span class="leak-badge">${lead.flawLeakRange}</span>
            </div>
          </td>
          <td>${channelBadge}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-row-actions">
              <button class="btn-table-action" onclick="App.openPitchModal('${lead.id}')">
                👁️ View Pitch
              </button>
              <button class="btn-table-action btn-table-bhejdo" onclick="App.dispatchSingleLead('${lead.id}')">
                🚀 Bhej Do
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateMetrics() {
    const totalLeads = this.leads.length;
    const dispatchedCount = this.leads.filter(l => l.status === 'dispatched' || l.status === 'replied').length;
    const repliedCount = this.leads.filter(l => l.status === 'replied').length;

    const elTotal = document.getElementById('metric-total-leads');
    const elDispatched = document.getElementById('metric-dispatched-count');
    const elRecovered = document.getElementById('metric-estimated-recovered');
    const elPipeline = document.getElementById('metric-pipeline-value');

    if (elTotal) elTotal.textContent = totalLeads;
    if (elDispatched) elDispatched.textContent = `${dispatchedCount} / ${totalLeads}`;
    if (elRecovered) elRecovered.textContent = `$${(totalLeads * 3.8).toFixed(1)}k/mo`;
    if (elPipeline) elPipeline.textContent = `$${(15 * 650).toLocaleString()} – $${(25 * 1200).toLocaleString()}`;
  },

  openPitchModal(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    this.activeLeadForModal = lead;

    const pitch = PitchEngine.generatePitch(lead);
    const modal = document.getElementById('pitch-preview-modal');
    if (!modal) return;

    document.getElementById('modal-pitch-title').textContent = `${lead.businessName} — Pitch Preview`;
    document.getElementById('modal-pitch-channel-badge').innerHTML = lead.channel === 'gmail'
      ? `<span class="badge-channel gmail">📧 Gmail Pitch</span>`
      : lead.channel === 'linkedin'
      ? `<span class="badge-channel linkedin">👔 LinkedIn Connection Note</span>`
      : `<span class="badge-channel instagram">📸 Instagram Story Reply</span>`;

    document.getElementById('modal-pitch-flaw-title').textContent = lead.flawTitle;
    document.getElementById('modal-pitch-flaw-leak').textContent = lead.flawLeakRange;
    document.getElementById('modal-pitch-demo-link').textContent = lead.demoLink;
    document.getElementById('modal-pitch-demo-link').href = lead.demoLink;

    const subjectInput = document.getElementById('modal-pitch-subject');
    const subjectRow = document.getElementById('modal-pitch-subject-row');
    if (lead.channel === 'gmail') {
      subjectRow.style.display = 'flex';
      subjectInput.value = pitch.subject;
    } else {
      subjectRow.style.display = 'none';
    }

    const textarea = document.getElementById('modal-pitch-textarea');
    textarea.value = pitch.body;

    const counter = document.getElementById('modal-pitch-counter');
    counter.textContent = `${pitch.charCount} characters | ${pitch.limitNote}`;

    textarea.oninput = () => {
      counter.textContent = `${textarea.value.length} characters | ${pitch.limitNote}`;
    };

    // Modal action buttons
    document.getElementById('modal-btn-copy').onclick = () => {
      navigator.clipboard.writeText(textarea.value);
      this.showToast('Pitch copied to clipboard!', 'success');
    };

    document.getElementById('modal-btn-bhejdo').onclick = () => {
      this.dispatchSingleLead(lead.id, textarea.value);
      modal.classList.remove('open');
    };

    document.getElementById('modal-btn-test-wa').onclick = () => {
      ReplyCenter.simulateIncomingReply(lead);
    };

    modal.classList.add('open');
  },

  dispatchSingleLead(leadId, customBody = null) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    lead.status = 'dispatched';
    lead.dispatchedAt = new Date().toISOString();
    const due = new Date();
    due.setHours(due.getHours() + 72);
    lead.followupDueAt = due.toISOString();

    StorageService.markAsPitched(lead.id, lead.businessName);
    StorageService.saveLeads(this.leads);
    this.renderTable();
    this.updateMetrics();

    // Launch direct action based on channel
    const pitch = PitchEngine.generatePitch(lead);
    const body = customBody || pitch.body;

    if (lead.channel === 'gmail') {
      const subject = encodeURIComponent(pitch.subject);
      const emailBody = encodeURIComponent(body);
      const mailtoUrl = `mailto:${lead.contactInfo.email}?subject=${subject}&body=${emailBody}`;
      window.open(mailtoUrl, '_blank');
    } else if (lead.channel === 'linkedin') {
      // Direct LinkedIn messaging URL
      window.open(`https://www.linkedin.com/messaging`, '_blank');
    } else if (lead.channel === 'instagram') {
      // Direct Instagram inbox URL
      window.open(`https://www.instagram.com/direct/inbox`, '_blank');
    }

    this.showToast(`🚀 Bhej Diya! Dispatched to ${lead.businessName} via ${lead.channel.toUpperCase()}`, 'success');
  },

  handleApproveAll() {
    const readyLeads = this.leads.filter(l => l.status === 'ready');
    if (readyLeads.length === 0) {
      this.showToast('All leads already approved and dispatched!', 'info');
      return;
    }

    const confirmFast = confirm(
      `Ready to launch automated ban-safe batch dispatch for ${readyLeads.length} leads?\n\n- Safe human intervals: 3 to 7 minutes between sends.\n- Click OK to start safe dispatch.\n- Or Cancel to run in test mode (fast interval).`
    );

    AutopilotEngine.startBatchDispatch(
      this.leads,
      (lead, current, total) => {
        this.renderTable();
        this.updateMetrics();
        StorageService.saveLeads(this.leads);
        this.showToast(`🚀 Dispatched (${current}/${total}): ${lead.businessName}`, 'success');
      },
      (msg) => {
        this.renderTable();
        this.updateMetrics();
        this.showToast(msg, 'success');
      },
      !confirmFast // if user canceled, run in fast demo mode (4-8s)
    );
  },

  handleSaveSettings() {
    const waInput = document.getElementById('setting-wa-number');
    const emailInput = document.getElementById('setting-email-address');
    const geminiInput = document.getElementById('setting-gemini-key');

    const updated = StorageService.saveSettings({
      whatsapp_number: waInput ? waInput.value.trim() : '+923376568003',
      email_address: emailInput ? emailInput.value.trim() : 'info.mfsoft@gmail.com',
      gemini_api_key: geminiInput ? geminiInput.value.trim() : ''
    });

    this.settings = updated;
    this.setupUI();
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.remove('open');
    this.showToast('✅ Settings updated successfully!', 'success');
  },

  renderSocialTemplates() {
    const container = document.getElementById('social-templates-container');
    if (!container) return;
    const templates = AutopilotEngine.getSocialTemplates();

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div style="background: rgba(10, 102, 194, 0.1); border: 1px solid rgba(10, 102, 194, 0.3); border-radius: var(--radius-md); padding: 16px;">
          <h4 style="color: #60a5fa; margin-bottom: 8px;">👔 LinkedIn Case Study (Copy & Post)</h4>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 10px;">${templates.linkedin[0].title}</p>
          <pre style="white-space: pre-wrap; font-family: 'Inter', sans-serif; font-size: 0.85rem; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px;">${templates.linkedin[0].content}</pre>
          <button class="btn-secondary" style="margin-top: 10px;" onclick="navigator.clipboard.writeText(\`${templates.linkedin[0].content}\`); App.showToast('Copied LinkedIn post!', 'success');">📋 Copy LinkedIn Post</button>
        </div>

        <div style="background: rgba(225, 48, 108, 0.1); border: 1px solid rgba(225, 48, 108, 0.3); border-radius: var(--radius-md); padding: 16px;">
          <h4 style="color: #f472b6; margin-bottom: 8px;">📸 Instagram Carousel Blueprint</h4>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 10px;">${templates.instagram[0].title}</p>
          <ul style="font-size: 0.85rem; padding-left: 20px; line-height: 1.8;">
            ${templates.instagram[0].slides.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  },

  exportCSV() {
    if (this.leads.length === 0) return;
    const headers = ['Business Name', 'City', 'Country', 'Niche', 'Rating', 'Reviews', 'Decision Maker', 'Flaw Title', 'Monthly Leak', 'Channel', 'Contact', 'Status'];
    const rows = this.leads.map(l => [
      `"${l.businessName}"`,
      `"${l.city}"`,
      `"${l.country}"`,
      `"${l.nicheName}"`,
      l.rating,
      l.reviews,
      `"${l.decisionMaker} (${l.decisionMakerTitle})"`,
      `"${l.flawTitle}"`,
      `"${l.flawLeakRange}"`,
      l.channel,
      `"${l.contactInfo.email || l.contactInfo.instagramHandle || l.contactInfo.linkedinProfile}"`,
      l.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `restohunter_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('📥 Exported leads as CSV file!', 'success');
  },

  exportJSON() {
    if (this.leads.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.leads, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `restohunter_leads_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('📤 Exported leads as JSON file!', 'success');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
