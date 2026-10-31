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

    // 1. Instant Synchronous Initial Load: Show verified leads immediately without waiting for network
    const savedLeads = StorageService.getLeads();
    const initialLeads = (savedLeads && savedLeads.length > 0 && savedLeads[0].decisionMakerSourceUrl)
      ? savedLeads
      : (window.DEFAULT_LEADS || []);

    if (initialLeads && initialLeads.length > 0) {
      this.leads = initialLeads.map(l => {
        l.mapsUrl = this.getExactMapsUrl(l);
        return l;
      });
      this.applyFilter('all');
      this.updateMetrics();
    }

    // 2. Asynchronous Fresh Sync from data/leads.json
    fetch('data/leads.json')
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(freshLeads => {
        if (!freshLeads || !freshLeads.length) return;
        const currentSaved = StorageService.getLeads() || [];
        const savedMap = {};
        currentSaved.forEach(l => {
          savedMap[l.id] = {
            status: l.status,
            dispatchedAt: l.dispatchedAt,
            dispatchedMessage: l.dispatchedMessage,
            followupDueAt: l.followupDueAt
          };
        });

        this.leads = freshLeads.map(l => {
          l.mapsUrl = this.getExactMapsUrl(l);
          if (savedMap[l.id]) {
            l.status = savedMap[l.id].status || l.status;
            l.dispatchedAt = savedMap[l.id].dispatchedAt || null;
            l.dispatchedMessage = savedMap[l.id].dispatchedMessage || null;
            l.followupDueAt = savedMap[l.id].followupDueAt || null;
          }
          return l;
        });

        StorageService.saveLeads(this.leads);
        this.applyFilter('all');
        this.updateMetrics();
      })
      .catch(err => {
        console.warn('Network fetch bypassed, verified dataset active:', err);
        if (!this.leads || this.leads.length === 0) {
          const fallback = window.DEFAULT_LEADS || StorageService.getLeads();
          if (fallback && fallback.length > 0) {
            this.leads = fallback.map(l => {
              l.mapsUrl = this.getExactMapsUrl(l);
              return l;
            });
            StorageService.saveLeads(this.leads);
            this.applyFilter('all');
            this.updateMetrics();
          }
        }
      });
  },

  getExactMapsUrl(lead) {
    if (!lead) return 'https://www.google.com/maps';
    const cleanBiz = (lead.businessName || '').split('(')[0].trim();
    const address = (lead.address || `${lead.city || ''}, ${lead.country || ''}`).trim();
    let fullQuery = '';
    if (address.toLowerCase().includes(cleanBiz.toLowerCase())) {
      fullQuery = address;
    } else {
      fullQuery = `${cleanBiz}, ${address}`;
    }
    // Universal Google Maps search URL (works on mobile app and desktop web)
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;
  },

  getEmbedMapsUrl(lead) {
    if (!lead) return 'about:blank';
    const cleanBiz = (lead.businessName || '').split('(')[0].trim();
    const address = (lead.address || `${lead.city || ''}, ${lead.country || ''}`).trim();
    let fullQuery = '';
    if (address.toLowerCase().includes(cleanBiz.toLowerCase())) {
      fullQuery = address;
    } else {
      fullQuery = `${cleanBiz}, ${address}`;
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(fullQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
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
    // Start 100-Lead Hunt & Dropdown Filters (Synchronized & Instant)
    const startHuntBtn = document.getElementById('btn-start-hunt');
    const targetNicheSelect = document.getElementById('target-niche-select');
    const tableNicheFilter = document.getElementById('table-niche-filter');
    const cityInput = document.getElementById('target-city-input');

    if (startHuntBtn) {
      startHuntBtn.addEventListener('click', () => this.handleStartHunt(true));
    }

    if (targetNicheSelect) {
      targetNicheSelect.addEventListener('change', (e) => {
        if (tableNicheFilter) tableNicheFilter.value = e.target.value;
        this.handleStartHunt(true);
      });
    }

    if (tableNicheFilter) {
      tableNicheFilter.addEventListener('change', (e) => {
        if (targetNicheSelect) targetNicheSelect.value = e.target.value;
        this.handleStartHunt(false);
      });
    }

    if (cityInput) {
      cityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleStartHunt(true);
        }
      });
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

    // Quick City Chips (Verified Markets)
    document.querySelectorAll('.city-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.city-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const selectedCity = chip.dataset.city;
        const cityInput = document.getElementById('target-city-input');
        if (cityInput && selectedCity !== 'ALL') cityInput.value = selectedCity;
        if (selectedCity === 'ALL') {
          if (cityInput) cityInput.value = '';
          this.applyFilter(this.currentChannelFilter || 'all');
        } else {
          this.handleCityFilter(selectedCity);
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

    // Dispatched Metric Card Click -> auto filter
    const dispatchedCard = document.getElementById('card-metric-dispatched');
    if (dispatchedCard) {
      dispatchedCard.addEventListener('click', () => {
        const tab = document.querySelector('.channel-tab-btn[data-filter="dispatched"]');
        if (tab) {
          document.querySelectorAll('.channel-tab-btn').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
        }
        this.applyFilter('dispatched');
        const tableHeader = document.querySelector('.leads-section-header');
        if (tableHeader) tableHeader.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Search Input
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }

    // Reset Leads to Ready Status
    const resetLeadsBtn = document.getElementById('btn-reset-leads-status');
    if (resetLeadsBtn) {
      resetLeadsBtn.addEventListener('click', () => {
        if (confirm('Kya aap sab dispatched leads ko wapis "Ready to Pitch" karna chahte hain taake WhatsApp se 1-by-1 bhej sakein?')) {
          this.leads.forEach(l => {
            l.status = 'ready';
            l.dispatchedAt = null;
            l.dispatchedMessage = null;
            l.followupDueAt = null;
          });
          StorageService.saveLeads(this.leads);
          try {
            localStorage.removeItem('restohunter_history');
          } catch (e) {}
          this.updateMetrics();
          this.renderTable();
          this.showToast('✅ All leads reset to "Ready to Pitch"! Ab aap WhatsApp se 1-by-1 bhej sakte hain.', 'success');
        }
      });
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

    // Add Real Lead Modal Open/Close & Save
    const openAddLeadBtn = document.getElementById('btn-open-add-lead');
    const closeAddLeadBtn = document.getElementById('modal-add-lead-close');
    const cancelAddLeadBtn = document.getElementById('modal-btn-cancel-add-lead');
    const addLeadModal = document.getElementById('add-lead-modal');
    const saveRealLeadBtn = document.getElementById('modal-btn-save-real-lead');

    if (openAddLeadBtn && addLeadModal) {
      openAddLeadBtn.addEventListener('click', () => {
        addLeadModal.classList.add('open');
      });
    }

    const closeAddModal = () => {
      if (addLeadModal) addLeadModal.classList.remove('open');
    };

    if (closeAddLeadBtn) closeAddLeadBtn.addEventListener('click', closeAddModal);
    if (cancelAddLeadBtn) cancelAddLeadBtn.addEventListener('click', closeAddModal);

    if (saveRealLeadBtn) {
      saveRealLeadBtn.addEventListener('click', () => this.handleSaveRealLead());
    }
  },

  handleSaveRealLead() {
    const bizInput = document.getElementById('new-lead-business-name');
    const ownerInput = document.getElementById('new-lead-owner-name');
    const phoneInput = document.getElementById('new-lead-phone');
    const emailInput = document.getElementById('new-lead-email');
    const cityInput = document.getElementById('new-lead-city');
    const addressInput = document.getElementById('new-lead-address');
    const nicheSelect = document.getElementById('new-lead-niche');
    const flawSelect = document.getElementById('new-lead-flaw');

    const bizName = bizInput ? bizInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!bizName || !phone) {
      this.showToast('Please enter both Business Name and a real WhatsApp Number!', 'error');
      return;
    }

    const city = cityInput && cityInput.value.trim() ? cityInput.value.trim() : 'Karachi, Pakistan';
    const owner = ownerInput && ownerInput.value.trim() ? ownerInput.value.trim() : 'Owner / Manager';
    const email = emailInput && emailInput.value.trim() ? emailInput.value.trim() : `contact@${bizName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const niche = nicheSelect ? nicheSelect.value : 'restaurants';
    const flaw = flawSelect ? flawSelect.value : 'Pinch-to-zoom PDF Menu on Mobile';

    const address = addressInput && addressInput.value.trim() ? addressInput.value.trim() : `${bizName}, ${city}`;
    const cleanBiz = bizName.split('(')[0].trim();
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanBiz + ', ' + address)}`;

    const nicheMeta = {
      restaurants: { name: 'Casual & Fine Dining Restaurant', icon: '🍽️' },
      dental_medical: { name: 'Dental & Specialized Medical Care', icon: '🦷' },
      salons_spas: { name: 'Premium Salon, Barber & Wellness Spa', icon: '💈' },
      home_services: { name: 'Emergency HVAC, Roofing & Contractor', icon: '🔧' },
      boutique_hotels: { name: 'Boutique Hotel & Luxury Suites', icon: '🏨' }
    }[niche] || { name: 'Local Business', icon: '🏢' };

    const newLead = {
      id: `real_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      businessName: bizName,
      city: city,
      country: city.includes(',') ? city.split(',')[1].trim() : 'Worldwide',
      address: address,
      mapsUrl: mapsUrl,
      niche: niche,
      nicheName: nicheMeta.name,
      nicheIcon: nicheMeta.icon,
      channel: 'whatsapp',
      rating: 4.8,
      reviews: 95,
      website: `https://${bizName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      decisionMaker: owner.split('(')[0].trim(),
      decisionMakerTitle: owner.includes('(') ? owner.split('(')[1].replace(')', '').trim() : 'Owner & Managing Director',
      flawTitle: flaw,
      flawLeakRange: '$2,500 – $4,800/mo',
      contactInfo: {
        phone: phone,
        email: email,
        linkedin: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(bizName)}`,
        instagram: `https://www.instagram.com/explore/tags/${bizName.toLowerCase().replace(/[^a-z0-9]/g, '')}/`
      },
      status: 'ready',
      auditScore: 88,
      notes: 'Real Verified Lead added by operator'
    };

    // Prepend to leads list
    this.leads.unshift(newLead);
    StorageService.saveLeads(this.leads);
    this.applyFilter('all');
    this.updateMetrics();

    // Close add modal
    const addLeadModal = document.getElementById('add-lead-modal');
    if (addLeadModal) addLeadModal.classList.remove('open');

    // Reset inputs
    if (bizInput) bizInput.value = '';
    if (ownerInput) ownerInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (emailInput) emailInput.value = '';
    if (addressInput) addressInput.value = '';

    this.showToast(`✅ Added real lead "${bizName}"! Opening Pitch...`, 'success');

    // Automatically open the pitch modal for this new real lead!
    setTimeout(() => {
      this.openPitchModal(newLead.id);
    }, 300);
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

  handleCityFilter(cityQuery) {
    const cityInput = document.getElementById('target-city-input');
    if (!cityQuery || cityQuery === 'ALL') {
      if (cityInput) cityInput.value = '';
    } else {
      if (cityInput) cityInput.value = cityQuery;
    }
    this.handleStartHunt(true);
  },

  handleStartHunt(scrollToTable = true) {
    const cityInput = document.getElementById('target-city-input');
    const nicheSelect = document.getElementById('target-niche-select');
    const tableNicheFilter = document.getElementById('table-niche-filter');

    // Sync selected niche
    let niche = 'all';
    if (tableNicheFilter && tableNicheFilter.value) {
      niche = tableNicheFilter.value;
    } else if (nicheSelect && nicheSelect.value) {
      niche = nicheSelect.value;
    }

    if (nicheSelect && nicheSelect.value !== niche) nicheSelect.value = niche;
    if (tableNicheFilter && tableNicheFilter.value !== niche) tableNicheFilter.value = niche;

    const city = cityInput && cityInput.value.trim() ? cityInput.value.trim() : '';

    let matched = [...this.leads];

    // 1. Filter by niche if not 'all'
    if (niche && niche !== 'all') {
      matched = matched.filter(l => l.niche === niche);
    }

    // 2. Filter by city if user entered one
    if (city && city.toLowerCase() !== 'all') {
      const q = city.toLowerCase();
      const cityMatched = matched.filter(l =>
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.country && l.country.toLowerCase().includes(q)) ||
        (l.address && l.address.toLowerCase().includes(q))
      );
      if (cityMatched.length > 0) {
        matched = cityMatched;
      } else {
        const nicheLabel = nicheSelect?.options[nicheSelect.selectedIndex]?.text || niche;
        this.showToast(`No leads in "${city}" for ${nicheLabel}. Showing all ${matched.length} verified leads for this niche!`, 'info');
      }
    }

    // 3. Preserve active channel filter if user had one selected
    if (this.currentChannelFilter && this.currentChannelFilter !== 'all') {
      const ch = this.currentChannelFilter;
      if (ch === 'dispatched') {
        matched = matched.filter(l => l.status === 'dispatched' || l.status === 'replied');
      } else if (['whatsapp', 'gmail', 'linkedin', 'instagram'].includes(ch)) {
        matched = matched.filter(l => l.channel === ch);
      }
    }

    this.filteredLeads = matched;
    this.renderTable();

    const selectedOptionText = nicheSelect?.options[nicheSelect.selectedIndex]?.text || 'Verified Leads';
    this.showToast(`Showing ${matched.length} ${selectedOptionText}!`, 'success');

    if (scrollToTable) {
      const tableHeader = document.querySelector('.leads-section-header');
      if (tableHeader) tableHeader.scrollIntoView({ behavior: 'smooth' });
    }
  },

  applyFilter(filter) {
    this.currentChannelFilter = filter;
    const nicheSelect = document.getElementById('target-niche-select');
    const tableNicheFilter = document.getElementById('table-niche-filter');
    const niche = (tableNicheFilter && tableNicheFilter.value) || (nicheSelect && nicheSelect.value) || 'all';

    let base = [...this.leads];
    if (niche && niche !== 'all') {
      base = base.filter(l => l.niche === niche);
    }

    if (filter === 'all') {
      this.filteredLeads = base;
    } else if (filter === 'dispatched') {
      this.filteredLeads = base.filter(l => l.status === 'dispatched' || l.status === 'replied');
    } else if (filter === 'whatsapp' || filter === 'gmail' || filter === 'linkedin' || filter === 'instagram') {
      this.filteredLeads = base.filter(l => l.channel === filter);
    } else if (filter === 'replied') {
      this.filteredLeads = base.filter(l => l.status === 'replied');
    } else if (filter === 'followup') {
      this.filteredLeads = AutopilotEngine.getDueFollowUps(base);
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
      const bestChannel = lead.recommendedPitchChannel || lead.channel || 'gmail';
      const channelBadge = bestChannel === 'whatsapp'
        ? `<div style="display: flex; flex-direction: column; gap: 2px;">
             <span class="badge-channel whatsapp" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
               <span>⭐</span> <span>📲 WhatsApp</span>
             </span>
             <span style="font-size: 0.66rem; color: #4ade80; font-weight: 600;" title="${lead.pitchChannelReason || ''}">Direct Mobile</span>
           </div>`
        : bestChannel === 'instagram'
        ? `<div style="display: flex; flex-direction: column; gap: 2px;">
             <span class="badge-channel instagram" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
               <span>⭐</span> <span>📸 Insta DM</span>
             </span>
             <span style="font-size: 0.66rem; color: #f472b6; font-weight: 600;" title="${lead.pitchChannelReason || ''}">Story Reply</span>
           </div>`
        : `<div style="display: flex; flex-direction: column; gap: 2px;">
             <span class="badge-channel gmail" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
               <span>⭐</span> <span>📧 Gmail</span>
             </span>
             <span style="font-size: 0.66rem; color: #93c5fd; font-weight: 600;" title="${lead.pitchChannelReason || ''}">Corporate RFP</span>
           </div>`;

      const dispatchTimeStr = lead.dispatchedAt ? new Date(lead.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const statusBadge = lead.status === 'dispatched'
        ? `<span class="status-pill dispatched" title="Dispatched: ${dispatchTimeStr || 'Recorded'}">🚀 Dispatched ${dispatchTimeStr ? `(${dispatchTimeStr})` : ''}</span>`
        : lead.status === 'replied'
        ? `<span class="status-pill replied">🔴 Replied</span>`
        : lead.status === 'followup_due'
        ? `<span class="status-pill followup">⏰ Follow-Up Due</span>`
        : `<span class="status-pill ready">Ready to Pitch</span>`;

      const cleanPhone = (lead.contactInfo.phone || '').replace(/[^0-9]/g, '');
      const fullAddress = lead.address || `${lead.city}, ${lead.country}`;
      const mapsPinUrl = this.getExactMapsUrl(lead);

      const isPakMobile = lead.contactInfo.phone && /^\+92\s*3\d{2}/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, ''));
      const isUaeMobile = lead.contactInfo.phone && /^\+971\s*5/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, ''));
      const isMobileWA = lead.phoneType === 'mobile_whatsapp' || (lead.contactInfo && lead.contactInfo.phoneType === 'mobile_whatsapp') || isPakMobile || isUaeMobile;
      const igHandle = (lead.contactInfo.instagramHandle || '').replace('@', '').trim();
      const phoneSource = (lead.contactInfo && lead.contactInfo.phoneSource) || lead.phoneSource || 'Official Google Business Profile (Maps Knowledge Panel)';

      const phoneDisplay = isMobileWA
        ? `<a href="https://api.whatsapp.com/send?phone=${cleanPhone}" target="_blank" style="color: #4ade80; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Verified Mobile WhatsApp — 1-Tap to Chat">
             <span>📲</span> ${lead.contactInfo.phone}
             <span style="font-size:0.68rem; background: rgba(74,222,128,0.18); color: #4ade80; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(74,222,128,0.4); font-weight: 700;">Mobile WA Active ✅</span>
           </a>
           <span style="font-size:0.68rem; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Official Source of Phone Number">
             📍 <strong style="color: #cbd5e1;">Src:</strong> ${phoneSource}
           </span>`
        : `<span style="color: #cbd5e1; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" title="Official Landline / UAN Helpline (Not on WhatsApp — use Gmail or Instagram DM)">
             <span>📞</span> ${lead.contactInfo.phone}
             <span style="font-size:0.68rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.35); font-weight: 700;">Landline / UAN ⚡</span>
           </span>
           <span style="font-size:0.68rem; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Official Source of Phone Number">
             📍 <strong style="color: #cbd5e1;">Src:</strong> ${phoneSource}
           </span>`;

      const igDisplay = igHandle
        ? `• <a href="https://www.instagram.com/${igHandle}/" target="_blank" style="color: #f472b6; text-decoration: none; font-weight: 600;" title="Open Instagram Profile / DM">📸 @${igHandle}</a>`
        : '';

      const emailDisplay = lead.contactInfo.email
        ? `• <a href="mailto:${lead.contactInfo.email}" style="color: #93c5fd; text-decoration: none; font-weight: 500;" title="Send Direct Email">📧 ${lead.contactInfo.email}</a>`
        : '';

      const websiteUrl = lead.website || (lead.contactInfo && lead.contactInfo.website) || '';
      const cleanWebDomain = websiteUrl ? websiteUrl.replace('https://', '').replace('http://', '').replace(/\/$/, '') : '';
      const webDisplay = websiteUrl
        ? `• <a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;" title="Open Official Website (${cleanWebDomain})">🌐 ${cleanWebDomain} ↗</a>`
        : '';

      const isWaBest = bestChannel === 'whatsapp';
      const isIgBest = bestChannel === 'instagram';
      const isGmailBest = bestChannel === 'gmail';

      return `
        <tr data-lead-id="${lead.id}">
          <td>
            <div class="biz-name-cell">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span class="biz-title">${lead.businessName}</span>
                <a href="${mapsPinUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; text-decoration: none; background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.35) 100%); border: 1px solid rgba(239, 68, 68, 0.6); color: #fca5a5; white-space: nowrap; box-shadow: 0 0 10px rgba(239, 68, 68, 0.25); transition: all 0.2s;" title="1-Tap to Open Real Location Pin & Details on Google Maps">
                  <span>🗺️</span> <span>Maps Pin ↗</span>
                </a>
              </div>
              <span class="biz-location" style="display: flex; flex-direction: column; gap: 3px; margin-top: 3px;">
                <span style="color: #cbd5e1; font-size: 0.76rem; display: flex; align-items: center; gap: 5px;">
                  <span style="color: #ef4444;">📌</span> <strong style="color: #f1f5f9;">Address:</strong> ${fullAddress}
                </span>
                <span style="font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>📍 ${lead.city}</span>
                  • <span class="google-rating-chip">⭐ ${lead.rating} (${(Number(lead.reviews) || 50).toLocaleString()} reviews)</span>
                  • ${phoneDisplay}
                  ${igDisplay}
                  ${emailDisplay}
                  ${webDisplay}
                </span>
              </span>
              <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>👤 <strong style="color: #f1f5f9;">${lead.decisionMaker}</strong> <span style="color: #94a3b8;">(${lead.decisionMakerTitle})</span></span>
                <span style="font-size: 0.68rem; background: rgba(16, 185, 129, 0.14); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 7px; border-radius: 4px; font-weight: 700;" title="Safe outreach greeting for WhatsApp & Instagram: ${lead.teamGreeting || 'Team ' + lead.businessName}">
                  🛡️ Greet: "${lead.teamGreeting || 'Team ' + lead.businessName}"
                </span>
                <a href="${lead.decisionMakerSourceUrl || '#'}" target="_blank" rel="noopener noreferrer" style="font-size: 0.68rem; background: rgba(251, 191, 36, 0.12); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.38); padding: 2px 7px; border-radius: 4px; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;" title="Click to verify founder / director identity source (${lead.decisionMakerSource})">
                  <span>🏛️</span> <span>Src: ${lead.decisionMakerSource || 'Corporate Registry'}</span> <span>↗</span>
                </a>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-niche">${lead.nicheIcon} ${lead.nicheName.split(',')[0]}</span>
          </td>
          <td>
            <div class="flaw-tag" onclick="App.openFlawModal('${lead.id}')" style="cursor: pointer; transition: all 0.15s ease;" title="Click to view full flaw audit, proof links & client talking points">
              <span class="flaw-label">⚠️ ${lead.flawTitle}</span>
              <span class="leak-badge">${lead.flawLeakRange}</span>
              <span style="font-size: 0.66rem; color: #fca5a5; display: flex; align-items: center; gap: 3px; margin-top: 3px; font-weight: 700;">
                <span>🔍</span> Masla & Proof Dekho ↗
              </span>
            </div>
            ${lead.niche === 'restaurants' || lead.niche === 'bakeries_sweets' ? `
              <div style="font-size: 0.68rem; color: #38bdf8; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; background: rgba(56, 189, 248, 0.08); padding: 1px 7px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.28); font-weight: 600;" title="Auto-detected local food delivery aggregator in ${lead.city}, ${lead.country}">
                <span>🛵 ${lead.regionDeliveryApps || PitchEngine.detectDeliveryPlatform(lead)}</span>
              </div>
            ` : ''}
          </td>
          <td>${channelBadge}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-row-actions" style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
              <button class="btn-table-action" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.35) 100%); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.6); font-weight: 800; box-shadow: 0 0 10px rgba(239, 68, 68, 0.25); white-space: nowrap;" onclick="App.openFlawModal('${lead.id}')" title="Masla Aur Proof Dekho: Kahan ghalti hai aur client ko kya bolna hai">
                🔍 Masla Dekho
              </button>
              <button class="btn-table-action" onclick="App.openPitchModal('${lead.id}')" title="Preview Pitch, Verified Source & Strategy Details">
                👁️ Pitch & Details
              </button>
              <button class="btn-table-action" style="${isGmailBest ? 'background: linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(37, 99, 235, 0.6)); color: #ffffff; border: 1px solid #60a5fa; box-shadow: 0 0 10px rgba(59, 130, 246, 0.35);' : 'background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.25)); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35);'} padding: 5px 9px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; cursor: pointer;" onclick="App.dispatchSingleLead('${lead.id}', null, 'gmail')" title="1-Tap Open Gmail with Tailored Pitch${isGmailBest ? ' (⭐ Recommended Channel)' : ''}">
                ${isGmailBest ? '⭐ 📧 Gmail' : '📧 Gmail'}
              </button>
              <button class="btn-table-action" style="${isIgBest ? 'background: linear-gradient(135deg, rgba(225, 48, 108, 0.45), rgba(131, 58, 180, 0.6)); color: #ffffff; border: 1px solid #f472b6; box-shadow: 0 0 10px rgba(244, 114, 182, 0.35);' : 'background: linear-gradient(135deg, rgba(225, 48, 108, 0.15), rgba(131, 58, 180, 0.25)); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.35);'} padding: 5px 9px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; cursor: pointer;" onclick="App.dispatchSingleLead('${lead.id}', null, 'instagram')" title="1-Tap Auto-Copy Pitch & Open Instagram DM${isIgBest ? ' (⭐ Recommended Channel)' : ''}">
                ${isIgBest ? '⭐ 📸 Insta' : '📸 Insta'}
              </button>
              ${isMobileWA
                ? `<button class="btn-table-action btn-table-wa" style="${isWaBest ? 'box-shadow: 0 0 12px rgba(74, 222, 128, 0.5); border: 1px solid #4ade80;' : ''} padding: 5px 9px; font-size: 0.74rem;" onclick="App.dispatchSingleLead('${lead.id}', null, 'whatsapp')" title="1-Tap Direct WhatsApp Chat${isWaBest ? ' (⭐ Recommended Channel)' : ''}">${isWaBest ? '⭐ 📲 WA' : '📲 WA'}</button>`
                : `<button class="btn-table-action" style="background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.15); padding: 5px 8px; font-size: 0.72rem; border-radius: 6px; cursor: pointer;" onclick="App.dispatchLandlineWhatsApp('${lead.id}')" title="Official Landline: Click to learn why WhatsApp is disabled or test on your number">📲 WA</button>`
              }
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

    // Update channel tabs count
    const waCount = this.leads.filter(l => l.channel === 'whatsapp').length;
    const gmailCount = this.leads.filter(l => l.channel === 'gmail').length;
    const liCount = this.leads.filter(l => l.channel === 'linkedin').length;
    const igCount = this.leads.filter(l => l.channel === 'instagram').length;

    const tabAll = document.querySelector('.channel-tab-btn[data-filter="all"]');
    const tabDispatched = document.querySelector('.channel-tab-btn[data-filter="dispatched"]');
    const tabWa = document.querySelector('.channel-tab-btn[data-filter="whatsapp"]');
    const tabGmail = document.querySelector('.channel-tab-btn[data-filter="gmail"]');
    const tabLi = document.querySelector('.channel-tab-btn[data-filter="linkedin"]');
    const tabIg = document.querySelector('.channel-tab-btn[data-filter="instagram"]');

    if (tabAll) tabAll.textContent = `All Leads (${totalLeads})`;
    if (tabDispatched) tabDispatched.innerHTML = `🚀 Dispatched (${dispatchedCount})`;
    if (tabWa) tabWa.textContent = `📲 WhatsApp (${waCount})`;
    if (tabGmail) tabGmail.textContent = `📧 Gmail (${gmailCount})`;
    if (tabLi) tabLi.textContent = `👔 LinkedIn (${liCount})`;
    if (tabIg) tabIg.textContent = `📸 Instagram (${igCount})`;
  },

  openPitchModal(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    this.activeLeadForModal = lead;

    let currentGreetingMode = 'team';
    let pitch = PitchEngine.generatePitch(lead, currentGreetingMode);
    const modal = document.getElementById('pitch-preview-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('modal-pitch-title');
    if (lead.status === 'dispatched' && lead.dispatchedAt) {
      const sentTime = new Date(lead.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      modalTitle.textContent = `${lead.businessName} — Pitch (🚀 Dispatched at ${sentTime})`;
    } else {
      modalTitle.textContent = `${lead.businessName} — Pitch Preview`;
    }
    document.getElementById('modal-pitch-channel-badge').innerHTML = lead.channel === 'whatsapp'
      ? `<span class="badge-channel whatsapp">📲 WhatsApp Direct Outreach</span>`
      : lead.channel === 'gmail'
      ? `<span class="badge-channel gmail">📧 Gmail Pitch</span>`
      : lead.channel === 'linkedin'
      ? `<span class="badge-channel linkedin">👔 LinkedIn Connection Note</span>`
      : `<span class="badge-channel instagram">📸 Instagram Story Reply</span>`;

    document.getElementById('modal-pitch-flaw-title').textContent = lead.flawTitle;
    document.getElementById('modal-pitch-flaw-leak').textContent = lead.flawLeakRange;

    // Local Regional Food Delivery Platform Detection
    const deliveryApp = PitchEngine.detectDeliveryPlatform(lead);
    const deliveryBadgeRow = document.getElementById('modal-pitch-delivery-badge-row');
    const deliveryAppNameEl = document.getElementById('modal-pitch-delivery-app-name');
    const regionLabelEl = document.getElementById('modal-pitch-region-label');

    if (lead.niche === 'restaurants') {
      if (deliveryBadgeRow) deliveryBadgeRow.style.display = 'flex';
      if (deliveryAppNameEl) deliveryAppNameEl.textContent = `${deliveryApp} (30% Commission Cut)`;
      if (regionLabelEl) regionLabelEl.textContent = `📍 ${lead.city || 'Local'} Detected`;
    } else {
      if (deliveryBadgeRow) deliveryBadgeRow.style.display = 'none';
    }

    const demoLinkEl = document.getElementById('modal-pitch-demo-link');
    if (demoLinkEl) {
      demoLinkEl.textContent = lead.demoLink || '';
      demoLinkEl.href = lead.demoLink || '#';
    }

    // Set Address & Live Interactive Google Map
    const modalAddress = document.getElementById('modal-pitch-address');
    const modalCityCountry = document.getElementById('modal-pitch-city-country');
    const modalMapsBtn = document.getElementById('modal-btn-open-maps');
    const modalMapIframe = document.getElementById('modal-map-iframe');
    const modalMapWrapper = document.getElementById('modal-map-embed-wrapper');
    const copyAddressBtn = document.getElementById('modal-btn-copy-address');
    const labelCopyAddress = document.getElementById('label-copy-address');
    const toggleMapBtn = document.getElementById('modal-btn-toggle-map');
    const labelToggleMap = document.getElementById('label-toggle-map');

    const fullAddress = lead.address || `${lead.city}, ${lead.country}`;
    const mapsLink = this.getExactMapsUrl(lead);
    const embedMapLink = this.getEmbedMapsUrl(lead);

    if (modalAddress) modalAddress.textContent = fullAddress;
    if (modalCityCountry) modalCityCountry.textContent = `${lead.city} • ${lead.country}`;
    if (modalMapsBtn) {
      modalMapsBtn.href = mapsLink;
      modalMapsBtn.setAttribute('title', `1-Tap to Open Real Location Pin on Google Maps for ${lead.businessName}`);
    }

    if (modalMapIframe) {
      modalMapIframe.src = embedMapLink;
    }
    if (modalMapWrapper) {
      modalMapWrapper.style.display = 'block';
    }
    if (labelToggleMap) {
      labelToggleMap.textContent = 'Hide Map ▴';
    }

    if (copyAddressBtn) {
      copyAddressBtn.onclick = () => {
        navigator.clipboard.writeText(fullAddress);
        if (labelCopyAddress) labelCopyAddress.textContent = '✅ Copied!';
        this.showToast(`📍 Address copied: ${fullAddress}`, 'success');
        setTimeout(() => {
          if (labelCopyAddress) labelCopyAddress.textContent = 'Copy Address';
        }, 2000);
      };
    }

    if (toggleMapBtn && modalMapWrapper) {
      toggleMapBtn.onclick = () => {
        if (modalMapWrapper.style.display === 'none') {
          modalMapWrapper.style.display = 'block';
          if (labelToggleMap) labelToggleMap.textContent = 'Hide Map ▴';
        } else {
          modalMapWrapper.style.display = 'none';
          if (labelToggleMap) labelToggleMap.textContent = 'Show Map ▾';
        }
      };
    }

    const flawBtnFromPitch = document.getElementById('modal-btn-open-flaw-from-pitch');
    if (flawBtnFromPitch) {
      flawBtnFromPitch.onclick = () => {
        this.openFlawModal(lead.id);
      };
    }

    const dmNameEl = document.getElementById('modal-pitch-dm-name');
    const dmTitleEl = document.getElementById('modal-pitch-dm-title');
    const dmPhoneInput = document.getElementById('modal-pitch-dm-phone-input');
    const phoneSourceEl = document.getElementById('modal-pitch-phone-source');
    const phoneVerifyLink = document.getElementById('modal-pitch-source-verify-link');

    if (dmNameEl) dmNameEl.textContent = lead.decisionMaker;
    if (dmTitleEl) dmTitleEl.textContent = ` (${lead.decisionMakerTitle})`;
    if (dmPhoneInput) dmPhoneInput.value = lead.contactInfo.phone;

    // Founder / Decision Maker Verification Source Link
    const dmSourceEl = document.getElementById('modal-pitch-dm-source');
    const dmSourceLink = document.getElementById('modal-pitch-dm-source-link');
    const bestChannelBadge = document.getElementById('modal-pitch-best-channel-badge');
    const channelReasonEl = document.getElementById('modal-pitch-channel-reason');

    if (dmSourceEl) dmSourceEl.textContent = lead.decisionMakerSource || 'SECP Corporate Filing';
    if (dmSourceLink) {
      dmSourceLink.href = lead.decisionMakerSourceUrl || '#';
      dmSourceLink.setAttribute('title', `Click to verify founder / leadership identity source (${lead.decisionMakerSource})`);
    }

    // Recommended Pitch Channel Strategy
    const recChannel = lead.recommendedPitchChannel || lead.channel || 'gmail';
    if (bestChannelBadge) {
      bestChannelBadge.innerHTML = recChannel === 'whatsapp'
        ? `<span class="badge-channel whatsapp" style="font-weight: 800; font-size: 0.8rem;">⭐ Best: 📲 WhatsApp Direct</span>`
        : recChannel === 'instagram'
        ? `<span class="badge-channel instagram" style="font-weight: 800; font-size: 0.8rem;">⭐ Best: 📸 Instagram DM</span>`
        : `<span class="badge-channel gmail" style="font-weight: 800; font-size: 0.8rem;">⭐ Best: 📧 Gmail Proposal</span>`;
    }

    if (channelReasonEl) {
      channelReasonEl.innerHTML = `<strong style="color: #60a5fa;">🎯 Kahan Pitch Karein Aur Kyun:</strong> ${lead.pitchChannelReason || 'Direct channel gives highest response rate for this establishment.'}`;
    }

    const modalIsMobile = lead.phoneType === 'mobile_whatsapp' || (lead.contactInfo && lead.contactInfo.phoneType === 'mobile_whatsapp') || (lead.contactInfo.phone && (/^\+92\s*3/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, '')) || /^\+971\s*5/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, ''))));
    const phoneTypeBadge = modalIsMobile
      ? '<span style="color:#4ade80; font-weight:700;">[Mobile WhatsApp Active]</span>'
      : '<span style="color:#38bdf8; font-weight:700;">[Official Landline / UAN Helpline]</span>';
    const modalPhoneSource = (lead.contactInfo && lead.contactInfo.phoneSource) || lead.phoneSource || 'Official Google Business Profile (Maps Knowledge Panel)';

    if (phoneSourceEl) phoneSourceEl.innerHTML = `${modalPhoneSource} ${phoneTypeBadge}`;
    if (phoneVerifyLink) {
      phoneVerifyLink.href = mapsLink;
      phoneVerifyLink.textContent = `Verify on Google Maps Place Pin ↗`;
    }

    const testWaBtn = document.getElementById('btn-set-my-wa-test');
    if (testWaBtn) {
      testWaBtn.onclick = () => {
        if (dmPhoneInput) {
          dmPhoneInput.value = '+923376568003';
          this.showToast('Number set to +923376568003 for personal testing!', 'info');
        }
      };
    }

    const subjectInput = document.getElementById('modal-pitch-subject');
    const subjectRow = document.getElementById('modal-pitch-subject-row');
    if (lead.channel === 'gmail') {
      subjectRow.style.display = 'flex';
      subjectInput.value = pitch.subject;
    } else {
      subjectRow.style.display = 'none';
    }

    const textarea = document.getElementById('modal-pitch-textarea');
    textarea.value = lead.dispatchedMessage || pitch.body;

    const counter = document.getElementById('modal-pitch-counter');
    counter.textContent = `${pitch.charCount} characters | ${pitch.limitNote}`;

    // 1-Tap Greeting Mode Switcher (Team vs Founder)
    const btnGreetingTeam = document.getElementById('btn-greeting-team');
    const btnGreetingFounder = document.getElementById('btn-greeting-founder');
    const labelGreetingTeam = document.getElementById('label-greeting-team');
    const labelGreetingFounder = document.getElementById('label-greeting-founder');
    const greetingHint = document.getElementById('greeting-mode-hint');

    const teamGreetName = lead.teamGreeting || PitchEngine.getGreetingName(lead, 'team');
    const founderGreetName = lead.founderGreeting || PitchEngine.getGreetingName(lead, 'founder');

    if (labelGreetingTeam) labelGreetingTeam.textContent = `Team Greeting ("Hi ${teamGreetName},")`;
    if (labelGreetingFounder) labelGreetingFounder.textContent = `Founder Name ("Hi ${founderGreetName},")`;

    const updateGreetingMode = (mode) => {
      currentGreetingMode = mode;
      if (mode === 'team') {
        if (btnGreetingTeam) btnGreetingTeam.classList.add('active');
        if (btnGreetingFounder) btnGreetingFounder.classList.remove('active');
        if (greetingHint) {
          greetingHint.textContent = '🛡️ Safe & Natural for WhatsApp / Instagram Floor Staff';
          greetingHint.style.color = '#38bdf8';
        }
      } else {
        if (btnGreetingTeam) btnGreetingTeam.classList.remove('active');
        if (btnGreetingFounder) btnGreetingFounder.classList.add('active');
        if (greetingHint) {
          greetingHint.textContent = '👤 Addressed to Registered Leadership (Best for Email / LinkedIn)';
          greetingHint.style.color = '#fbbf24';
        }
      }
      pitch = PitchEngine.generatePitch(lead, currentGreetingMode);
      textarea.value = pitch.body;
      if (subjectInput && lead.channel === 'gmail') {
        subjectInput.value = pitch.subject;
      }
      counter.textContent = `${textarea.value.length} characters | ${pitch.limitNote}`;
    };

    if (btnGreetingTeam) {
      btnGreetingTeam.classList.add('active');
      btnGreetingTeam.onclick = () => updateGreetingMode('team');
    }
    if (btnGreetingFounder) {
      btnGreetingFounder.classList.remove('active');
      btnGreetingFounder.onclick = () => updateGreetingMode('founder');
    }

    textarea.oninput = () => {
      counter.textContent = `${textarea.value.length} characters | ${pitch.limitNote}`;
    };

    // Modal action buttons
    document.getElementById('modal-btn-copy').onclick = () => {
      navigator.clipboard.writeText(textarea.value);
      this.showToast('Pitch copied to clipboard!', 'success');
    };

    // Dedicated WhatsApp Dispatch button in modal
    const sendWaBtn = document.getElementById('modal-btn-send-wa');
    if (sendWaBtn) {
      sendWaBtn.onclick = () => {
        this.dispatchSingleLead(lead.id, textarea.value, 'whatsapp');
        modal.classList.remove('open');
      };
    }

    // Dedicated Instagram Dispatch button in modal
    const sendInstaBtn = document.getElementById('modal-btn-send-insta');
    if (sendInstaBtn) {
      sendInstaBtn.onclick = () => {
        this.dispatchSingleLead(lead.id, textarea.value, 'instagram');
        modal.classList.remove('open');
      };
    }

    // Dedicated Gmail Dispatch fallback button in modal
    const sendGmailBtn = document.getElementById('modal-btn-send-gmail');
    if (sendGmailBtn) {
      sendGmailBtn.onclick = () => {
        this.dispatchSingleLead(lead.id, textarea.value, 'gmail');
        modal.classList.remove('open');
      };
    }

    document.getElementById('modal-btn-bhejdo').onclick = () => {
      this.dispatchSingleLead(lead.id, textarea.value);
      modal.classList.remove('open');
    };

    modal.classList.add('open');
  },

  dispatchSingleLead(leadId, customBody = null, channelOverride = null, targetPhoneOverride = null) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const activeChannel = channelOverride || lead.channel;

    // Launch direct action based on channel with safe, natural team greeting default
    let pitch = PitchEngine.generatePitch(lead, 'team');
    const teamGreet = lead.teamGreeting || PitchEngine.getGreetingName(lead, 'team');
    const cleanBiz = lead.businessName ? lead.businessName.split('(')[0].trim() : 'your business';

    if (activeChannel === 'whatsapp' && lead.channel !== 'whatsapp') {
      pitch = PitchEngine.generateWhatsAppPitch(lead, teamGreet, cleanBiz);
    } else if (activeChannel === 'instagram' && lead.channel !== 'instagram') {
      pitch = PitchEngine.generateInstagramPitch(lead, teamGreet, cleanBiz);
    } else if (activeChannel === 'gmail' && lead.channel !== 'gmail') {
      pitch = PitchEngine.generateGmailPitch(lead, teamGreet, cleanBiz);
    }
    const body = customBody || pitch.body;

    lead.status = 'dispatched';
    lead.dispatchedAt = new Date().toISOString();
    lead.dispatchedMessage = body;
    const due = new Date();
    due.setHours(due.getHours() + 72);
    lead.followupDueAt = due.toISOString();

    StorageService.markAsPitched(lead.id, lead.businessName);
    StorageService.saveLeads(this.leads);
    this.renderTable();
    this.updateMetrics();

    if (activeChannel === 'whatsapp') {
      const phoneInput = document.getElementById('modal-pitch-dm-phone-input');
      const rawPhone = targetPhoneOverride || ((phoneInput && phoneInput.value && phoneInput.value.trim()) ? phoneInput.value.trim() : (lead.contactInfo.phone || '+923376568003'));
      lead.contactInfo.phone = rawPhone;
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const waText = encodeURIComponent(body);
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${waText}`;
      window.open(waUrl, '_blank');
    } else if (activeChannel === 'gmail') {
      const subject = encodeURIComponent(pitch.subject || `quick question re ${cleanBiz}`);
      const emailBody = encodeURIComponent(body);
      const targetEmail = lead.contactInfo.email || `contact@${cleanBiz.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      const mailtoUrl = `mailto:${targetEmail}?subject=${subject}&body=${emailBody}`;
      window.open(mailtoUrl, '_blank');
    } else if (activeChannel === 'linkedin') {
      window.open(`https://www.linkedin.com/messaging`, '_blank');
    } else if (activeChannel === 'instagram') {
      const rawHandle = lead.contactInfo.instagramHandle || '';
      const cleanHandle = rawHandle.replace(/[@/]/g, '').trim();
      try {
        navigator.clipboard.writeText(body);
      } catch (e) {
        console.warn('Clipboard write failed:', e);
      }
      if (cleanHandle) {
        window.open(`https://www.instagram.com/${cleanHandle}/`, '_blank');
        this.showToast(`📋 Pitch copied! Instagram opened for @${cleanHandle}. Just paste (Ctrl+V) in DM!`, 'success');
      } else {
        window.open(`https://www.instagram.com/direct/inbox/`, '_blank');
        this.showToast(`📋 Pitch copied to clipboard! Opening Instagram Inbox. Just paste (Ctrl+V)!`, 'success');
      }
    }

    this.showToast(`🚀 Dispatched to ${lead.businessName} via ${activeChannel.toUpperCase()}!`, 'success');
  },

  dispatchLandlineWhatsApp(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    const choice = confirm(
      `📞 ${lead.businessName} ka official phone number (${lead.contactInfo.phone}) Landline / UAN Helpline hai.\n\n` +
      `Landlines par WhatsApp messaging activate nahi hoti. Owner aur Management tak direct pohnchne ke liye:\n` +
      `• "📧 Gmail" button dabayein taake direct proposal email draft khul jaye.\n` +
      `• "📸 Insta DM" button dabayein taake Instagram profile aur DM khul jaye.\n\n` +
      `Agar aap is lead ki tailored pitch apne personal testing number (${this.settings.whatsapp_number || '+923376568003'}) par test bhejna chahte hain to OK dabayein.`
    );
    if (choice) {
      this.dispatchSingleLead(lead.id, null, 'whatsapp', this.settings.whatsapp_number || '+923376568003');
    }
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
    const headers = [
      'Business Name', 'City', 'Country', 'Address', 'Niche', 'Rating', 'Reviews',
      'Decision Maker', 'Decision Maker Title', 'Flaw Title', 'Monthly Leak', 'Channel',
      'Contact Phone', 'Contact Email/Handle', 'Status', 'Dispatched At', 'Dispatched Message', 'Google Maps Pin'
    ];
    const rows = this.leads.map(l => [
      `"${(l.businessName || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${(l.country || '').replace(/"/g, '""')}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      `"${(l.nicheName || '').replace(/"/g, '""')}"`,
      l.rating,
      l.reviews,
      `"${(l.decisionMaker || '').replace(/"/g, '""')}"`,
      `"${(l.decisionMakerTitle || '').replace(/"/g, '""')}"`,
      `"${(l.flawTitle || '').replace(/"/g, '""')}"`,
      `"${(l.flawLeakRange || '').replace(/"/g, '""')}"`,
      l.channel,
      `"${(l.contactInfo && l.contactInfo.phone) ? l.contactInfo.phone : ''}"`,
      `"${(l.contactInfo && (l.contactInfo.email || l.contactInfo.instagramHandle || l.contactInfo.linkedinProfile)) || ''}"`,
      l.status,
      `"${l.dispatchedAt || 'Not yet dispatched'}"`,
      `"${(l.dispatchedMessage || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${this.getExactMapsUrl(l)}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `restohunter_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('📥 Exported leads as CSV file with dispatched logs!', 'success');
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
  },

  getFlawAuditDetails(lead) {
    const deliveryApp = PitchEngine.detectDeliveryPlatform(lead);
    const cleanBiz = (lead.businessName || '').split('(')[0].trim();
    const cityClean = (lead.city || '').split(',')[0].trim();
    const mapsLink = this.getExactMapsUrl(lead);
    const igHandle = (lead.contactInfo && lead.contactInfo.instagramHandle) ? lead.contactInfo.instagramHandle.replace('@', '').trim() : '';
    const igLink = igHandle ? `https://www.instagram.com/${igHandle}/` : null;

    const websiteLink = lead.website || (lead.contactInfo && lead.contactInfo.website) || '';
    const websiteDomain = websiteLink ? websiteLink.replace('https://', '').replace('http://', '').replace(/\/$/, '') : '';

    let websiteInsight = '';
    if (websiteLink) {
      websiteInsight = `Inki official website (<a href="${websiteLink}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 700;">${websiteDomain} ↗</a>) pehle se bani hui hai. <strong>Agency inhein "website banane" ki pitch nahi karegi!</strong> Agency inhein batati hai ke inki mojooda digital presence mein specific friction point kya hai (${lead.flawTitle}). Hum inhein <strong>"Conversion Optimization & Revenue Recovery Funnel"</strong> deliver karte hain jis se inka munafa aur direct bookings barhti hain.`;
    } else {
      websiteInsight = `Inki koi official direct booking/order website nahi hai — yeh 100% third-party aggregators, phone calls ya DMs par munhasir hain. Inhe direct 1-tap mobile funnel deliver karein.`;
    }

    // Dynamic resolution of unique lead flaw and audit details
    const whatIsWrong = lead.specificWeakness || `Jab koi customer mobile phone par ${cleanBiz} ke services/products browse karta hai, to wahan direct 1-tap booking/ordering funnel nahi milta (${lead.flawTitle}).`;

    const whereToCheck = lead.whereToCheck || `1. Google Maps profile aur official website/links check karein: ${lead.flawTitle}.\n2. Instagram bio (@${igHandle || 'business'}) mein direct 1-tap funnel check karein.`;

    const whyMoneyLeaks = lead.whyMoneyLeaks || `Is friction aur bottleneck ki wajah se peak hours aur after-hours customers competitor ke paas chalay jaatay hain, jis se mahine mein lagbhag ${lead.flawLeakRange} ka direct revenue loss hota hai.`;

    const talkingPoints = (lead.talkingPoints && Array.isArray(lead.talkingPoints) && lead.talkingPoints.length > 0)
      ? lead.talkingPoints
      : [
          `"Saw your mobile presence for ${cleanBiz}, but noticed ${lead.flawTitle} creates significant customer friction."`,
          `"For top-tier businesses in ${cityClean}, this drop-off typically leaks ~${lead.flawLeakRange} in lost bookings/orders every month."`,
          `"Hum 48 hours mein ${lead.deliverableSolution || 'direct 1-tap mobile conversion system'} deliver karte hain jo is leak ko khatam karta hai."`
        ];

    let clientQuestions = [];
    if (lead.clientQuestion && lead.clientAnswer) {
      clientQuestions.push({
        q: lead.clientQuestion,
        a: lead.clientAnswer
      });
    }
    clientQuestions.push({
      q: `Client puche: 'Aap humein bana kar kya dogay?'`,
      a: `Jawab: 'Sir hum 48 hours mein ${lead.deliverableSolution || '1-Tap Direct Mobile Funnel'} tayyar karke deliver karein gay jo direct aapke WhatsApp/POS system se sync hoga.'`
    });

    const deliverableSolution = lead.deliverableSolution || `Branded 1-Tap Mobile Conversion Funnel (Direct WhatsApp Sync, 48 Hours Mein Ready)`;

    return {
      bizName: lead.businessName,
      cleanBiz,
      city: lead.city,
      country: lead.country,
      flawTitle: lead.flawTitle,
      leakRange: lead.flawLeakRange,
      deliveryApp,
      mapsLink,
      igLink,
      igHandle,
      websiteLink,
      websiteDomain,
      websiteInsight,
      whatIsWrong,
      whereToCheck,
      whyMoneyLeaks,
      talkingPoints,
      clientQuestions,
      deliverableSolution
    };
  },

  openFlawModal(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const modal = document.getElementById('flaw-audit-modal');
    if (!modal) return;

    const audit = this.getFlawAuditDetails(lead);

    const titleEl = document.getElementById('flaw-modal-biz-name');
    const flawTitleEl = document.getElementById('flaw-modal-title');
    const leakEl = document.getElementById('flaw-modal-leak');
    const whatEl = document.getElementById('flaw-modal-what');
    const whereEl = document.getElementById('flaw-modal-where');
    const btnInspectMaps = document.getElementById('flaw-btn-inspect-maps');
    const btnInspectIg = document.getElementById('flaw-btn-inspect-ig');
    const btnInspectWeb = document.getElementById('flaw-btn-inspect-web');
    const websiteExplanationEl = document.getElementById('flaw-modal-website-explanation');
    const whyEl = document.getElementById('flaw-modal-why');
    const talkingPointsEl = document.getElementById('flaw-modal-talking-points');
    const qaContainerEl = document.getElementById('flaw-modal-qa-container');
    const solutionEl = document.getElementById('flaw-modal-solution');

    if (titleEl) titleEl.textContent = `${lead.businessName} — Client Flaw Audit`;
    if (flawTitleEl) flawTitleEl.textContent = lead.flawTitle;
    if (leakEl) leakEl.textContent = lead.flawLeakRange;
    if (whatEl) whatEl.textContent = audit.whatIsWrong;
    if (whereEl) whereEl.textContent = audit.whereToCheck;

    if (btnInspectMaps) {
      btnInspectMaps.href = audit.mapsLink;
      btnInspectMaps.setAttribute('title', `Open live Google Maps profile to see orders/menu for ${lead.businessName}`);
    }

    if (btnInspectIg) {
      if (audit.igLink) {
        btnInspectIg.href = audit.igLink;
        btnInspectIg.style.display = 'inline-flex';
        btnInspectIg.textContent = `📸 Open Instagram @${audit.igHandle} ↗`;
      } else {
        btnInspectIg.style.display = 'none';
      }
    }

    if (btnInspectWeb) {
      if (audit.websiteLink) {
        btnInspectWeb.href = audit.websiteLink;
        btnInspectWeb.style.display = 'inline-flex';
        btnInspectWeb.textContent = `🌐 Open Website (${audit.websiteDomain}) ↗`;
      } else {
        btnInspectWeb.style.display = 'none';
      }
    }

    if (websiteExplanationEl) {
      websiteExplanationEl.innerHTML = audit.websiteInsight;
    }

    if (whyEl) whyEl.textContent = audit.whyMoneyLeaks;

    if (talkingPointsEl) {
      talkingPointsEl.innerHTML = audit.talkingPoints.map(pt => `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="color: #34d399; font-weight: 800; font-size: 0.9rem;">✓</span>
          <span>${pt}</span>
        </div>
      `).join('');
    }

    if (qaContainerEl) {
      qaContainerEl.innerHTML = audit.clientQuestions.map(item => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 6px;">
          <strong style="color: #fca5a5; display: block; margin-bottom: 3px;">❓ ${item.q}</strong>
          <span style="color: #cbd5e1; line-height: 1.45;">💬 ${item.a}</span>
        </div>
      `).join('');
    }

    if (solutionEl) solutionEl.textContent = audit.deliverableSolution;

    // Action button handlers
    const closeBtn1 = document.getElementById('modal-flaw-close');
    const closeBtn2 = document.getElementById('modal-btn-flaw-close-btn');
    const copySummaryBtn = document.getElementById('modal-btn-flaw-copy-summary');
    const proceedPitchBtn = document.getElementById('modal-btn-flaw-proceed-pitch');

    const closeModal = () => modal.classList.remove('open');
    if (closeBtn1) closeBtn1.onclick = closeModal;
    if (closeBtn2) closeBtn2.onclick = closeModal;

    if (copySummaryBtn) {
      copySummaryBtn.onclick = () => {
        const summaryText = `AUDIT BREAKDOWN FOR ${lead.businessName.toUpperCase()}:\n\n` +
          `⚠️ Flaw: ${lead.flawTitle}\n` +
          `💸 Estimated Loss: ${lead.flawLeakRange}\n` +
          `🌐 Website: ${audit.websiteDomain || 'None (Direct Funnel Needed)'}\n\n` +
          `1. Asal Masla:\n${audit.whatIsWrong}\n\n` +
          `2. Kahan Dekhein:\n${audit.whereToCheck}\n\n` +
          `3. Financial Leak:\n${audit.whyMoneyLeaks}\n\n` +
          `4. Client Talking Points:\n` + audit.talkingPoints.join('\n') + `\n\n` +
          `5. Deliverable Solution:\n${audit.deliverableSolution}`;
        navigator.clipboard.writeText(summaryText);
        this.showToast('📋 Flaw Audit Breakdown copied to clipboard!', 'success');
      };
    }

    if (proceedPitchBtn) {
      proceedPitchBtn.onclick = () => {
        closeModal();
        this.openPitchModal(lead.id);
      };
    }

    modal.classList.add('open');
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
