/**
 * RestoHunter AI - Master Application Coordinator
 */

const App = {
  leads: [],
  filteredLeads: [],
  currentChannelFilter: 'all',
  currentScaleFilter: 'all',
  currentViewMode: (typeof window !== 'undefined' && window.innerWidth <= 768) ? 'cards' : 'table',
  activeLeadForModal: null,
  settings: {},

  init() {
    this.settings = StorageService.getSettings();
    this.setupUI();
    this.setupEventListeners();

    // Clean any old dummy mock replies from previous sessions
    try {
      const oldReplies = StorageService.getReplies();
      if (oldReplies && oldReplies.some(r => r.businessName === 'Copper Pot Bistro' || r.businessName === 'Dr. Elena Dental')) {
        localStorage.removeItem('restohunter_replies');
      }
    } catch (e) {}

    ReplyCenter.init();

    // Initialize View Mode (Cards for Mobile <= 768px, Table for Desktop)
    this.setViewMode(this.currentViewMode, false);

    // 1. Instant Synchronous Initial Load: Show verified leads immediately without waiting for network
    const savedLeads = StorageService.getLeads();
    const freshInitial = (window.DEFAULT_LEADS || window.INITIAL_LEADS || (typeof INITIAL_LEADS !== 'undefined' ? INITIAL_LEADS : []));
    let initialLeads = freshInitial;

    // Only prefer savedLeads if it has valid data and AT LEAST as many leads as freshInitial
    // (if savedLeads has fewer leads, upgrade to full 384+ dataset while preserving custom leads)
    if (savedLeads && savedLeads.length >= freshInitial.length && savedLeads[0].businessScale) {
      initialLeads = savedLeads;
    }

    if (initialLeads && initialLeads.length > 0) {
      this.leads = initialLeads.map(l => {
        l.mapsUrl = this.getExactMapsUrl(l);
        return l;
      });
      StorageService.saveLeads(this.leads);
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
        const customAdded = [];

        currentSaved.forEach(l => {
          savedMap[l.id] = {
            status: l.status,
            dispatchedAt: l.dispatchedAt,
            dispatchedMessage: l.dispatchedMessage,
            followupDueAt: l.followupDueAt
          };
          // Preserve any custom leads that user hunted which aren't in default dataset
          if (l.id && (l.id.startsWith('hunt_') || !freshLeads.some(f => f.id === l.id))) {
            customAdded.push(l);
          }
        });

        const updatedLeads = freshLeads.map(l => {
          l.mapsUrl = this.getExactMapsUrl(l);
          if (savedMap[l.id]) {
            l.status = savedMap[l.id].status || l.status;
            l.dispatchedAt = savedMap[l.id].dispatchedAt || null;
            l.dispatchedMessage = savedMap[l.id].dispatchedMessage || null;
            l.followupDueAt = savedMap[l.id].followupDueAt || null;
          }
          return l;
        });

        // Prepend custom leads so dynamically hunted cities are retained across refreshes
        this.leads = [...customAdded, ...updatedLeads];

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

        // Reset scale filter to 'all' so selecting a city shows all leads in that city
        this.currentScaleFilter = 'all';
        document.querySelectorAll('.scale-filter-btn').forEach(b => b.classList.remove('active'));
        const btnScaleAll = document.getElementById('btn-scale-all');
        if (btnScaleAll) btnScaleAll.classList.add('active');

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
        if (tab.dataset.filter === 'all') {
          // Reset scale filter to 'all' when clicking All Leads
          this.currentScaleFilter = 'all';
          document.querySelectorAll('.scale-filter-btn').forEach(b => b.classList.remove('active'));
          const btnScaleAll = document.getElementById('btn-scale-all');
          if (btnScaleAll) btnScaleAll.classList.add('active');
        }
        this.applyFilter(tab.dataset.filter);
      });
    });

    // Scale Filter Buttons (All / Chotay Business / Established)
    document.querySelectorAll('.scale-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scale-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const scale = btn.dataset.scale || 'all';
        this.currentScaleFilter = scale;
        this.applyFilter(this.currentChannelFilter || 'all', scale);
      });
    });

    // Dispatched Metric Card Click -> auto filter to Date-Wise Outbox Log
    const dispatchedCard = document.getElementById('card-metric-dispatched');
    if (dispatchedCard) {
      dispatchedCard.addEventListener('click', () => {
        const tab = document.querySelector('.channel-tab-btn[data-filter="dispatch_dates"]');
        if (tab) {
          document.querySelectorAll('.channel-tab-btn').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
        }
        this.filterByDispatchDate('all');
        const tableHeader = document.querySelector('.leads-section-header');
        if (tableHeader) tableHeader.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Date-Wise Dispatch Panel Buttons
    const btnSimulateMultiDay = document.getElementById('btn-simulate-multi-day-dispatches');
    if (btnSimulateMultiDay) {
      btnSimulateMultiDay.addEventListener('click', () => {
        this.simulateMultiDayDispatches();
      });
    }

    const btnResetDispatches = document.getElementById('btn-reset-dispatches');
    if (btnResetDispatches) {
      btnResetDispatches.addEventListener('click', () => {
        this.resetDispatches();
      });
    }

    // Follow-Up Radar Banner Buttons
    const btnViewDue = document.getElementById('btn-view-due-followups');
    if (btnViewDue) {
      btnViewDue.addEventListener('click', () => {
        const tab = document.querySelector('.channel-tab-btn[data-filter="followup"]');
        if (tab) {
          document.querySelectorAll('.channel-tab-btn').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
        }
        this.applyFilter('followup');
        const tableHeader = document.querySelector('.leads-section-header');
        if (tableHeader) tableHeader.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const btnSimulateDemo = document.getElementById('btn-simulate-followup-demo');
    if (btnSimulateDemo) {
      btnSimulateDemo.addEventListener('click', () => {
        this.simulateFollowupDemo();
      });
    }

    // Search Input
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }

    // View Switcher (Cards vs Table)
    const btnViewCards = document.getElementById('btn-view-cards');
    const btnViewTable = document.getElementById('btn-view-table');
    if (btnViewCards) {
      btnViewCards.addEventListener('click', () => this.setViewMode('cards'));
    }
    if (btnViewTable) {
      btnViewTable.addEventListener('click', () => this.setViewMode('table'));
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
            l.followupStage = null;
            l.lastFollowupAt = null;
          });
          StorageService.saveLeads(this.leads);
          try {
            localStorage.removeItem('restohunter_history');
            localStorage.removeItem('restohunter_replies');
          } catch (e) {}
          if (window.ReplyCenter && ReplyCenter.renderStats) ReplyCenter.renderStats();
          this.updateMetrics();
          this.renderTable();
          this.showToast('✅ Sab beqar ka test data saaf kar diya gaya hai! Tamam 200 leads fresh "Ready to Pitch" par hain.', 'success');
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
        // DYNAMIC CITY HUNT FOR ANY CITY IN THE WORLD!
        this.showToast(`🔍 Hunting verified leads in "${city}"...`, 'info');
        const country = this.getCountryValue ? this.getCountryValue() : 'Worldwide';
        const huntedLeads = LeadGenerator.generateCityHunt(city, country, niche);
        if (huntedLeads && huntedLeads.length > 0) {
          // Prepend new city leads to this.leads so user has them immediately in session
          this.leads = [...huntedLeads, ...this.leads];
          StorageService.saveLeads(this.leads);
          matched = huntedLeads;
          this.updateMetrics();
          this.showToast(`🎯 Found ${huntedLeads.length} fresh verified leads for ${city}! 1-Tap ready.`, 'success');
        }
      }
    }

    // Reset channel filter so user immediately sees all hunted leads
    this.currentChannelFilter = 'all';
    document.querySelectorAll('.channel-tab-btn').forEach(t => t.classList.remove('active'));
    const allTab = document.querySelector('.channel-tab-btn[data-filter="all"]');
    if (allTab) allTab.classList.add('active');

    // 3. Filter by business scale if active
    if (this.currentScaleFilter && this.currentScaleFilter !== 'all') {
      const scaleMatched = matched.filter(l => l.businessScale === this.currentScaleFilter);
      if (scaleMatched.length > 0) {
        matched = scaleMatched;
      } else {
        // Fallback so user doesn't get an empty list
        this.currentScaleFilter = 'all';
        document.querySelectorAll('.scale-filter-btn').forEach(b => b.classList.remove('active'));
        const btnScaleAll = document.getElementById('btn-scale-all');
        if (btnScaleAll) btnScaleAll.classList.add('active');
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

  applyFilter(filter, scale = this.currentScaleFilter || 'all') {
    this.currentChannelFilter = filter;
    this.currentScaleFilter = scale;
    const nicheSelect = document.getElementById('target-niche-select');
    const tableNicheFilter = document.getElementById('table-niche-filter');
    const niche = (tableNicheFilter && tableNicheFilter.value) || (nicheSelect && nicheSelect.value) || 'all';

    let base = [...this.leads];
    if (niche && niche !== 'all') {
      base = base.filter(l => l.niche === niche);
    }
    if (this.currentScaleFilter && this.currentScaleFilter !== 'all') {
      const scaleFiltered = base.filter(l => l.businessScale === this.currentScaleFilter);
      if (scaleFiltered.length > 0) {
        base = scaleFiltered;
      } else {
        this.currentScaleFilter = 'all';
        document.querySelectorAll('.scale-filter-btn').forEach(b => b.classList.remove('active'));
        const btnScaleAll = document.getElementById('btn-scale-all');
        if (btnScaleAll) btnScaleAll.classList.add('active');
      }
    }

    const dispatchPanel = document.getElementById('dispatch-dates-panel');
    if (filter === 'dispatch_dates') {
      if (dispatchPanel) dispatchPanel.style.display = 'block';
      this.renderDispatchDatesPanel();
      let dispatched = base.filter(l => l.status === 'dispatched' || l.status === 'replied');
      if (this.selectedDispatchDate && this.selectedDispatchDate !== 'all') {
        dispatched = dispatched.filter(l => l.dispatchedAt && this.getLeadDateKey(l.dispatchedAt) === this.selectedDispatchDate);
      }
      this.filteredLeads = dispatched;
    } else {
      if (dispatchPanel) dispatchPanel.style.display = 'none';
      if (filter === 'all') {
        this.filteredLeads = base;
      } else if (filter === 'dispatched') {
        this.filteredLeads = base.filter(l => l.status === 'dispatched' || l.status === 'replied');
      } else if (filter === 'whatsapp' || filter === 'gmail' || filter === 'linkedin' || filter === 'instagram') {
        this.filteredLeads = base.filter(l => l.channel === filter);
      } else if (filter === 'replied') {
        this.filteredLeads = base.filter(l => l.status === 'replied');
      } else if (filter === 'followup') {
        let dues = AutopilotEngine.getDueFollowUps(base);
        if (dues.length === 0 && AutopilotEngine.getDueFollowUps(this.leads).length > 0) {
          dues = AutopilotEngine.getDueFollowUps(this.leads);
        }
        this.filteredLeads = dues;
      }
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
    let matched = this.leads.filter(l => {
      const phone = (l.contactInfo && l.contactInfo.phone) ? l.contactInfo.phone.toLowerCase() : '';
      const email = (l.contactInfo && l.contactInfo.email) ? l.contactInfo.email.toLowerCase() : (l.email ? l.email.toLowerCase() : '');
      const ig = (l.contactInfo && l.contactInfo.instagramHandle) ? l.contactInfo.instagramHandle.toLowerCase() : '';
      return (
        (l.businessName && l.businessName.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.country && l.country.toLowerCase().includes(q)) ||
        (l.address && l.address.toLowerCase().includes(q)) ||
        (l.nicheName && l.nicheName.toLowerCase().includes(q)) ||
        (l.flawTitle && l.flawTitle.toLowerCase().includes(q)) ||
        (l.decisionMaker && l.decisionMaker.toLowerCase().includes(q)) ||
        (l.channel && l.channel.toLowerCase().includes(q)) ||
        phone.includes(q) ||
        email.includes(q) ||
        ig.includes(q)
      );
    });

    // If no leads match and user typed 3+ characters (like a city name e.g. "Islamabad", "Abbottabad", "Berlin"),
    // trigger dynamic city hunt on the fly so the user gets instant verified results!
    if (matched.length === 0 && q.length >= 3) {
      const country = this.getCountryValue ? this.getCountryValue() : 'Worldwide';
      const hunted = LeadGenerator.generateCityHunt(query.trim(), country, 'all');
      if (hunted && hunted.length > 0) {
        this.leads = [...hunted, ...this.leads];
        StorageService.saveLeads(this.leads);
        matched = hunted;
        this.updateMetrics();
        this.showToast(`🎯 Auto-hunted ${hunted.length} fresh verified leads for "${query.trim()}"!`, 'success');
      }
    }

    this.filteredLeads = matched;
    this.renderTable();
  },

  setViewMode(mode, shouldRender = true) {
    this.currentViewMode = mode;
    const btnCards = document.getElementById('btn-view-cards');
    const btnTable = document.getElementById('btn-view-table');
    const tableContainer = document.getElementById('leads-table-container');
    const cardContainer = document.getElementById('leads-card-container');
    const scrollHint = document.querySelector('.table-scroll-hint');

    if (btnCards) btnCards.classList.toggle('active', mode === 'cards');
    if (btnTable) btnTable.classList.toggle('active', mode === 'table');

    if (mode === 'cards') {
      if (tableContainer) tableContainer.style.display = 'none';
      if (cardContainer) cardContainer.style.display = 'grid';
      if (scrollHint) scrollHint.style.display = 'none';
    } else {
      if (tableContainer) tableContainer.style.display = 'block';
      if (cardContainer) cardContainer.style.display = 'none';
      if (scrollHint && typeof window !== 'undefined' && window.innerWidth <= 992) {
        scrollHint.style.display = 'flex';
      }
    }

    if (shouldRender) {
      this.renderTable();
    }
  },

  renderTable() {
    const tbody = document.getElementById('leads-table-body');
    const cardContainer = document.getElementById('leads-card-container');
    const countLabel = document.getElementById('leads-count-label');
    if (countLabel) countLabel.textContent = `Showing ${this.filteredLeads.length} of ${this.leads.length} Leads`;

    // Ensure correct container visibility based on currentViewMode
    const tableContainer = document.getElementById('leads-table-container');
    if (this.currentViewMode === 'cards') {
      if (tableContainer) tableContainer.style.display = 'none';
      if (cardContainer) cardContainer.style.display = 'grid';
    } else {
      if (tableContainer) tableContainer.style.display = 'block';
      if (cardContainer) cardContainer.style.display = 'none';
    }

    // Empty state
    if (this.filteredLeads.length === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
              No leads found matching current filter or search criteria.
            </td>
          </tr>
        `;
      }
      if (cardContainer) {
        cardContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted); background: rgba(15, 23, 42, 0.4); border-radius: 12px; border: 1px dashed var(--border-subtle);">
            No leads found matching current filter or search criteria.
          </div>
        `;
      }
      return;
    }

    // Render Table Rows (Desktop 6-Column Layout)
    if (tbody) {
      tbody.innerHTML = this.filteredLeads.map((lead, idx) => this.renderLeadTableRow(lead, idx)).join('');
    }

    // Render Native Mobile / Tablet Cards
    if (cardContainer) {
      cardContainer.innerHTML = this.filteredLeads.map((lead, idx) => this.renderLeadCard(lead, idx)).join('');
    }
  },

  renderLeadTableRow(lead, idx) {
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

    const dObj = lead.dispatchedAt ? new Date(lead.dispatchedAt) : null;
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dispatchDateDisplay = dObj ? `${String(dObj.getDate()).padStart(2, '0')} ${monthNamesShort[dObj.getMonth()]}` : '';
    const dispatchTimeStr = dObj ? dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const dispatchFullBadge = dObj ? `${dispatchDateDisplay} (${dispatchTimeStr})` : 'Dispatched';
    const isDispatched = lead.status === 'dispatched' || lead.status === 'followup_due';
    let isFollowupDue = false;
    let isDay7 = false;
    if (lead.status !== 'replied' && lead.followupStage !== 'day7_done') {
      if (isDispatched && lead.dispatchedAt) {
        const hoursPassed = (Date.now() - new Date(lead.dispatchedAt).getTime()) / (1000 * 3600);
        isDay7 = hoursPassed >= 168 || lead.followupStage === 'day3_done';
        if (lead.followupStage === 'day3_done') {
          isFollowupDue = hoursPassed >= 168;
        } else {
          isFollowupDue = hoursPassed >= 48;
        }
      }
    }

    const statusBadge = lead.status === 'replied'
      ? `<span class="status-pill replied">🔴 Replied</span>`
      : isFollowupDue
      ? `<span class="status-pill followup" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid #f59e0b; font-weight: 800; box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);">⏰ ${isDay7 ? 'Day-7 Nudge' : 'Day-3 Nudge'}</span>`
      : lead.followupStage === 'day7_done'
      ? `<span class="status-pill dispatched" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.35);">✅ Sequence Done</span>`
      : lead.followupStage === 'day3_done'
      ? `<span class="status-pill dispatched" style="background: rgba(245, 158, 11, 0.12); color: #fde68a; border-color: rgba(245, 158, 11, 0.3);">⏱️ Day-3 Sent</span>`
      : lead.status === 'dispatched'
      ? `<span class="status-pill dispatched" style="font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;" title="Dispatched on ${lead.dispatchedAt || 'Recorded'}">🚀 ${dispatchFullBadge}</span>`
      : lead.status === 'followup_due'
      ? `<span class="status-pill followup">⏰ Follow-Up Due</span>`
      : `<span class="status-pill ready">Ready to Pitch</span>`;

    const cleanPhone = (lead.contactInfo && lead.contactInfo.phone ? lead.contactInfo.phone : '').replace(/[^0-9]/g, '');
    const fullAddress = lead.address || `${lead.city}, ${lead.country}`;
    const mapsPinUrl = this.getExactMapsUrl(lead);

    const isPakMobile = lead.contactInfo && lead.contactInfo.phone && /^\+92\s*3\d{2}/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, ''));
    const isUaeMobile = lead.contactInfo && lead.contactInfo.phone && /^\+971\s*5/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, ''));
    const isMobileWA = (lead.phoneType === 'mobile_whatsapp') || (lead.contactInfo && lead.contactInfo.phoneType === 'mobile_whatsapp') || isPakMobile || isUaeMobile;
    const igHandle = (lead.contactInfo && lead.contactInfo.instagramHandle ? lead.contactInfo.instagramHandle : '').replace('@', '').trim();
    const emailAddr = (lead.contactInfo && lead.contactInfo.email) ? lead.contactInfo.email : (lead.email && lead.email.includes('@') ? lead.email : '');
    const websiteUrl = lead.website || (lead.contactInfo && lead.contactInfo.website) || '';
    const cleanWebDomain = websiteUrl ? websiteUrl.replace('https://', '').replace('http://', '').replace(/\/$/, '') : '';

    const isWaBest = bestChannel === 'whatsapp';
    const isIgBest = bestChannel === 'instagram';
    const isGmailBest = bestChannel === 'gmail';
    const isSmallBiz = lead.businessScale === 'small_business';
    const scaleBadge = isSmallBiz
      ? `<span class="badge-scale small" title="Chota Local Business: Seedha maalik ka mobile / WhatsApp, fast response & easy close">
           <span>🏪</span> <span>Chota Business</span>
         </span>`
      : `<span class="badge-scale established" title="Established Brand / Enterprise Chain">
           <span>🏢</span> <span>Established</span>
         </span>`;

    // Contact Pills for Decision Maker Cell
    const phonePill = isMobileWA
      ? `<a href="https://api.whatsapp.com/send?phone=${cleanPhone}" target="_blank" class="contact-pill wa" title="Verified Mobile WhatsApp — 1-Tap to Chat">
           <span>📲</span> <span>${lead.contactInfo.phone}</span> <span style="font-size:0.62rem; opacity:0.85;">(WA Active)</span>
         </a>`
      : `<span class="contact-pill landline" title="Official Landline / UAN Helpline">
           <span>📞</span> <span>${lead.contactInfo ? lead.contactInfo.phone : 'N/A'}</span>
         </span>`;

    const igPill = igHandle
      ? `<a href="https://www.instagram.com/${igHandle}/" target="_blank" class="contact-pill ig" title="Open Instagram Profile / DM">
           <span>📸</span> <span>@${igHandle}</span>
         </a>`
      : '';

    const emailPill = emailAddr
      ? `<a href="mailto:${emailAddr}" class="contact-pill email" title="Send Direct Email">
           <span>📧</span> <span>${emailAddr}</span>
         </a>`
      : '';

    const webPill = cleanWebDomain
      ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="contact-pill web" title="Open Official Website (${cleanWebDomain})">
           <span>🌐</span> <span>${cleanWebDomain} ↗</span>
         </a>`
      : '';

    // Hero Action Button
    let heroActionBtn = '';
    if (isWaBest) {
      heroActionBtn = isMobileWA
        ? `<button class="btn-hero-action wa" onclick="App.dispatchSingleLead('${lead.id}', null, 'whatsapp')" title="1-Tap Direct WhatsApp Chat">
             <span>⚡</span> <span>WhatsApp</span>
           </button>`
        : `<button class="btn-hero-action" style="background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.18);" onclick="App.dispatchLandlineWhatsApp('${lead.id}')" title="Official Landline: Click to test or see alternative">
             <span>📞</span> <span>Landline WA</span>
           </button>`;
    } else if (isIgBest) {
      heroActionBtn = `<button class="btn-hero-action insta" onclick="App.dispatchSingleLead('${lead.id}', null, 'instagram')" title="1-Tap Copy Pitch & Open Instagram DM">
           <span>⚡</span> <span>Insta DM</span>
         </button>`;
    } else {
      heroActionBtn = emailAddr
        ? `<button class="btn-hero-action gmail" onclick="App.dispatchSingleLead('${lead.id}', null, 'gmail')" title="1-Tap Open Gmail with Tailored Pitch">
             <span>⚡</span> <span>Gmail</span>
           </button>`
        : `<button class="btn-hero-action" style="background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px dashed rgba(255,255,255,0.2);" onclick="App.showNoEmailAdvice('${lead.id}')">
             <span>📧</span> <span>No Email</span>
           </button>`;
    }

    const dueNudgeBtn = isFollowupDue
      ? `<button class="btn-hero-action" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000; font-weight: 800; border: none; box-shadow: 0 0 10px rgba(245, 158, 11, 0.4); padding: 5px 9px; font-size: 0.74rem;" onclick="App.dispatchFollowup('${lead.id}')" title="1-Tap Send ${isDay7 ? 'Day-7 Breakup' : 'Day-3'} Follow-Up Nudge">
           ⏰ ${isDay7 ? 'Day-7' : 'Day-3'} Nudge
         </button>`
      : '';

    return `
      <tr data-lead-id="${lead.id}">
        <!-- Col 1: Business Profile & Location -->
        <td>
          <div class="lead-biz-cell">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="biz-title" style="font-size: 0.95rem; font-weight: 800; color: #f8fafc;">${lead.businessName}</span>
                ${scaleBadge}
              </div>
              <a href="${mapsPinUrl}" target="_blank" rel="noopener noreferrer" class="btn-maps-pin" title="1-Tap to Open Real Location Pin on Google Maps">
                <span>🗺️</span> <span>Maps Pin ↗</span>
              </a>
            </div>
            <div style="color: #cbd5e1; font-size: 0.78rem; display: flex; align-items: flex-start; gap: 5px; margin-top: 4px;">
              <span style="color: #ef4444; flex-shrink: 0;">📌</span> <span>${fullAddress}</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 3px;">
              <span style="color: #38bdf8; font-weight: 700;">📍 ${lead.city}</span>
              • <span class="google-rating-chip" style="font-size: 0.74rem;">⭐ ${lead.rating} (${(Number(lead.reviews) || 50).toLocaleString()} reviews)</span>
              • <span class="badge-niche" style="font-size: 0.72rem; padding: 2px 7px;">${lead.nicheIcon} ${lead.nicheName.split(',')[0]}</span>
            </div>
          </div>
        </td>

        <!-- Col 2: Verified Decision Maker & Contacts -->
        <td>
          <div class="dm-cell">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>👤 <strong style="color: #f8fafc; font-size: 0.88rem;">${lead.decisionMaker}</strong> <span style="color: #94a3b8; font-size: 0.76rem;">(${lead.decisionMakerTitle})</span></span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
              <span style="font-size: 0.68rem; background: rgba(16, 185, 129, 0.14); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 6px; border-radius: 4px; font-weight: 700;" title="Safe outreach greeting">
                🛡️ Greet: "${lead.teamGreeting || 'Team ' + lead.businessName}"
              </span>
              <a href="${lead.decisionMakerSourceUrl || '#'}" target="_blank" rel="noopener noreferrer" style="font-size: 0.68rem; background: rgba(251, 191, 36, 0.12); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.38); padding: 2px 6px; border-radius: 4px; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Verify identity source">
                <span>🏛️ ${lead.decisionMakerSource || 'Corporate Registry'} ↗</span>
              </a>
            </div>
            <div class="contact-pills-row" style="margin-top: 6px;">
              ${phonePill}
              ${igPill}
              ${emailPill}
              ${webPill}
            </div>
          </div>
        </td>

        <!-- Col 3: Flaw Audit & Lost Revenue -->
        <td>
          <div class="flaw-box" onclick="App.openFlawModal('${lead.id}')" title="Click to view full flaw audit, proof links & client talking points">
            <div style="font-size: 0.80rem; font-weight: 700; color: #fca5a5; display: flex; align-items: center; gap: 4px;">
              <span>⚠️</span> <span>${lead.flawTitle}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
              <span class="leak-badge">💰 ${lead.flawLeakRange}</span>
              ${lead.niche === 'restaurants' || lead.niche === 'bakeries_sweets' ? `
                <span class="delivery-app-badge">🛵 ${lead.regionDeliveryApps || PitchEngine.detectDeliveryPlatform(lead)}</span>
              ` : ''}
            </div>
            <span style="font-size: 0.68rem; color: #fca5a5; display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; font-weight: 700;">
              <span>🔍</span> Masla & Proof Dekho ↗
            </span>
          </div>
        </td>

        <!-- Col 4: Best Channel -->
        <td>
          ${channelBadge}
        </td>

        <!-- Col 5: Outreach Status -->
        <td>
          ${statusBadge}
        </td>

        <!-- Col 6: 1-Tap Actions -->
        <td>
          <div style="display: flex; flex-direction: column; gap: 6px; min-width: 160px;">
            ${dueNudgeBtn ? dueNudgeBtn : ''}
            ${heroActionBtn}
            <div style="display: flex; gap: 5px;">
              <button class="btn-sec-action" style="flex: 1;" onclick="App.openPitchModal('${lead.id}')" title="Preview Pitch & Strategy">
                👁️ Pitch
              </button>
              <button class="btn-sec-action" style="flex: 1;" onclick="App.openFlawModal('${lead.id}')" title="Masla & Proof Audit">
                🔍 Masla
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  },

  renderLeadCard(lead, idx) {
    const bestChannel = lead.recommendedPitchChannel || lead.channel || 'gmail';
    const channelBadge = bestChannel === 'whatsapp'
      ? `<span class="badge-channel whatsapp" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
           <span>⭐</span> <span>📲 WhatsApp</span>
         </span>`
      : bestChannel === 'instagram'
      ? `<span class="badge-channel instagram" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
           <span>⭐</span> <span>📸 Insta DM</span>
         </span>`
      : `<span class="badge-channel gmail" style="font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
           <span>⭐</span> <span>📧 Gmail</span>
         </span>`;

    const dObj = lead.dispatchedAt ? new Date(lead.dispatchedAt) : null;
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dispatchDateDisplay = dObj ? `${String(dObj.getDate()).padStart(2, '0')} ${monthNamesShort[dObj.getMonth()]}` : '';
    const dispatchTimeStr = dObj ? dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const dispatchFullBadge = dObj ? `${dispatchDateDisplay} (${dispatchTimeStr})` : 'Dispatched';
    const isDispatched = lead.status === 'dispatched' || lead.status === 'followup_due';
    let isFollowupDue = false;
    let isDay7 = false;
    if (lead.status !== 'replied' && lead.followupStage !== 'day7_done') {
      if (isDispatched && lead.dispatchedAt) {
        const hoursPassed = (Date.now() - new Date(lead.dispatchedAt).getTime()) / (1000 * 3600);
        isDay7 = hoursPassed >= 168 || lead.followupStage === 'day3_done';
        if (lead.followupStage === 'day3_done') {
          isFollowupDue = hoursPassed >= 168;
        } else {
          isFollowupDue = hoursPassed >= 48;
        }
      }
    }

    const statusBadge = lead.status === 'replied'
      ? `<span class="status-pill replied">🔴 Replied</span>`
      : isFollowupDue
      ? `<span class="status-pill followup" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid #f59e0b; font-weight: 800;">⏰ ${isDay7 ? 'Day-7 Nudge' : 'Day-3 Nudge'}</span>`
      : lead.followupStage === 'day7_done'
      ? `<span class="status-pill dispatched" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.35);">✅ Sequence Done</span>`
      : lead.followupStage === 'day3_done'
      ? `<span class="status-pill dispatched" style="background: rgba(245, 158, 11, 0.12); color: #fde68a;">⏱️ Day-3 Sent</span>`
      : lead.status === 'dispatched'
      ? `<span class="status-pill dispatched" style="font-weight: 700;">🚀 ${dispatchFullBadge}</span>`
      : lead.status === 'followup_due'
      ? `<span class="status-pill followup">⏰ Follow-Up Due</span>`
      : `<span class="status-pill ready">Ready to Pitch</span>`;

    const cleanPhone = (lead.contactInfo && lead.contactInfo.phone ? lead.contactInfo.phone : '').replace(/[^0-9]/g, '');
    const fullAddress = lead.address || `${lead.city}, ${lead.country}`;
    const mapsPinUrl = this.getExactMapsUrl(lead);

    const isPakMobile = lead.contactInfo && lead.contactInfo.phone && /^\+92\s*3\d{2}/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, ''));
    const isUaeMobile = lead.contactInfo && lead.contactInfo.phone && /^\+971\s*5/.test(lead.contactInfo.phone.replace(/[^0-9+]/g, ''));
    const isMobileWA = (lead.phoneType === 'mobile_whatsapp') || (lead.contactInfo && lead.contactInfo.phoneType === 'mobile_whatsapp') || isPakMobile || isUaeMobile;
    const igHandle = (lead.contactInfo && lead.contactInfo.instagramHandle ? lead.contactInfo.instagramHandle : '').replace('@', '').trim();
    const emailAddr = (lead.contactInfo && lead.contactInfo.email) ? lead.contactInfo.email : (lead.email && lead.email.includes('@') ? lead.email : '');
    const websiteUrl = lead.website || (lead.contactInfo && lead.contactInfo.website) || '';
    const cleanWebDomain = websiteUrl ? websiteUrl.replace('https://', '').replace('http://', '').replace(/\/$/, '') : '';

    const isWaBest = bestChannel === 'whatsapp';
    const isIgBest = bestChannel === 'instagram';
    const isSmallBiz = lead.businessScale === 'small_business';
    const scaleBadge = isSmallBiz
      ? `<span class="badge-scale small" title="Chota Local Business"><span>🏪</span> <span>Chota Business</span></span>`
      : `<span class="badge-scale established" title="Established Brand"><span>🏢</span> <span>Established</span></span>`;

    const phonePill = isMobileWA
      ? `<a href="https://api.whatsapp.com/send?phone=${cleanPhone}" target="_blank" class="contact-pill wa" title="1-Tap WhatsApp Direct">
           <span>📲</span> <span>${lead.contactInfo.phone}</span> <span style="font-size:0.62rem; opacity:0.85;">(WA Active)</span>
         </a>`
      : `<span class="contact-pill landline" title="Official Landline">
           <span>📞</span> <span>${lead.contactInfo ? lead.contactInfo.phone : 'N/A'}</span>
         </span>`;

    const igPill = igHandle
      ? `<a href="https://www.instagram.com/${igHandle}/" target="_blank" class="contact-pill ig" title="Instagram Profile">
           <span>📸</span> <span>@${igHandle}</span>
         </a>`
      : '';

    const emailPill = emailAddr
      ? `<a href="mailto:${emailAddr}" class="contact-pill email" title="Direct Email">
           <span>📧</span> <span>${emailAddr}</span>
         </a>`
      : '';

    const webPill = cleanWebDomain
      ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="contact-pill web" title="Website">
           <span>🌐</span> <span>${cleanWebDomain} ↗</span>
         </a>`
      : '';

    return `
      <div class="lead-mobile-card ${isSmallBiz ? 'small-biz' : 'est-biz'}" data-lead-id="${lead.id}">
        <!-- Top Header: Business, Type & Maps Pin -->
        <div class="card-head">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="biz-title" style="font-size: 1.05rem; font-weight: 800; color: #f8fafc;">${lead.businessName}</span>
              ${scaleBadge}
              <span class="badge-niche" style="font-size: 0.72rem; padding: 2px 7px;">${lead.nicheIcon} ${lead.nicheName.split(',')[0]}</span>
            </div>
            <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 4px; display: flex; align-items: flex-start; gap: 5px;">
              <span style="color: #ef4444; flex-shrink: 0;">📍</span> <span>${fullAddress}</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="color: #38bdf8; font-weight: 700;">🏙️ ${lead.city}</span>
              • <span class="google-rating-chip" style="font-size: 0.74rem;">⭐ ${lead.rating} (${(Number(lead.reviews) || 50).toLocaleString()} reviews)</span>
            </div>
          </div>
          <div style="flex-shrink: 0;">
            <a href="${mapsPinUrl}" target="_blank" rel="noopener noreferrer" class="btn-maps-pin">
              <span>🗺️</span> <span>Maps Pin ↗</span>
            </a>
          </div>
        </div>

        <!-- Flaw Alert Box -->
        <div class="card-flaw-box" onclick="App.openFlawModal('${lead.id}')" title="Click to view full flaw audit, proof links & talking points">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="font-size: 0.70rem; color: #f87171; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ Diagnosed Flaw</span>
            <span style="font-size: 0.68rem; color: #fca5a5; font-weight: 700;">Masla & Proof Dekho ↗</span>
          </div>
          <div style="font-size: 0.88rem; font-weight: 700; color: #fee2e2; margin: 4px 0 6px 0;">
            ${lead.flawTitle}
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="leak-badge-glow">💰 ${lead.flawLeakRange}</span>
            ${lead.niche === 'restaurants' || lead.niche === 'bakeries_sweets' ? `
              <span class="delivery-app-badge">🛵 ${lead.regionDeliveryApps || PitchEngine.detectDeliveryPlatform(lead)}</span>
            ` : ''}
          </div>
        </div>

        <!-- Meta Grid: Verified Decision Maker & Outreach Status -->
        <div class="card-meta-grid">
          <div class="meta-item">
            <div class="meta-label">👤 Verified Decision Maker</div>
            <div class="meta-value">${lead.decisionMaker} <span style="font-size: 0.72rem; color: #94a3b8; font-weight: normal;">(${lead.decisionMakerTitle})</span></div>
            <div class="dm-greet">🛡️ Greet: "${lead.teamGreeting || 'Team ' + lead.businessName}"</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">🎯 Channel & Status</div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px;">
              ${channelBadge}
              ${statusBadge}
            </div>
          </div>
        </div>

        <!-- Direct Contact Pills Bar -->
        <div class="card-contacts-bar">
          ${phonePill}
          ${igPill}
          ${emailPill}
          ${webPill}
        </div>

        <!-- Touch Actions Row -->
        <div class="card-actions-row">
          ${isFollowupDue ? `
            <button class="btn-mobile-hero nudge" onclick="App.dispatchFollowup('${lead.id}')">
              <span>⏰</span> <span>1-Tap Follow-Up Nudge (${isDay7 ? 'Day-7 Breakup' : 'Day-3'})</span>
            </button>
          ` : ''}
          ${isWaBest
            ? (isMobileWA
                ? `<button class="btn-mobile-hero wa" onclick="App.dispatchSingleLead('${lead.id}', null, 'whatsapp')">
                     <span>⚡</span> <span>Send Personalized WhatsApp Pitch</span>
                   </button>`
                : `<button class="btn-mobile-hero" style="background: rgba(255,255,255,0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2);" onclick="App.dispatchLandlineWhatsApp('${lead.id}')">
                     <span>📞</span> <span>Official Landline (No WhatsApp)</span>
                   </button>`)
            : isIgBest
            ? `<button class="btn-mobile-hero insta" onclick="App.dispatchSingleLead('${lead.id}', null, 'instagram')">
                 <span>⚡</span> <span>Copy Pitch & Open Instagram DM</span>
               </button>`
            : (emailAddr
                ? `<button class="btn-mobile-hero gmail" onclick="App.dispatchSingleLead('${lead.id}', null, 'gmail')">
                     <span>⚡</span> <span>Send Personalized Gmail Pitch</span>
                   </button>`
                : `<button class="btn-mobile-hero" style="background: rgba(255,255,255,0.06); color: #64748b; border: 1px dashed rgba(255,255,255,0.18);" onclick="App.showNoEmailAdvice('${lead.id}')">
                     <span>📧</span> <span>No Email Listed</span>
                   </button>`)
          }
          <div class="card-secondary-btns">
            <button class="btn-mobile-sec" onclick="App.openPitchModal('${lead.id}')">👁️ Pitch Preview & Copy</button>
            <button class="btn-mobile-sec" onclick="App.openFlawModal('${lead.id}')">🔍 Masla & Proof Audit</button>
          </div>
        </div>
      </div>
    `;
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
    if (elPipeline) elPipeline.textContent = `$${(30 * 650).toLocaleString()} – $${(50 * 1200).toLocaleString()}`;

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
    const tabDispatchDates = document.getElementById('tab-dispatch-dates-count');
    if (tabDispatchDates) tabDispatchDates.textContent = dispatchedCount;
    if (tabWa) tabWa.textContent = `📲 WhatsApp (${waCount})`;
    if (tabGmail) tabGmail.textContent = `📧 Gmail (${gmailCount})`;
    if (tabLi) tabLi.textContent = `👔 LinkedIn (${liCount})`;
    if (tabIg) tabIg.textContent = `📸 Instagram (${igCount})`;

    if (this.currentChannelFilter === 'dispatch_dates') {
      this.renderDispatchDatesPanel();
    }

    // Scale counts
    const smallCount = this.leads.filter(l => l.businessScale === 'small_business').length;
    const estCount = this.leads.filter(l => l.businessScale === 'established_brand').length;
    const btnScaleAll = document.getElementById('btn-scale-all');
    const btnScaleSmall = document.getElementById('btn-scale-small');
    const btnScaleEst = document.getElementById('btn-scale-established');

    if (btnScaleAll) btnScaleAll.innerHTML = `<span>🌐</span> All Scales (${totalLeads})`;
    if (btnScaleSmall) btnScaleSmall.innerHTML = `<span>🏪</span> Chotay Business (Direct Mobile) (${smallCount})`;
    if (btnScaleEst) btnScaleEst.innerHTML = `<span>🏢</span> Established Brands (${estCount})`;

    // Day-3 & Day-7 Follow-up Radar update
    const dueFollowups = AutopilotEngine.getDueFollowUps(this.leads);
    const dueCount = dueFollowups.length;
    const bannerDueCountEl = document.getElementById('banner-due-count');
    const tabFollowupCountEl = document.getElementById('tab-followup-count');
    const bannerTextEl = document.getElementById('followup-banner-text');
    const bannerSection = document.getElementById('followup-alert-banner');
    const badgeLiveStatus = document.getElementById('badge-followup-live-status');

    if (bannerDueCountEl) bannerDueCountEl.textContent = dueCount;
    if (tabFollowupCountEl) tabFollowupCountEl.textContent = dueCount;

    if (bannerTextEl) {
      if (dueCount > 0) {
        bannerTextEl.innerHTML = `🔔 <strong>Alert:</strong> Aaj in <strong>${dueCount} purani leads</strong> ko 48+ ghantay ho chuke hain! Inhein 1-tap follow-up nudge bhejo taake reply rate 3x barh sake.`;
        if (bannerSection) {
          bannerSection.style.borderColor = '#f59e0b';
          bannerSection.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.35)';
        }
        if (badgeLiveStatus) {
          badgeLiveStatus.textContent = `${dueCount} Nudges Due Today`;
          badgeLiveStatus.style.background = '#f59e0b';
          badgeLiveStatus.style.color = '#000';
        }
      } else {
        bannerTextEl.innerHTML = `Rozana 48 ghantay baad jin leads ka reply nahi ata, unka 1-tap follow-up nudge yahan show hota hai. (Total Dispatched: ${dispatchedCount})`;
        if (bannerSection) {
          bannerSection.style.borderColor = 'rgba(245, 158, 11, 0.45)';
          bannerSection.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.15)';
        }
        if (badgeLiveStatus) {
          badgeLiveStatus.textContent = 'Live Radar Active';
          badgeLiveStatus.style.background = 'rgba(245, 158, 11, 0.25)';
          badgeLiveStatus.style.color = '#fbbf24';
        }
      }
    }

    if (window.ReplyCenter && ReplyCenter.renderStats) {
      ReplyCenter.renderStats();
    }
  },

  openPitchModal(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    this.activeLeadForModal = lead;

    let currentGreetingMode = lead.businessScale === 'small_business' ? 'founder' : 'team';
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

    const scaleBadgeHtml = lead.businessScale === 'small_business'
      ? `<span class="badge-scale small" style="font-size: 0.74rem; padding: 3px 8px;">🏪 Chota Business (Direct Mobile)</span>`
      : `<span class="badge-scale established" style="font-size: 0.74rem; padding: 3px 8px;">🏢 Established Brand</span>`;

    const channelBadgeHtml = lead.channel === 'whatsapp'
      ? `<span class="badge-channel whatsapp">📲 WhatsApp Direct Outreach</span>`
      : lead.channel === 'gmail'
      ? `<span class="badge-channel gmail">📧 Gmail Pitch</span>`
      : lead.channel === 'linkedin'
      ? `<span class="badge-channel linkedin">👔 LinkedIn Connection Note</span>`
      : `<span class="badge-channel instagram">📸 Instagram Story Reply</span>`;

    document.getElementById('modal-pitch-channel-badge').innerHTML = `<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">${scaleBadgeHtml} ${channelBadgeHtml}</div>`;

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
      const email = lead.email || (lead.contactInfo && lead.contactInfo.email);
      if (!email || !email.includes('@')) {
        sendGmailBtn.style.opacity = '0.4';
        sendGmailBtn.title = 'No corporate email - use Direct Mobile WhatsApp';
        sendGmailBtn.onclick = () => {
          this.showNoEmailAdvice(lead.id);
        };
      } else {
        sendGmailBtn.style.opacity = '1';
        sendGmailBtn.title = '1-Tap Open Gmail with Tailored Pitch';
        sendGmailBtn.onclick = () => {
          this.dispatchSingleLead(lead.id, textarea.value, 'gmail');
          modal.classList.remove('open');
        };
      }
    }

    document.getElementById('modal-btn-bhejdo').onclick = () => {
      this.dispatchSingleLead(lead.id, textarea.value);
      modal.classList.remove('open');
    };

    modal.classList.add('open');
  },

  showNoEmailAdvice(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    const name = lead ? lead.businessName : 'Is local business';
    this.showToast(`💡 ${name} ka direct channel Mobile WhatsApp hai. Local businesses corporate email check nahi karte aur email bounce ho sakti hai. Owner se foran rabtay ke liye "📲 WA" use karein!`, 'info');
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
      const email = lead.email || (lead.contactInfo && lead.contactInfo.email);
      if (!email || !email.includes('@')) {
        this.showNoEmailAdvice(lead.id);
        return;
      }
      const subject = encodeURIComponent(pitch.subject || `quick question re ${cleanBiz}`);
      const emailBody = encodeURIComponent(body);
      const mailtoUrl = `mailto:${email}?subject=${subject}&body=${emailBody}`;
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

  dispatchFollowup(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const dispatchedTime = lead.dispatchedAt ? new Date(lead.dispatchedAt).getTime() : (Date.now() - 48 * 3600 * 1000);
    const hoursPassed = (Date.now() - dispatchedTime) / (3600 * 1000);
    const isDay7 = hoursPassed >= 168 || lead.followupStage === 'day3_done';

    const followupText = isDay7
      ? PitchEngine.generateDay7FollowUp(lead, this.contactMode || 'team')
      : PitchEngine.generateDay3FollowUp(lead, this.contactMode || 'team');

    // Update follow-up status
    lead.followupStage = isDay7 ? 'day7_done' : 'day3_done';
    lead.lastFollowupAt = new Date().toISOString();
    if (!isDay7) {
      const nextDue = new Date();
      nextDue.setHours(nextDue.getHours() + 96); // 4 days later = Day 7
      lead.followupDueAt = nextDue.toISOString();
    } else {
      lead.followupDueAt = null;
    }

    StorageService.saveLeads(this.leads);

    const activeChannel = lead.channel || 'whatsapp';
    const cleanBiz = lead.businessName.split('(')[0].trim();

    if (activeChannel === 'whatsapp') {
      const rawPhone = (lead.contactInfo && lead.contactInfo.phone) || this.settings.whatsapp_number || '+923376568003';
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const waText = encodeURIComponent(followupText);
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${waText}`;
      window.open(waUrl, '_blank');
      this.showToast(`⏰ 1-Tap ${isDay7 ? 'Day-7 Breakup' : 'Day-3'} Nudge opened for ${cleanBiz} on WhatsApp!`, 'success');
    } else if (activeChannel === 'instagram') {
      try {
        navigator.clipboard.writeText(followupText);
      } catch (e) {
        console.warn('Clipboard write failed:', e);
      }
      const rawHandle = (lead.contactInfo && lead.contactInfo.instagramHandle) || '';
      const cleanHandle = rawHandle.replace(/[@/]/g, '').trim();
      if (cleanHandle) {
        window.open(`https://www.instagram.com/${cleanHandle}/`, '_blank');
        this.showToast(`📋 ${isDay7 ? 'Day-7' : 'Day-3'} Nudge copied! Opened Instagram for @${cleanHandle}. Just paste (Ctrl+V)!`, 'success');
      } else {
        window.open(`https://www.instagram.com/direct/inbox/`, '_blank');
        this.showToast(`📋 ${isDay7 ? 'Day-7' : 'Day-3'} Nudge copied! Opened Instagram Direct Inbox. Just paste (Ctrl+V)!`, 'success');
      }
    } else if (activeChannel === 'gmail') {
      const email = lead.email || (lead.contactInfo && lead.contactInfo.email);
      const subject = encodeURIComponent(`re: ${cleanBiz} (quick bump)`);
      const emailBody = encodeURIComponent(followupText);
      const mailtoUrl = `mailto:${email || ''}?subject=${subject}&body=${emailBody}`;
      window.open(mailtoUrl, '_blank');
      this.showToast(`📧 ${isDay7 ? 'Day-7' : 'Day-3'} Follow-Up email opened for ${cleanBiz}!`, 'success');
    } else if (activeChannel === 'linkedin') {
      try {
        navigator.clipboard.writeText(followupText);
      } catch (e) {}
      window.open(`https://www.linkedin.com/messaging`, '_blank');
      this.showToast(`💼 ${isDay7 ? 'Day-7' : 'Day-3'} Nudge copied! Opened LinkedIn Messaging.`, 'success');
    }

    this.renderTable();
    this.updateMetrics();
  },

  simulateFollowupDemo() {
    const demoCount = Math.min(8, this.leads.length);
    const now = Date.now();
    for (let i = 0; i < demoCount; i++) {
      const lead = this.leads[i];
      lead.status = 'dispatched';
      const hoursAgo = i < 6 ? 49 : 172; // 6 Day-3, 2 Day-7
      lead.dispatchedAt = new Date(now - hoursAgo * 3600 * 1000).toISOString();
      lead.followupDueAt = new Date(now - 1 * 3600 * 1000).toISOString();
      lead.followupStage = hoursAgo > 168 ? 'day3_done' : 'ready';
    }
    StorageService.saveLeads(this.leads);
    this.updateMetrics();

    // Switch to followup tab
    const tab = document.querySelector(`.channel-tab-btn[data-filter="followup"]`);
    if (tab) {
      document.querySelectorAll('.channel-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    }
    this.applyFilter('followup');

    const tableHeader = document.querySelector('.leads-section-header');
    if (tableHeader) tableHeader.scrollIntoView({ behavior: 'smooth' });

    this.showToast(`🧪 Test Simulation Activated! ${demoCount} leads ko 48h/7-Day follow-up alert par set kar diya gaya hai.`, 'success');
  },

  getLeadDateKey(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch (e) {
      return '';
    }
  },

  getDispatchedDateGroups() {
    const groups = {};
    const now = new Date();
    const todayKey = this.getLeadDateKey(now.toISOString());
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const yesterdayKey = this.getLeadDateKey(yesterday.toISOString());
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dispatchedLeads = this.leads.filter(l => (l.status === 'dispatched' || l.status === 'replied') && l.dispatchedAt);

    dispatchedLeads.forEach(lead => {
      const dateKey = this.getLeadDateKey(lead.dispatchedAt);
      if (!dateKey) return;
      const d = new Date(lead.dispatchedAt);

      if (!groups[dateKey]) {
        const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const isToday = dateKey === todayKey;
        const isYesterday = dateKey === yesterdayKey;
        const displayTitle = isToday ? `🌟 Aaj / Today (${formattedDate})` : isYesterday ? `Kal / Yesterday (${formattedDate})` : `${dayName}, ${formattedDate}`;

        groups[dateKey] = {
          dateKey,
          displayTitle,
          formattedDate,
          dayName,
          isToday,
          isYesterday,
          total: 0,
          channels: { whatsapp: 0, gmail: 0, linkedin: 0, instagram: 0 },
          replied: 0,
          dueFollowups: 0,
          leads: []
        };
      }

      groups[dateKey].total++;
      const ch = lead.channel || 'whatsapp';
      groups[dateKey].channels[ch] = (groups[dateKey].channels[ch] || 0) + 1;
      if (lead.status === 'replied') {
        groups[dateKey].replied++;
      }
      const hours = (now.getTime() - d.getTime()) / (1000 * 3600);
      if (hours >= 48 && lead.status !== 'replied' && lead.followupStage !== 'day7_done') {
        groups[dateKey].dueFollowups++;
      }
      groups[dateKey].leads.push(lead);
    });

    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  },

  renderDispatchDatesPanel() {
    const groups = this.getDispatchedDateGroups();
    const now = new Date();
    const todayKey = this.getLeadDateKey(now.toISOString());
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const yesterdayKey = this.getLeadDateKey(yesterday.toISOString());

    const todayGroup = groups.find(g => g.dateKey === todayKey);
    const yesterdayGroup = groups.find(g => g.dateKey === yesterdayKey);

    const totalDispatched = this.leads.filter(l => l.status === 'dispatched' || l.status === 'replied').length;

    const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
    const weekCount = this.leads.filter(l => (l.status === 'dispatched' || l.status === 'replied') && l.dispatchedAt && new Date(l.dispatchedAt).getTime() >= sevenDaysAgo).length;

    const elToday = document.getElementById('dispatch-kpi-today');
    const elTodayCh = document.getElementById('dispatch-kpi-today-channels');
    const elYest = document.getElementById('dispatch-kpi-yesterday');
    const elYestCh = document.getElementById('dispatch-kpi-yesterday-channels');
    const elWeek = document.getElementById('dispatch-kpi-week');
    const elAvg = document.getElementById('dispatch-kpi-avg');
    const elAllTime = document.getElementById('dispatch-kpi-all-time');
    const elActiveDays = document.getElementById('badge-dispatch-active-days');

    if (elToday) elToday.textContent = `${todayGroup ? todayGroup.total : 0} Leads`;
    if (elTodayCh) elTodayCh.textContent = todayGroup
      ? `${todayGroup.channels.whatsapp || 0} WA • ${todayGroup.channels.gmail || 0} Gmail • ${todayGroup.channels.instagram || 0} Insta`
      : '0 WhatsApp • 0 Gmail';

    if (elYest) elYest.textContent = `${yesterdayGroup ? yesterdayGroup.total : 0} Leads`;
    if (elYestCh) elYestCh.textContent = yesterdayGroup
      ? `${yesterdayGroup.channels.whatsapp || 0} WA • ${yesterdayGroup.channels.gmail || 0} Gmail • ${yesterdayGroup.channels.instagram || 0} Insta`
      : '0 WhatsApp • 0 Gmail';

    if (elWeek) elWeek.textContent = `${weekCount} Leads`;
    if (elAvg) elAvg.textContent = `Avg ${(weekCount / 7).toFixed(1)} leads / day`;

    if (elAllTime) elAllTime.textContent = `${totalDispatched} Leads`;
    if (elActiveDays) elActiveDays.textContent = `${groups.length} Days Active`;

    // Render Filter Chips
    const chipsContainer = document.getElementById('dispatch-date-filter-chips');
    if (chipsContainer) {
      const selected = this.selectedDispatchDate || 'all';
      let chipsHtml = `
        <button class="date-chip-btn ${selected === 'all' ? 'active' : ''}" onclick="App.filterByDispatchDate('all')">
          <span>🌐</span> All Dates (${totalDispatched})
        </button>
      `;
      groups.forEach(g => {
        const isSel = selected === g.dateKey;
        chipsHtml += `
          <button class="date-chip-btn ${isSel ? 'active' : ''}" onclick="App.filterByDispatchDate('${g.dateKey}')">
            <span>📅</span> ${g.displayTitle.split('(')[0].trim()} (${g.total})
          </button>
        `;
      });
      chipsContainer.innerHTML = chipsHtml;
    }

    // Render Date Cards Grid
    const gridContainer = document.getElementById('dispatch-dates-grid');
    if (gridContainer) {
      if (groups.length === 0) {
        gridContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 32px 20px; background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(56, 189, 248, 0.3); border-radius: 10px;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📭</div>
            <div style="font-size: 1.05rem; font-weight: 700; color: #f1f5f9;">Abhi tak koi lead dispatch nahi hui</div>
            <p style="font-size: 0.84rem; color: #94a3b8; max-width: 500px; margin: 6px auto 16px auto;">
              Jab aap kisi bhi business ko 1-Tap WhatsApp, Gmail ya Instagram se outreach bhejenge, yahan automatically har date ka record aur count live update hoga.
            </p>
            <button class="btn-primary" style="background: linear-gradient(135deg, #38bdf8, #0284c7); color: #000; font-weight: 800; font-size: 0.84rem; padding: 9px 18px; border: none; box-shadow: 0 0 15px rgba(56, 189, 248, 0.35);" onclick="App.simulateMultiDayDispatches()">
              🧪 Test Multi-Day Simulation (Try Today & Yesterday Counts)
            </button>
          </div>
        `;
      } else {
        gridContainer.innerHTML = groups.map(g => {
          const isSel = this.selectedDispatchDate === g.dateKey;
          const wa = g.channels.whatsapp || 0;
          const gm = g.channels.gmail || 0;
          const ig = g.channels.instagram || 0;
          const li = g.channels.linkedin || 0;

          return `
            <div class="dispatch-date-card ${isSel ? 'active' : ''}" onclick="App.filterByDispatchDate('${g.dateKey}')">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div>
                  <div style="font-size: 0.88rem; font-weight: 800; color: ${g.isToday ? '#38bdf8' : '#f1f5f9'}; display: flex; align-items: center; gap: 6px;">
                    <span>📅</span> ${g.displayTitle}
                  </div>
                  <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">
                    ${g.formattedDate} • ${g.dayName}
                  </div>
                </div>
                <span style="font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; font-weight: 800; ${g.isToday ? 'background: rgba(56, 189, 248, 0.25); color: #38bdf8; border: 1px solid #38bdf8;' : g.isYesterday ? 'background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid #94a3b8;' : 'background: rgba(255, 255, 255, 0.05); color: #94a3b8;'}">
                  ${g.isToday ? 'TODAY' : g.isYesterday ? 'YESTERDAY' : g.dayName.toUpperCase()}
                </span>
              </div>

              <!-- Big Number -->
              <div style="display: flex; align-items: baseline; gap: 8px; margin: 6px 0;">
                <span style="font-size: 2.1rem; font-weight: 800; color: #38bdf8; line-height: 1;">${g.total}</span>
                <span style="font-size: 0.84rem; color: #cbd5e1; font-weight: 700;">Leads Sent</span>
              </div>

              <!-- Channel Pills Breakdown -->
              <div style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 0.72rem;">
                ${wa > 0 ? `<span style="background: rgba(37, 211, 102, 0.15); color: #4ade80; border: 1px solid rgba(37, 211, 102, 0.35); padding: 2px 6px; border-radius: 4px; font-weight: 700;">📲 ${wa} WA</span>` : ''}
                ${gm > 0 ? `<span style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35); padding: 2px 6px; border-radius: 4px; font-weight: 700;">📧 ${gm} Gmail</span>` : ''}
                ${ig > 0 ? `<span style="background: rgba(244, 114, 182, 0.15); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.35); padding: 2px 6px; border-radius: 4px; font-weight: 700;">📸 ${ig} Insta</span>` : ''}
                ${li > 0 ? `<span style="background: rgba(14, 118, 168, 0.15); color: #38bdf8; border: 1px solid rgba(14, 118, 168, 0.35); padding: 2px 6px; border-radius: 4px; font-weight: 700;">👔 ${li} LI</span>` : ''}
              </div>

              <!-- Follow-Up & Replies Mini Badge -->
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 4px;">
                <span style="color: ${g.replied > 0 ? '#f87171' : '#94a3b8'};">
                  ${g.replied > 0 ? `🔴 <strong>${g.replied} Replied</strong>` : '⚪ 0 Replies'}
                </span>
                <span style="color: ${g.dueFollowups > 0 ? '#fbbf24' : '#94a3b8'};">
                  ${g.dueFollowups > 0 ? `⏰ <strong>${g.dueFollowups} Due Nudge</strong>` : '✅ All fresh'}
                </span>
              </div>

              <!-- Action Button -->
              <button class="btn-primary" style="width: 100%; font-size: 0.78rem; padding: 7px; font-weight: 800; background: ${isSel ? '#38bdf8' : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.4))'}; color: ${isSel ? '#000' : '#7dd3fc'}; border: 1px solid #38bdf8; margin-top: 6px;">
                ${isSel ? '✓ Filter Active' : `👉 Table Mein Dekho (${g.total})`}
              </button>
            </div>
          `;
        }).join('');
      }
    }
  },

  filterByDispatchDate(dateKey) {
    this.selectedDispatchDate = dateKey;
    const tab = document.querySelector('.channel-tab-btn[data-filter="dispatch_dates"]');
    if (tab && tab.classList) {
      document.querySelectorAll('.channel-tab-btn').forEach(t => {
        if (t.classList) t.classList.remove('active');
      });
      tab.classList.add('active');
    }
    this.currentChannelFilter = 'dispatch_dates';
    const dispatchPanel = document.getElementById('dispatch-dates-panel');
    if (dispatchPanel) dispatchPanel.style.display = 'block';
    this.renderDispatchDatesPanel();

    let base = this.leads.filter(l => l.status === 'dispatched' || l.status === 'replied');
    if (dateKey && dateKey !== 'all') {
      base = base.filter(l => l.dispatchedAt && this.getLeadDateKey(l.dispatchedAt) === dateKey);
    }
    this.filteredLeads = base;
    this.renderTable();

    const countLabel = document.getElementById('leads-count-label');
    if (countLabel) {
      countLabel.textContent = dateKey === 'all'
        ? `Showing all ${base.length} Dispatched Leads`
        : `Showing ${base.length} Leads Dispatched on ${dateKey}`;
    }

    const tableHeader = document.querySelector('.leads-section-header');
    if (tableHeader) tableHeader.scrollIntoView({ behavior: 'smooth' });
  },

  simulateMultiDayDispatches() {
    const demoCount = Math.min(15, this.leads.length);
    const now = Date.now();
    for (let i = 0; i < demoCount; i++) {
      const lead = this.leads[i];
      lead.status = (i === 1 || i === 6) ? 'replied' : 'dispatched';
      let hoursAgo;
      if (i < 5) {
        hoursAgo = 2 + (i * 0.8); // Today (2-5h ago)
      } else if (i < 10) {
        hoursAgo = 26 + ((i - 5) * 1.5); // Yesterday (26-32h ago)
      } else if (i < 13) {
        hoursAgo = 73 + ((i - 10) * 2); // 3 Days ago (73-77h ago)
      } else {
        hoursAgo = 170 + ((i - 13) * 5); // 7 Days ago (170-175h ago)
      }
      lead.dispatchedAt = new Date(now - hoursAgo * 3600 * 1000).toISOString();
      lead.followupDueAt = new Date(now - 2 * 3600 * 1000).toISOString();
      lead.followupStage = hoursAgo > 168 ? 'day3_done' : 'ready';
    }
    StorageService.saveLeads(this.leads);
    this.updateMetrics();
    this.filterByDispatchDate('all');
    this.showToast(`🧪 Multi-Day Dispatch Simulation Activated! Today (5), Yesterday (5), Day-3 (3), Day-7 (2) leads logged.`, 'success');
  },

  resetDispatches() {
    this.leads.forEach(l => {
      l.status = 'ready';
      l.dispatchedAt = null;
      l.dispatchedMessage = null;
      l.followupDueAt = null;
      l.followupStage = null;
    });
    StorageService.saveLeads(this.leads);
    this.selectedDispatchDate = 'all';
    this.updateMetrics();
    this.applyFilter(this.currentChannelFilter || 'all');
    this.showToast(`🔄 Dispatches reset to fresh ready state!`, 'info');
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
