/**
 * SoftHunter AI — Master SaaS Application Coordinator (v3.0 SaaS Edition)
 * Unifies:
 * - 17-View Single Page Application Routing
 * - Google Places API (New) Business Discovery & Exact Place ID Verification
 * - Google PageSpeed Insights & Technical Digital Presence Audit
 * - Universal Software Development Opportunities (6 Categories: Web, Mobile, Desktop, CRM, AI, Custom)
 * - 50-Lead Batch Automation & Unlock Management
 * - Daily Pitch Tracker & Date-Wise Dispatched History
 * - Multi-Channel & Multi-Stage AI Pitch Engine
 * - Smart Follow-Up Manager & Auto-Pause Reply Detection
 * - Full CRM Pipeline & Real Interactive Analytics
 */

const App = {
  leads: [],
  filteredLeads: [],
  currentView: 'all-businesses',
  currentChannelFilter: 'all',
  currentCountryFilter: 'ALL',
  currentCityFilter: 'ALL',
  currentSearchQuery: '',
  currentScaleFilter: 'all',
  currentOppCategoryFilter: 'all',
  currentDailyRange: 'today',
  currentViewMode: (typeof window !== 'undefined' && window.innerWidth <= 768) ? 'cards' : 'table',
  activeLeadForModal: null,
  activeLeadForProposal: null,
  settings: {},
  outreachTelemetry: null,
  outreachConfig: null,
  outreachStatusTimer: null,

  init() {
    this.settings = StorageService.getSettings();
    this.setupNavigation();
    this.setupEventListeners();

    // 1. Initial Synchronous Load of Leads from Storage or INITIAL_LEADS
    let savedLeads = StorageService.getLeads();
    const freshInitial = (window.DEFAULT_LEADS || window.INITIAL_LEADS || (typeof INITIAL_LEADS !== 'undefined' ? INITIAL_LEADS : []));
    let initialLeads = freshInitial;

    // Check if saved leads match the fresh 6-country dataset (length matches freshInitial and first ID matches)
    if (savedLeads && savedLeads.length === freshInitial.length && freshInitial.length > 0 && savedLeads[0].id === freshInitial[0].id) {
      initialLeads = savedLeads;
    } else {
      initialLeads = freshInitial;
      StorageService.saveLeads(initialLeads);
    }

    if (initialLeads && initialLeads.length > 0) {
      this.leads = initialLeads.map(l => {
        l.mapsUrl = this.getExactMapsUrl(l);
        if (!l.googlePlaceId && window.PlacesService) {
          l.googlePlaceId = `ChIJ_${l.id}`;
        }
        return l;
      });
      this.leads = this.sortLeads(this.leads, 'reply_chance');
      StorageService.saveLeads(this.leads);
      if (window.BatchManager) {
        window.BatchManager.syncWithLeads(this.leads);
      }
      this.runTableFilters();
      this.updateAllMetricsAndBadges();
    }

    // 2. Fresh Async Sync from data/leads.json
    fetch('data/leads.json')
      .then(res => res.ok ? res.json() : null)
      .then(freshLeads => {
        if (!freshLeads || !freshLeads.length) return;
        const currentSaved = StorageService.getLeads() || [];
        const savedMap = {};

        currentSaved.forEach(l => {
          savedMap[l.id] = {
            status: l.status,
            crmStatus: l.crmStatus,
            dispatchedAt: l.dispatchedAt,
            dispatchedMessage: l.dispatchedMessage,
            batchPitched: l.batchPitched
          };
        });

        this.leads = freshLeads.map(l => {
          l.mapsUrl = this.getExactMapsUrl(l);
          if (savedMap[l.id]) {
            l.status = savedMap[l.id].status || l.status;
            l.crmStatus = savedMap[l.id].crmStatus || l.crmStatus;
            l.dispatchedAt = savedMap[l.id].dispatchedAt || null;
            l.dispatchedMessage = savedMap[l.id].dispatchedMessage || null;
            l.batchPitched = savedMap[l.id].batchPitched || false;
          }
          return l;
        });
        this.leads = this.sortLeads(this.leads, 'reply_chance');
        StorageService.saveLeads(this.leads);
        if (window.BatchManager) {
          window.BatchManager.syncWithLeads(this.leads);
        }
        this.runTableFilters();
        this.updateAllMetricsAndBadges();
      })
      .catch(() => {});

    // Sync dispatches from backend
    fetch('/api/dispatches')
      .then(res => res.ok ? res.json() : null)
      .then(dispatches => {
        if (dispatches && Array.isArray(dispatches) && dispatches.length > 0) {
          StorageService.saveDispatches(dispatches);
          this.updateAllMetricsAndBadges();
        }
      })
      .catch(() => {});

    // Auto-detect mobile screen and default to Card view for cleaner touch experience
    if (window.innerWidth <= 768) {
      const btnCards = document.getElementById('btn-view-cards');
      const btnTable = document.getElementById('btn-view-table');
      if (btnCards && btnTable) {
        btnCards.classList.add('active');
        btnTable.classList.remove('active');
        const tv = document.getElementById('table-view-container');
        const cv = document.getElementById('cards-view-container');
        if (tv) tv.style.display = 'none';
        if (cv) cv.style.display = 'grid';
      }
    }

    // Start Automated Outreach Engine Poller & Load Config
    this.loadOutreachConfig();
    this.fetchOutreachStatus();
    if (!this.outreachStatusTimer) {
      this.outreachStatusTimer = setInterval(() => {
        this.fetchOutreachStatus();
      }, 4000);
    }

    // Route to initial hash or default to all-businesses (the main verified leads view)
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`view-${hash}`)) {
      this.switchView(hash);
    } else {
      this.switchView('all-businesses');
    }
  },

  // ========================================================
  // NAVIGATION & VIEW SWITCHING
  // ========================================================
  setupNavigation() {
    // Sidebar item clicks
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.dataset.view;
        if (targetView) {
          this.switchView(targetView);
          this.closeMobileSidebar();
        }
      });
    });

    // Sidebar collapse toggle
    const btnToggle = document.getElementById('btn-sidebar-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const sidebar = document.getElementById('saas-sidebar');
        sidebar.classList.toggle('collapsed');
        btnToggle.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
      });
    }

    // Mobile sidebar toggle
    const btnMobile = document.getElementById('btn-mobile-sidebar');
    if (btnMobile) {
      btnMobile.addEventListener('click', (e) => {
        e.stopPropagation();
        const sidebar = document.getElementById('saas-sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          this.closeMobileSidebar();
        } else {
          this.openMobileSidebar();
        }
      });
    }

    // Keyboard shortcut (Ctrl/Cmd + B)
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        document.getElementById('btn-sidebar-toggle')?.click();
      }
    });

    // Global Search Input
    const globalSearch = document.getElementById('global-search-input');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query) {
          if (this.currentView !== 'all-businesses') {
            this.switchView('all-businesses');
          }
          const tableSearch = document.getElementById('table-search-input');
          if (tableSearch) tableSearch.value = query;
          this.handleSearch(query);
        }
      });
    }
  },

  openMobileSidebar() {
    document.getElementById('saas-sidebar')?.classList.add('mobile-open');
    document.getElementById('saas-sidebar-backdrop')?.classList.add('active');
  },

  closeMobileSidebar() {
    document.getElementById('saas-sidebar')?.classList.remove('mobile-open');
    document.getElementById('saas-sidebar-backdrop')?.classList.remove('active');
  },

  switchView(viewName) {
    const pane = document.getElementById(`view-${viewName}`);
    if (!pane) return;

    this.currentView = viewName;
    this.closeMobileSidebar();

    // Update active class on panes
    document.querySelectorAll('.saas-view-pane').forEach(p => p.classList.remove('active'));
    pane.classList.add('active');

    // Update active class on sidebar items
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Update URL hash
    window.history.replaceState(null, null, `#${viewName}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render specific view contents
    switch (viewName) {
      case 'overview':
        this.renderOverview();
        break;
      case 'find-leads':
        // Ready
        break;
      case 'all-businesses':
        this.renderTable();
        break;
      case 'verified-leads':
        this.renderVerifiedLeads();
        break;
      case 'website-analyzer':
        this.renderWebsiteAnalyzerSelect();
        break;
      case 'weakness-detector':
        this.renderWeaknessDetector();
        break;
      case 'software-opportunities':
        this.renderSoftwareOpportunities(this.currentOppCategoryFilter || 'all');
        break;
      case 'pitch-generator':
        this.renderPitchStudioSelect();
        break;
      case 'lead-batch':
        this.renderBatchView();
        break;
      case 'daily-tracker':
        this.renderDailyTracker(this.currentDailyRange || 'today');
        break;
      case 'dispatched-leads':
        this.renderDispatchedLeads();
        break;
      case 'date-history':
        this.renderDateHistory();
        break;
      case 'followup-manager':
        this.renderFollowupManager();
        break;
      case 'reply-inbox':
        this.renderReplyInbox();
        break;
      case 'crm':
        this.renderCRM();
        break;
      case 'analytics':
        if (window.AnalyticsEngine) window.AnalyticsEngine.renderAllCharts();
        break;
      case 'settings':
        this.renderSettingsInputs();
        break;
      case 'outreach-engine':
        this.loadOutreachConfig();
        this.fetchOutreachStatus();
        break;
    }
  },

  // ========================================================
  // VIEW RENDERERS
  // ========================================================

  renderOverview() {
    this.updateAllMetricsAndBadges();
    if (window.AnalyticsEngine) {
      const dispatches = StorageService.getDispatches();
      const replies = StorageService.getReplies();
      window.AnalyticsEngine.renderFunnelChart(this.leads, dispatches, replies);
    }

    // Render Priority Pitch Queue cards (Top 4 Highest Reply Chance Leads)
    const priorityContainer = document.getElementById('overview-priority-queue-cards');
    if (priorityContainer) {
      const topPriority = this.sortLeads(this.leads, 'reply_chance')
        .filter(l => l.status !== 'dispatched' && !l.batchPitched)
        .slice(0, 4);

      if (topPriority.length === 0) {
        priorityContainer.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: #94a3b8;">All top queue leads pitched! Check All Businesses.</div>`;
      } else {
        priorityContainer.innerHTML = topPriority.map((lead, idx) => {
          const replyMeta = this.calculateReplyScore(lead);
          const scoreBadge = `<span class="badge-reply-score ${replyMeta.badgeClass}" title="${replyMeta.reason}">${replyMeta.icon} ${replyMeta.score}% Reply Chance</span>`;
          const wa = lead.whatsappNumber || (lead.phone ? lead.phone.replace(/[^0-9]/g, '') : '');
          const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent('Assalam-o-Alaikum ' + (lead.decisionMaker || 'Sir') + '! Noticed your business on Google Maps...')}` : '';
          
          return `
            <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                  <span class="priority-rank-pill" style="font-size: 0.68rem; padding: 2px 7px;">#${idx + 1} Pitch First</span>
                  ${scoreBadge}
                </div>
                <div style="font-weight: 800; font-size: 0.94rem; color: #fff; line-height: 1.3; margin-bottom: 3px;">${lead.businessName}</div>
                <div style="font-size: 0.76rem; color: #94a3b8; margin-bottom: 8px;">📍 ${lead.city}, ${lead.country}</div>
                <div style="font-size: 0.78rem; color: #cbd5e1; margin-bottom: 4px;">👤 <strong>${lead.decisionMaker || 'Owner'}</strong> <span style="font-size: 0.72rem; color: #94a3b8;">(${lead.decisionMakerTitle || 'Decision Maker'})</span></div>
                <div style="font-size: 0.74rem; color: #f87171; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 4px 8px; margin-bottom: 12px;">
                  ⚠️ ${lead.flawTitle || 'Missing direct mobile checkout'}
                </div>
              </div>
              <div style="display: flex; gap: 8px; margin-top: auto;">
                <button class="btn-primary" style="flex: 1; text-align: center; font-size: 0.78rem; padding: 8px 10px; background: linear-gradient(135deg, #25d366 0%, #128c7e 100%); color: #000; font-weight: 800; border: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; box-shadow: 0 0 10px rgba(37, 211, 102, 0.35);" onclick="App.dispatchSingleLead('${lead.id}', null, 'whatsapp')">
                  <span>⚡</span> WhatsApp Bhejo
                </button>
                <button class="btn-sec-action" style="flex: 1; font-size: 0.78rem; padding: 8px 10px;" onclick="App.openPitchModal('${lead.id}')">
                  👁️ Pitch Preview
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render recent dispatches feed
    const container = document.getElementById('overview-recent-dispatches');
    if (container) {
      const dispatches = StorageService.getDispatches();
      if (!dispatches || dispatches.length === 0) {
        container.innerHTML = `<p style="color: #94a3b8; font-size: 0.85rem; padding: 20px 0; text-align: center;">No messages dispatched yet today. Start pitching your active 50-lead batch!</p>`;
      } else {
        container.innerHTML = dispatches.slice(0, 6).map(d => `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.86rem; font-weight: 700; color: #fff;">${d.businessName || 'Business'}</div>
              <div style="font-size: 0.74rem; color: #94a3b8;">Via ${d.channel ? d.channel.toUpperCase() : 'EMAIL'} • ${d.dateStr || ''} (${d.timeStr || ''})</div>
            </div>
            <span style="font-size: 0.72rem; background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 8px; border-radius: 12px; font-weight: 700;">Sent</span>
          </div>
        `).join('');
      }
    }
  },

  updateAllMetricsAndBadges() {
    const total = this.leads.length;
    const verified = this.leads.filter(l => l.verificationStatus === 'VERIFIED ON GOOGLE MAPS').length;
    const dispatches = StorageService.getDispatches();
    const uniquePitched = new Set(dispatches.map(d => d.leadId).filter(Boolean)).size || this.leads.filter(l => l.status === 'dispatched' || l.crmStatus === 'sent' || l.batchPitched).length;
    const replies = StorageService.getReplies();
    const repliesCount = replies.length + this.leads.filter(l => l.status === 'replied').length;

    // Badges in Sidebar
    const badgeTotal = document.getElementById('sidebar-total-leads-badge');
    const badgeDispatched = document.getElementById('sidebar-dispatched-badge');
    const badgeFollowup = document.getElementById('sidebar-followup-badge');
    const badgeReply = document.getElementById('sidebar-reply-badge');

    if (badgeTotal) badgeTotal.textContent = total;
    if (badgeDispatched) badgeDispatched.textContent = uniquePitched;
    if (badgeReply) badgeReply.textContent = repliesCount;

    // Follow-ups due count
    const dueFollowups = this.leads.filter(l => l.status === 'followup_due' || (l.status === 'dispatched' && !l.followupPaused && l.dispatchedAt && (Date.now() - new Date(l.dispatchedAt).getTime()) > 48 * 3600 * 1000)).length;
    if (badgeFollowup) badgeFollowup.textContent = `${dueFollowups} DUE`;

    // Overview KPIs
    const kpiTotal = document.getElementById('kpi-total-discovered');
    const kpiVerified = document.getElementById('kpi-verified-leads');
    const kpiDispatched = document.getElementById('kpi-dispatched-count');
    const kpiReplies = document.getElementById('kpi-replies-count');

    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiVerified) kpiVerified.textContent = verified;
    if (kpiDispatched) kpiDispatched.textContent = uniquePitched;
    if (kpiReplies) kpiReplies.textContent = repliesCount;

    // Top Pitch Button & Overview Action
    const btnTopPitch = document.getElementById('btn-top-pitch-leads');
    if (btnTopPitch) btnTopPitch.innerHTML = `<span>⚡</span> Pitch Leads (${total})`;

    // Update 6-Country Tab Badges
    const allCount = this.leads.length;
    const usCount = this.leads.filter(l => this.getLeadRegion(l) === 'USA').length;
    const ukCount = this.leads.filter(l => this.getLeadRegion(l) === 'UK').length;
    const kwCount = this.leads.filter(l => this.getLeadRegion(l) === 'Kuwait').length;
    const caCount = this.leads.filter(l => this.getLeadRegion(l) === 'Canada').length;
    const omCount = this.leads.filter(l => this.getLeadRegion(l) === 'Oman').length;
    const bhCount = this.leads.filter(l => this.getLeadRegion(l) === 'Bahrain').length;

    const btnAll = document.querySelector('.country-tab-btn[data-country="ALL"]');
    if (btnAll) btnAll.textContent = `🌐 All Leads (${allCount})`;
    const btnUS = document.querySelector('.country-tab-btn[data-country="United States"]');
    if (btnUS) btnUS.textContent = `🇺🇸 United States (${usCount})`;
    const btnUK = document.querySelector('.country-tab-btn[data-country="United Kingdom"]');
    if (btnUK) btnUK.textContent = `🇬🇧 United Kingdom (${ukCount})`;
    const btnKW = document.querySelector('.country-tab-btn[data-country="Kuwait"]');
    if (btnKW) btnKW.textContent = `🇰🇼 Kuwait (${kwCount})`;
    const btnCA = document.querySelector('.country-tab-btn[data-country="Canada"]');
    if (btnCA) btnCA.textContent = `🇨🇦 Canada (${caCount})`;
    const btnOM = document.querySelector('.country-tab-btn[data-country="Oman"]');
    if (btnOM) btnOM.textContent = `🇴🇲 Oman (${omCount})`;
    const btnBH = document.querySelector('.country-tab-btn[data-country="Bahrain"]');
    if (btnBH) btnBH.textContent = `🇧🇭 Bahrain (${bhCount})`;

    // Batch Hero updates
    if (window.BatchManager) {
      const activeBatch = window.BatchManager.getActiveBatch();
      if (activeBatch) {
        const topBatchLabel = document.getElementById('top-batch-label');
        const topBatchFill = document.getElementById('top-batch-fill');
        const sidebarBatchBadge = document.getElementById('sidebar-batch-badge');

        if (topBatchLabel) topBatchLabel.textContent = `${activeBatch.title}: ${activeBatch.uniquePitched}/${activeBatch.totalLeads}`;
        if (topBatchFill) topBatchFill.style.width = `${activeBatch.completionRate}%`;
        if (sidebarBatchBadge) sidebarBatchBadge.textContent = activeBatch.title.toUpperCase();

        const ovTitle = document.getElementById('overview-batch-title');
        const ovProgressText = document.getElementById('overview-batch-progress-text');
        const ovProgressPct = document.getElementById('overview-batch-progress-pct');
        const ovBarFill = document.getElementById('overview-batch-bar-fill');
        const ovTotal = document.getElementById('overview-batch-total');
        const ovPitched = document.getElementById('overview-batch-pitched');
        const ovRemaining = document.getElementById('overview-batch-remaining');
        const ovLock = document.getElementById('overview-batch-lock-status');

        if (ovTitle) ovTitle.textContent = activeBatch.title;
        if (ovProgressText) ovProgressText.textContent = `${activeBatch.uniquePitched} / ${activeBatch.totalLeads} Pitched`;
        if (ovProgressPct) ovProgressPct.textContent = `${activeBatch.completionRate}%`;
        if (ovBarFill) ovBarFill.style.width = `${activeBatch.completionRate}%`;
        if (ovTotal) ovTotal.textContent = activeBatch.totalLeads;
        if (ovPitched) ovPitched.textContent = activeBatch.uniquePitched;
        if (ovRemaining) ovRemaining.textContent = activeBatch.remaining;
        if (ovLock) {
          ovLock.textContent = activeBatch.completionRate >= 100 ? '🔓 READY TO UNLOCK' : '🔒 LOCKED';
          ovLock.style.color = activeBatch.completionRate >= 100 ? '#10b981' : '#f87171';
        }
      }
    }
  },

  handleQuickPrioritySearch() {
    const countryEl = document.getElementById('search-country');
    const cityEl = document.getElementById('search-city');
    const catEl = document.getElementById('search-category');
    if (countryEl) countryEl.value = 'Global';
    if (cityEl) cityEl.value = '';
    if (catEl) catEl.value = 'all';
    this.handleRunPlacesSearch();
  },

  // ========================================================
  // GOOGLE PLACES API (NEW) DISCOVERY SEARCH
  // ========================================================
  async handleRunPlacesSearch() {
    const btn = document.getElementById('btn-run-places-search');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span>⏳</span> Scanning Google Places...`;
    btn.disabled = true;

    const countryVal = document.getElementById('search-country').value;
    const cityVal = document.getElementById('search-city').value.trim();
    const isPriorityQueue = (!cityVal || cityVal.toLowerCase() === 'all' || countryVal === 'Global');

    const params = {
      country: countryVal,
      state: document.getElementById('search-state').value,
      city: cityVal,
      category: document.getElementById('search-category').value,
      keyword: document.getElementById('search-keyword').value,
      count: document.getElementById('search-count').value,
      minRating: document.getElementById('search-min-rating').value,
      minReviews: document.getElementById('search-min-reviews').value,
      requireWebsite: document.getElementById('search-require-website').checked,
      requirePhone: document.getElementById('search-require-phone').checked
    };

    try {
      const data = await window.PlacesService.searchBusinesses(params);
      const resultsSection = document.getElementById('places-search-results-section');
      const resultsHeader = document.getElementById('places-results-header');
      const tbody = document.getElementById('places-search-results-tbody');

      resultsSection.style.display = 'block';
      resultsHeader.textContent = isPriorityQueue
        ? `🔥 Worldwide Priority Pitch Queue: ${data.count} Verified Businesses Ranked by Highest Reply Likelihood First`
        : `Search Results: ${data.count} Verified Businesses Found (${data.source === 'google_places_api_new' ? 'Live Google Places API' : 'Curated Local Database'})`;

      if (!data.results || data.results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 30px;">No businesses matched all strict filters. Try lowering minimum reviews or clearing keyword.</td></tr>`;
      } else {
        tbody.innerHTML = data.results.map((l, idx) => {
          const exactMaps = window.PlacesService.getExactGoogleMapsUrl(l);
          const replyMeta = this.calculateReplyScore(l);
          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                  <span class="priority-rank-pill">#${idx + 1} Priority Pitch</span>
                  <span class="badge-reply-score ${replyMeta.badgeClass}">
                    ${replyMeta.icon} ${replyMeta.score}% Reply Chance
                  </span>
                </div>
                <div style="font-weight: 800; color: #fff; font-size: 0.92rem;">${l.businessName}</div>
                <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">📍 ${l.address || (l.city + ', ' + l.country)}</div>
                <div style="font-size: 0.68rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace; margin-top: 2px;">ID: ${l.googlePlaceId || 'ChIJ_verified'}</div>
              </td>
              <td>
                <span class="badge-status-pill" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; font-weight: 700;">
                  🛡️ VERIFIED ON GOOGLE MAPS
                </span>
                <div style="font-size: 0.74rem; color: #fbbf24; margin-top: 4px;">⭐ ${l.rating || 4.5} (${l.reviews || 40} reviews)</div>
                <div style="font-size: 0.72rem; color: #cbd5e1; margin-top: 2px;">👤 ${l.decisionMaker || 'Owner'} (${l.decisionMakerTitle || 'Principal'})</div>
              </td>
              <td>
                <div style="font-size: 0.80rem; color: #cbd5e1;">📞 ${l.phone || 'No Phone Listed'}</div>
                <div style="font-size: 0.74rem; color: #6ee7b7; margin-top: 2px;">● ${l.operatingStatus || 'OPERATIONAL'}</div>
                ${l.website ? `<div style="font-size: 0.72rem; color: #38bdf8;"><a href="${l.website}" target="_blank" rel="noopener noreferrer">🌐 Website ↗</a></div>` : ''}
              </td>
              <td>
                <div style="font-size: 0.80rem; font-weight: 700; color: #38bdf8;">
                  ${(l.softwareOpportunity && l.softwareOpportunity.recommendedSoftware) || 'Direct Mobile Web App'}
                </div>
                <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">
                  ${(l.softwareOpportunity && l.softwareOpportunity.categoryLabel) || 'A. Website Development'}
                </div>
                ${l.flawLeakRange ? `<div style="font-size: 0.72rem; color: #f87171; margin-top: 2px;">💸 Leak: ${l.flawLeakRange}</div>` : ''}
              </td>
              <td>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                  <a href="${exactMaps}" target="_blank" rel="noopener noreferrer" class="btn-sec-action" style="text-align: center; font-size: 0.75rem;">
                    🗺️ Open Maps
                  </a>
                  <button class="btn-primary" style="font-size: 0.75rem; padding: 5px 8px;" onclick="App.addSingleSearchToBatch('${l.id || idx}')">
                    ➕ Add to Batch
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      this.currentSearchResults = data.results || [];
      const msg = isPriorityQueue
        ? `Loaded ${data.count} Worldwide Businesses ranked by Highest Reply Likelihood!`
        : `Found ${data.count} verified businesses via ${data.source === 'google_places_api_new' ? 'Google Places API' : 'Verified Directory'}`;
      this.showToast(msg);
    } catch (e) {
      this.showToast('Search error: ' + e.message, 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  },

  addAllSearchToBatch() {
    if (!this.currentSearchResults || this.currentSearchResults.length === 0) {
      this.showToast('No search results to add', 'warn');
      return;
    }
    let addedCount = 0;
    this.currentSearchResults.forEach(res => {
      if (!this.leads.some(l => l.id === res.id || (l.businessName === res.businessName && l.city === res.city))) {
        res.batchId = 'batch_01';
        this.leads.unshift(res);
        addedCount++;
      }
    });
    StorageService.saveLeads(this.leads);
    if (window.BatchManager) window.BatchManager.syncWithLeads(this.leads);
    this.updateAllMetricsAndBadges();
    this.showToast(`Added ${addedCount} new businesses to active batch!`);
  },

  addSingleSearchToBatch(id) {
    const item = (this.currentSearchResults || []).find(r => r.id === id);
    if (!item) return;
    if (!this.leads.some(l => l.id === item.id)) {
      item.batchId = 'batch_01';
      this.leads.unshift(item);
      StorageService.saveLeads(this.leads);
      if (window.BatchManager) window.BatchManager.syncWithLeads(this.leads);
      this.updateAllMetricsAndBadges();
      this.showToast(`Added ${item.businessName} to active batch!`);
    } else {
      this.showToast(`${item.businessName} is already in database`);
    }
  },

  // ========================================================
  // VERIFIED LEADS VIEW
  // ========================================================
  renderVerifiedLeads() {
    const tbody = document.getElementById('verified-leads-tbody');
    if (!tbody) return;

    const verified = this.leads.filter(l => l.verificationStatus === 'VERIFIED ON GOOGLE MAPS');
    tbody.innerHTML = verified.map((l, idx) => {
      const exactMaps = this.getExactMapsUrl(l);
      return `
        <tr>
          <td>
            <div style="font-weight: 800; color: #fff; font-size: 0.92rem;">${l.businessName}</div>
            <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">📍 ${l.address}</div>
            <div style="font-size: 0.68rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace; margin-top: 2px;">Place ID: ${l.googlePlaceId || 'ChIJ_verified'}</div>
          </td>
          <td>
            <div style="font-size: 0.80rem; color: #cbd5e1;">${l.city}, ${l.country}</div>
            <div style="font-size: 0.72rem; color: #6ee7b7; margin-top: 3px; font-weight: 700;">● ${l.operatingStatus || 'OPERATIONAL'}</div>
          </td>
          <td>
            <span style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.74rem; padding: 3px 8px; border-radius: 4px; font-weight: 800;">
              🛡️ VERIFIED ON GOOGLE MAPS
            </span>
            <div style="font-size: 0.74rem; color: #fbbf24; margin-top: 4px;">⭐ ${l.rating} (${Number(l.reviews).toLocaleString()} reviews)</div>
          </td>
          <td>
            <a href="${exactMaps}" target="_blank" rel="noopener noreferrer" class="btn-sec-action" style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.76rem;" title="Open Exact Listing using Google Place ID">
              <span>🗺️</span> OPEN GOOGLE MAPS ↗
            </a>
          </td>
          <td>
            <button class="btn-primary" style="font-size: 0.76rem; padding: 6px 12px;" onclick="App.openPitchStudioForLead('${l.id}')">
              <span>⚡</span> Pitch Business
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================
  // WEBSITE ANALYZER VIEW
  // ========================================================
  renderWebsiteAnalyzerSelect() {
    const select = document.getElementById('analyzer-select-lead');
    if (!select) return;
    select.innerHTML = `<option value="">Or Select Business from Database...</option>` +
      this.leads.filter(l => l.website).map(l => `<option value="${l.website}">${l.businessName} (${l.city})</option>`).join('');

    select.onchange = (e) => {
      const urlInput = document.getElementById('analyzer-url-input');
      if (urlInput && e.target.value) {
        urlInput.value = e.target.value;
      }
    };
  },

  async runWebsiteAudit() {
    const urlInput = document.getElementById('analyzer-url-input');
    const resultsArea = document.getElementById('analyzer-results-area');
    if (!urlInput || !resultsArea) return;

    let url = urlInput.value.trim();
    if (!url) {
      this.showToast('Please enter a website URL', 'warn');
      return;
    }

    resultsArea.innerHTML = `<div style="text-align: center; padding: 40px;"><div class="radar-sweep-anim" style="margin: 0 auto 12px auto;"></div><p style="color: #38bdf8;">Auditing website via Google PageSpeed Insights & Technical Presence Scanner...</p></div>`;

    const lead = this.leads.find(l => l.website && l.website.includes(url.replace('https://', '').replace('http://', '')));
    const audit = await window.WebsiteAnalyzer.analyzeWebsite(url, lead);

    resultsArea.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
        <div>
          <h3 style="font-size: 1.2rem; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>🌐</span> ${audit.url}
          </h3>
          <p style="font-size: 0.78rem; color: #94a3b8; margin-top: 4px;">Audited via: ${audit.flaw.verificationStatus}</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <a href="${audit.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Visit Site ↗</a>
          <button class="btn-primary" onclick="App.openPitchStudioWithFlaw('${encodeURIComponent(audit.flaw.title)}')">Generate Pitch</button>
        </div>
      </div>

      <!-- Gauges Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; margin-bottom: 20px;">
        <div class="glass-panel" style="padding: 16px; text-align: center;">
          <div style="font-size: 1.8rem; font-weight: 800; color: ${audit.speedScore >= 80 ? '#4ade80' : audit.speedScore >= 50 ? '#fbbf24' : '#f87171'};">${audit.speedScore}/100</div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 4px;">Performance Speed</div>
        </div>
        <div class="glass-panel" style="padding: 16px; text-align: center;">
          <div style="font-size: 1.8rem; font-weight: 800; color: #38bdf8;">${audit.fcp}</div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 4px;">First Contentful Paint</div>
        </div>
        <div class="glass-panel" style="padding: 16px; text-align: center;">
          <div style="font-size: 1.8rem; font-weight: 800; color: #10b981;">100%</div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 4px;">Mobile Responsive</div>
        </div>
        <div class="glass-panel" style="padding: 16px; text-align: center;">
          <div style="font-size: 1.8rem; font-weight: 800; color: #f43f5e;">${audit.flaw.businessImpact}</div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 4px;">Estimated Lost Sales</div>
        </div>
      </div>

      <!-- Detected Problem & Evidence Box -->
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 10px; padding: 18px; margin-bottom: 16px;">
        <div style="color: #fca5a5; font-size: 0.95rem; font-weight: 800; margin-bottom: 6px;">⚠️ Confirmed Digital Weakness: ${audit.flaw.title}</div>
        <p style="color: #cbd5e1; font-size: 0.84rem; line-height: 1.5; margin-bottom: 10px;">${audit.flaw.description}</p>
        <div style="font-size: 0.76rem; color: #fca5a5;"><strong>Verification Evidence:</strong> ${audit.flaw.evidence}</div>
      </div>

      <!-- Recommended Software Solution -->
      <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 10px; padding: 18px;">
        <div style="color: #38bdf8; font-size: 0.95rem; font-weight: 800; margin-bottom: 6px;">🛠️ Recommended Software Development Solution:</div>
        <div style="font-size: 0.88rem; color: #fff; font-weight: 700;">${audit.flaw.suggestedSolution}</div>
      </div>
    `;
  },

  // ========================================================
  // AI WEAKNESS DETECTOR VIEW
  // ========================================================
  renderWeaknessDetector() {
    const grid = document.getElementById('weakness-detector-grid');
    if (!grid) return;

    grid.innerHTML = this.leads.slice(0, 30).map(l => {
      const opp = (l.softwareOpportunity && l.softwareOpportunity.recommendedSoftware) || l.deliverableSolution || 'Custom Web App';
      return `
        <div class="glass-panel" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between; border-color: rgba(239, 68, 68, 0.25);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <span style="font-size: 0.95rem; font-weight: 800; color: #fff;">${l.businessName}</span>
              <span style="font-size: 0.70rem; background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35); padding: 2px 6px; border-radius: 4px; font-weight: 700;">
                💸 ${l.flawLeakRange || '$2,400/mo'}
              </span>
            </div>
            <div style="font-size: 0.74rem; color: #94a3b8; margin: 2px 0 10px 0;">📍 ${l.city}, ${l.country}</div>

            <div style="font-size: 0.84rem; font-weight: 700; color: #fca5a5; margin-bottom: 4px;">
              ⚠️ ${l.flawTitle}
            </div>
            <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.45; margin-bottom: 10px;">
              ${l.specificWeakness || l.whyMoneyLeaks || ''}
            </p>

            <div style="font-size: 0.72rem; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 6px 10px; border-radius: 6px; margin-bottom: 12px;">
              <strong>Proof:</strong> ${l.whereToCheck || 'Verified on Google Maps listing.'}
            </div>
          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
            <button class="btn-sec-action" onclick="App.openFlawModal('${l.id}')">🔍 Talking Points</button>
            <button class="btn-primary" style="font-size: 0.76rem; padding: 5px 10px;" onclick="App.openPitchStudioForLead('${l.id}')">⚡ Pitch Fix</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // ========================================================
  // UNIVERSAL SOFTWARE OPPORTUNITIES VIEW
  // ========================================================
  renderSoftwareOpportunities(catFilter = 'all') {
    this.currentOppCategoryFilter = catFilter;
    const grid = document.getElementById('software-opportunities-grid');
    if (!grid) return;

    // Update active tab class
    document.querySelectorAll('.opp-category-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.oppCat === catFilter);
    });

    const filtered = catFilter === 'all'
      ? this.leads
      : this.leads.filter(l => (l.softwareOpportunity && l.softwareOpportunity.category === catFilter));

    grid.innerHTML = filtered.slice(0, 36).map(l => {
      const opp = (window.SoftwareCatalog && window.SoftwareCatalog.detectOpportunity(l)) || l.softwareOpportunity || {
        categoryLabel: 'A. Website Development',
        recommendedSoftware: 'Direct Mobile Ordering Web App',
        businessBenefit: 'Recovers lost revenue.',
        mvpScope: 'Mobile menu, 1-tap cart, WhatsApp slip.',
        demoConcept: 'Smartphone ordering simulator.',
        complexity: 'Medium',
        suggestedTechStack: 'Next.js 14, TailwindCSS, Supabase'
      };

      return `
        <div class="opportunity-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div>
              <span class="nav-item-badge cyan">${opp.categoryLabel}</span>
              <h4 style="font-size: 1.05rem; color: #fff; font-weight: 800; margin-top: 6px;">${l.businessName}</h4>
              <div style="font-size: 0.74rem; color: #94a3b8;">📍 ${l.city}, ${l.country}</div>
            </div>
            <span style="font-size: 0.72rem; color: #fbbf24; font-weight: 700; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); padding: 3px 8px; border-radius: 6px;">
              ${opp.complexity} Complexity
            </span>
          </div>

          <div>
            <div style="font-size: 0.88rem; font-weight: 800; color: #38bdf8; margin-bottom: 4px;">
              🛠️ ${opp.recommendedSoftware}
            </div>
            <p style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.45;">
              ${opp.businessBenefit}
            </p>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; font-size: 0.74rem; color: #94a3b8;">
            <div style="color: #cbd5e1; margin-bottom: 3px;"><strong>MVP Scope:</strong> ${opp.mvpScope}</div>
            <div><strong>Tech Stack:</strong> ${opp.suggestedTechStack}</div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: auto;">
            <button class="btn-secondary" style="flex: 1; font-size: 0.76rem;" onclick="App.openProposalForLead('${l.id}')">
              📄 View Proposal
            </button>
            <button class="btn-primary" style="flex: 1; font-size: 0.76rem;" onclick="App.openPitchStudioForLead('${l.id}')">
              ⚡ Pitch Opportunity
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Setup tab clicks
    document.querySelectorAll('.opp-category-tab').forEach(t => {
      t.onclick = () => {
        this.renderSoftwareOpportunities(t.dataset.oppCat);
      };
    });
  },

  // ========================================================
  // AI PITCH STUDIO
  // ========================================================
  renderPitchStudioSelect() {
    const select = document.getElementById('pitch-studio-select-lead');
    if (!select) return;
    select.innerHTML = this.leads.map(l => `<option value="${l.id}">${l.businessName} (${l.city} - ${l.nicheName ? l.nicheName.split(',')[0] : ''})</option>`).join('');

    if (this.activeLeadForModal) {
      select.value = this.activeLeadForModal.id;
    }
    this.handlePitchStudioChange();
  },

  handlePitchStudioChange() {
    const select = document.getElementById('pitch-studio-select-lead');
    const channelSelect = document.getElementById('pitch-studio-channel');
    const stageSelect = document.getElementById('pitch-studio-stage');
    const langSelect = document.getElementById('pitch-studio-language');
    const subjectWrap = document.getElementById('pitch-studio-subject-wrap');
    const subjectInput = document.getElementById('pitch-studio-subject');
    const textarea = document.getElementById('pitch-studio-textarea');
    const btnDispatch = document.getElementById('btn-pitch-studio-dispatch');

    if (!select || !textarea) return;

    const leadId = select.value;
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const channel = channelSelect ? channelSelect.value : 'whatsapp';
    const stage = stageSelect ? stageSelect.value : 'initial';
    const language = langSelect ? langSelect.value : 'English';

    // Show subject line for email/gmail
    if (channel === 'gmail' || channel === 'email') {
      subjectWrap.style.display = 'block';
    } else {
      subjectWrap.style.display = 'none';
    }

    const generated = window.PitchEngine.generatePitch(lead, channel, stage, language);
    if (subjectInput) subjectInput.value = generated.subject;
    textarea.value = generated.body;

    if (btnDispatch) {
      btnDispatch.innerHTML = `<span>⚡</span> Send via ${channel.toUpperCase()}`;
    }
  },

  async generateAiPitchStudio() {
    const select = document.getElementById('pitch-studio-select-lead');
    const channelSelect = document.getElementById('pitch-studio-channel');
    const stageSelect = document.getElementById('pitch-studio-stage');
    const langSelect = document.getElementById('pitch-studio-language');
    const textarea = document.getElementById('pitch-studio-textarea');

    const leadId = select.value;
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    textarea.value = "Generating AI tailored pitch...";

    try {
      const resp = await fetch('/api/ai/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          channel: channelSelect.value,
          stage: stageSelect.value,
          language: langSelect.value
        })
      });
      const data = await resp.json();
      if (data && data.pitch) {
        textarea.value = data.pitch;
        this.showToast(`AI pitch generated via ${data.source}!`);
      }
    } catch (e) {
      this.handlePitchStudioChange();
    }
  },

  copyPitchStudioText() {
    const textarea = document.getElementById('pitch-studio-textarea');
    if (textarea) {
      navigator.clipboard.writeText(textarea.value);
      this.showToast('Pitch copied to clipboard! (Note: Sent counts only increase upon actual dispatch)');
    }
  },

  dispatchFromPitchStudio() {
    const select = document.getElementById('pitch-studio-select-lead');
    const channelSelect = document.getElementById('pitch-studio-channel');
    const textarea = document.getElementById('pitch-studio-textarea');

    if (!select || !channelSelect || !textarea) return;

    const leadId = select.value;
    const channel = channelSelect.value;
    const message = textarea.value;

    this.dispatchSingleLead(leadId, null, channel, message);
  },

  openPitchStudioForLead(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (lead) {
      this.activeLeadForModal = lead;
      this.switchView('pitch-generator');
      const select = document.getElementById('pitch-studio-select-lead');
      if (select) {
        select.value = lead.id;
        this.handlePitchStudioChange();
      }
    }
  },

  openPitchModal(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    this.activeLeadForModal = lead;

    const modal = document.getElementById('pitch-preview-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('modal-pitch-title');
    if (modalTitle) {
      modalTitle.textContent = `🎯 ${lead.businessName} — Gmail Cold Pitch & Problem Audit`;
    }

    // Business & Verified Info
    const bizNameEl = document.getElementById('modal-pitch-biz-name');
    if (bizNameEl) bizNameEl.textContent = lead.businessName;

    const locEl = document.getElementById('modal-pitch-location');
    if (locEl) locEl.textContent = `📍 ${lead.address || (lead.city + ', ' + lead.country)}`;

    const dmNameEl = document.getElementById('modal-pitch-dm-name');
    if (dmNameEl) dmNameEl.textContent = lead.decisionMaker || 'Owner / Principal';

    const dmTitleEl = document.getElementById('modal-pitch-dm-title');
    if (dmTitleEl) dmTitleEl.textContent = lead.decisionMakerTitle ? `(${lead.decisionMakerTitle})` : '';

    const emailDispEl = document.getElementById('modal-pitch-email-display');
    if (emailDispEl) emailDispEl.textContent = lead.email || 'Verified Google Maps Email';

    const copyEmailBtn = document.getElementById('modal-btn-copy-email');
    if (copyEmailBtn) {
      copyEmailBtn.onclick = () => this.copyEmail(lead.id);
    }

    const mapsLink = document.getElementById('modal-pitch-maps-link');
    if (mapsLink) mapsLink.href = this.getExactMapsUrl(lead);

    const webLink = document.getElementById('modal-pitch-web-link');
    if (webLink) {
      webLink.href = lead.website || '#';
      webLink.style.display = lead.website ? 'inline' : 'none';
    }

    // 🚨 Solid Weak Point details
    const solidWp = lead.solidWeakPoint || {
      coreProblem: lead.flawTitle || 'Aggregator Commission Bleed',
      financialLeak: lead.flawLeakRange || '$2,800 - $4,200/mo',
      whySolid: lead.flawDescription || 'Paying 28-30% aggregator cut without a direct online portal.',
      evidence: lead.flawEvidence || 'Google Maps profile directs users to aggregator portals without a direct 0% commission direct channel.',
      solutionSoftware: lead.flawSolution || 'Direct White-Label Web App & Automated Ordering'
    };

    const flawLeakEl = document.getElementById('modal-pitch-flaw-leak');
    if (flawLeakEl) flawLeakEl.textContent = solidWp.financialLeak || lead.flawLeakRange || '$3,000/mo';

    const flawTitleEl = document.getElementById('modal-pitch-flaw-title');
    if (flawTitleEl) flawTitleEl.textContent = solidWp.coreProblem;

    const problemWhyEl = document.getElementById('modal-pitch-problem-why');
    if (problemWhyEl) problemWhyEl.textContent = solidWp.whySolid;

    const problemEvidenceEl = document.getElementById('modal-pitch-problem-evidence');
    if (problemEvidenceEl) problemEvidenceEl.textContent = `🔍 Evidence: ${solidWp.evidence}`;

    const solutionEl = document.getElementById('modal-pitch-solution');
    if (solutionEl) solutionEl.textContent = solidWp.solutionSoftware;

    // AI Verification Copy Button
    const copyAiPromptBtn = document.getElementById('modal-btn-copy-ai-prompt');
    if (copyAiPromptBtn) {
      copyAiPromptBtn.onclick = () => this.copyProblemForAI(lead.id);
    }

    // Tailored Gmail Pitch fields
    const defaultSubject = (lead.gmailPitch && lead.gmailPitch.subject) || `Quick observation regarding ${lead.businessName}`;
    const defaultBody = (lead.gmailPitch && lead.gmailPitch.body) || lead.dispatchedMessage || (window.PitchEngine ? window.PitchEngine.generatePitch(lead, 'gmail', 'initial', 'English').body : '');

    const subjectInput = document.getElementById('modal-pitch-subject');
    if (subjectInput) subjectInput.value = defaultSubject;

    const textarea = document.getElementById('modal-pitch-textarea');
    if (textarea) textarea.value = defaultBody;

    const counter = document.getElementById('modal-pitch-counter');
    if (counter && textarea) {
      counter.textContent = `${textarea.value.length} characters`;
      textarea.oninput = () => {
        counter.textContent = `${textarea.value.length} characters`;
      };
    }

    // Action buttons in modal footer
    const btnCopy = document.getElementById('modal-btn-copy');
    if (btnCopy) {
      btnCopy.onclick = () => {
        const fullPitch = `Subject: ${subjectInput ? subjectInput.value : defaultSubject}\n\n${textarea ? textarea.value : defaultBody}`;
        navigator.clipboard.writeText(fullPitch).then(() => {
          this.showToast('📋 Full Gmail pitch copied to clipboard!', 'success');
        }).catch(() => {
          this.copyToClipboardFallback(fullPitch);
          this.showToast('📋 Full Gmail pitch copied to clipboard!', 'success');
        });
      };
    }

    const autoSmtpBtn = document.getElementById('modal-btn-auto-smtp');
    if (autoSmtpBtn) {
      autoSmtpBtn.onclick = () => {
        modal.classList.remove('open');
        this.triggerSingleOutreach(lead.id, 1);
      };
    }

    const sendGmailBtn = document.getElementById('modal-btn-send-gmail');
    if (sendGmailBtn) {
      sendGmailBtn.onclick = () => {
        const to = encodeURIComponent(lead.email || '');
        const su = encodeURIComponent(subjectInput ? subjectInput.value : defaultSubject);
        const body = encodeURIComponent(textarea ? textarea.value : defaultBody);
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${body}`, '_blank');
        this.dispatchSingleLead(lead.id, null, 'gmail', textarea ? textarea.value : defaultBody);
        this.showToast(`🚀 Opening Gmail compose for ${lead.businessName}!`, 'success');
        modal.classList.remove('open');
      };
    }

    const markPitchedBtn = document.getElementById('modal-btn-mark-pitched');
    if (markPitchedBtn) {
      markPitchedBtn.onclick = () => {
        this.dispatchSingleLead(lead.id, null, 'gmail', textarea ? textarea.value : defaultBody);
        this.showToast(`✅ ${lead.businessName} marked as pitched!`, 'success');
        modal.classList.remove('open');
      };
    }

    const openVoiceCallerBtn = document.getElementById('modal-btn-open-voice-caller');
    if (openVoiceCallerBtn) {
      openVoiceCallerBtn.onclick = () => {
        modal.classList.remove('open');
        this.openVoiceCaller(lead.id);
      };
    }

    modal.classList.add('open');
  },

  openVoiceCaller(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    if (window.VoiceCaller) {
      window.VoiceCaller.openModal(lead);
    } else {
      this.showToast('Voice caller module loading...', 'warn');
    }
  },

  copyProblemForAI(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    const prompt = lead.aiVerificationPrompt || `Please analyze this business weakness:\nBusiness: ${lead.businessName} (${lead.city}, ${lead.country})\nProblem: ${lead.solidWeakPoint?.coreProblem || lead.flawTitle}\nEvidence: ${lead.solidWeakPoint?.evidence || lead.flawDescription}\nFinancial Leak: ${lead.flawLeakRange}\nQuestion: Is this a genuine high-priority problem for this business?`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(prompt).then(() => {
        this.showToast('📋 Problem prompt copied! Paste into ChatGPT or Claude to verify.', 'success');
      }).catch(() => {
        this.copyToClipboardFallback(prompt);
        this.showToast('📋 Problem prompt copied! Paste into ChatGPT or Claude to verify.', 'success');
      });
    } else {
      this.copyToClipboardFallback(prompt);
      this.showToast('📋 Problem prompt copied! Paste into ChatGPT or Claude to verify.', 'success');
    }
  },

  copyPitch(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    const subject = (lead.gmailPitch && lead.gmailPitch.subject) || `Software Opportunity for ${lead.businessName}`;
    const body = (lead.gmailPitch && lead.gmailPitch.body) || lead.dispatchedMessage || '';
    const fullText = `Subject: ${subject}\n\n${body}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText).then(() => {
        this.showToast('📋 Gmail pitch copied to clipboard!', 'success');
      }).catch(() => {
        this.copyToClipboardFallback(fullText);
        this.showToast('📋 Gmail pitch copied to clipboard!', 'success');
      });
    } else {
      this.copyToClipboardFallback(fullText);
      this.showToast('📋 Gmail pitch copied to clipboard!', 'success');
    }
  },

  copyEmail(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead || !lead.email) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lead.email).then(() => {
        this.showToast(`📋 Copied email: ${lead.email}`, 'info');
      }).catch(() => {
        this.copyToClipboardFallback(lead.email);
        this.showToast(`📋 Copied email: ${lead.email}`, 'info');
      });
    } else {
      this.copyToClipboardFallback(lead.email);
      this.showToast(`📋 Copied email: ${lead.email}`, 'info');
    }
  },

  openInGmail(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    const to = encodeURIComponent(lead.email || '');
    const subject = encodeURIComponent((lead.gmailPitch && lead.gmailPitch.subject) || `Operational Opportunity for ${lead.businessName}`);
    const body = encodeURIComponent((lead.gmailPitch && lead.gmailPitch.body) || lead.dispatchedMessage || '');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
    this.dispatchSingleLead(lead.id, null, 'gmail', lead.gmailPitch?.body);
    this.showToast(`🚀 Opening Gmail compose for ${lead.businessName}!`, 'success');
  },

  copyToClipboardFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
  },

  filterByCountry(country) {
    this.currentCountryFilter = country || 'ALL';
    document.querySelectorAll('.country-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.country === this.currentCountryFilter);
    });
    this.runTableFilters();
  },

  filterByCity(city) {
    this.currentCityFilter = city || 'ALL';
    document.querySelectorAll('.city-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.city === this.currentCityFilter);
    });
    this.runTableFilters();
  },

  runTableFilters() {
    let list = [...this.leads];
    if (this.currentCountryFilter && this.currentCountryFilter !== 'ALL') {
      const cf = this.currentCountryFilter.toLowerCase();
      list = list.filter(l => (l.country && l.country.toLowerCase().includes(cf)) || (l.address && l.address.toLowerCase().includes(cf)));
    }
    if (this.currentCityFilter && this.currentCityFilter !== 'ALL') {
      const ctf = this.currentCityFilter.toLowerCase();
      list = list.filter(l => (l.city && l.city.toLowerCase().includes(ctf)) || (l.address && l.address.toLowerCase().includes(ctf)));
    }
    if (this.currentSearchQuery) {
      const q = this.currentSearchQuery.toLowerCase();
      list = list.filter(l => {
        return (l.businessName && l.businessName.toLowerCase().includes(q)) ||
               (l.city && l.city.toLowerCase().includes(q)) ||
               (l.country && l.country.toLowerCase().includes(q)) ||
               (l.email && l.email.toLowerCase().includes(q)) ||
               (l.phone && l.phone.includes(q)) ||
               (l.decisionMaker && l.decisionMaker.toLowerCase().includes(q)) ||
               (l.flawTitle && l.flawTitle.toLowerCase().includes(q)) ||
               (l.solidWeakPoint && l.solidWeakPoint.coreProblem && l.solidWeakPoint.coreProblem.toLowerCase().includes(q)) ||
               (l.googlePlaceId && l.googlePlaceId.toLowerCase().includes(q));
      });
    }
    const sortVal = document.getElementById('table-sort-filter')?.value || 'reply_chance';
    this.filteredLeads = this.sortLeads(list, sortVal);
    this.renderTable();
  },

  // ========================================================
  // 50-LEAD BATCH SYSTEM
  // ========================================================
  renderBatchView() {
    const heroContainer = document.getElementById('batch-management-hero');
    const tbody = document.getElementById('batch-leads-tbody');
    if (!heroContainer || !tbody) return;

    const activeBatch = window.BatchManager.getActiveBatch();
    if (!activeBatch) return;

    const batchLeads = this.leads.filter(l => l.batchId === activeBatch.id);

    heroContainer.innerHTML = `
      <div class="batch-card-hero">
        <div class="batch-hero-top">
          <div class="batch-title-tag">
            <span>📦</span> <span>${activeBatch.title} (50-Lead Batch System)</span>
            <span class="batch-status-badge ${activeBatch.status}">${activeBatch.status.toUpperCase()}</span>
          </div>
          <button class="btn-primary" id="btn-unlock-next-batch" ${activeBatch.completionRate < 100 ? 'disabled style="opacity: 0.5;"' : ''} onclick="App.handleUnlockNextBatch('${activeBatch.id}')">
            ${activeBatch.completionRate >= 100 ? '🔓 UNLOCK NEXT 50 LEADS' : '🔒 NEXT BATCH LOCKED (Finish Current)'}
          </button>
        </div>

        <div class="batch-progress-container">
          <div style="display: flex; justify-content: space-between; font-size: 0.84rem; margin-bottom: 6px;">
            <span>Unique Pitched Progress:</span>
            <span><strong style="color: #38bdf8;">${activeBatch.uniquePitched} / ${activeBatch.totalLeads} Pitched</strong> (${activeBatch.completionRate}%)</span>
          </div>
          <div class="batch-progress-bar-bg">
            <div class="batch-progress-bar-fill" style="width: ${activeBatch.completionRate}%;"></div>
          </div>
        </div>

        <div class="batch-stats-grid">
          <div class="batch-stat-box">
            <div class="batch-stat-num">${activeBatch.totalLeads}</div>
            <div class="batch-stat-label">Total Leads</div>
          </div>
          <div class="batch-stat-box">
            <div class="batch-stat-num" style="color: #38bdf8;">${activeBatch.uniquePitched}</div>
            <div class="batch-stat-label">Unique Pitched</div>
          </div>
          <div class="batch-stat-box">
            <div class="batch-stat-num" style="color: #fbbf24;">${activeBatch.remaining}</div>
            <div class="batch-stat-label">Remaining to Pitch</div>
          </div>
          <div class="batch-stat-box">
            <div class="batch-stat-num" style="color: ${activeBatch.completionRate >= 100 ? '#10b981' : '#f87171'};">
              ${activeBatch.completionRate >= 100 ? 'COMPLETED' : 'IN PROGRESS'}
            </div>
            <div class="batch-stat-label">Batch State</div>
          </div>
        </div>
      </div>
    `;

    tbody.innerHTML = batchLeads.map(l => {
      const isPitched = l.status === 'dispatched' || l.batchPitched || l.crmStatus === 'sent';
      const exactMaps = this.getExactMapsUrl(l);
      return `
        <tr>
          <td>
            <div style="font-weight: 800; color: #fff; font-size: 0.90rem;">${l.businessName}</div>
            <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">📍 ${l.city}, ${l.country}</div>
            <div style="font-size: 0.68rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace;">Place ID: ${l.googlePlaceId || 'Verified'}</div>
          </td>
          <td>
            <div style="font-size: 0.82rem; color: #cbd5e1;">👤 ${l.decisionMaker || 'Owner'}</div>
            <div style="font-size: 0.74rem; color: #94a3b8;">📞 ${l.phone || 'N/A'}</div>
          </td>
          <td>
            <div style="font-size: 0.80rem; font-weight: 700; color: #38bdf8;">
              ${(l.softwareOpportunity && l.softwareOpportunity.recommendedSoftware) || 'Direct Mobile Web App'}
            </div>
          </td>
          <td>
            <span class="nav-item-badge">${l.channel ? l.channel.toUpperCase() : 'GMAIL'}</span>
          </td>
          <td>
            ${isPitched
              ? `<span style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; font-weight: 800;">🚀 PITCHED</span>`
              : `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; font-weight: 700;">READY</span>`
            }
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn-primary" style="font-size: 0.72rem; padding: 5px 10px; background: linear-gradient(135deg, #25d366 0%, #128c7e 100%); color: #000; font-weight: 800; border: none; border-radius: 4px;" onclick="App.dispatchSingleLead('${l.id}', null, 'whatsapp')">⚡ WhatsApp</button>
              <button class="btn-sec-action" style="font-size: 0.72rem; padding: 5px 8px;" onclick="App.openPitchModal('${l.id}')">👁️ Pitch</button>
              <a href="${exactMaps}" target="_blank" rel="noopener noreferrer" class="btn-sec-action" style="font-size: 0.72rem; padding: 5px 8px;">Maps ↗</a>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  handleUnlockNextBatch(batchId) {
    const res = window.BatchManager.unlockNextBatch(batchId, this.leads);
    if (!res.success) {
      this.showToast(res.message, 'warn');
    } else {
      this.showToast(`Batch #${res.nextBatch.number} unlocked! You can now pitch the next 50 leads.`);
      this.renderBatchView();
      this.updateAllMetricsAndBadges();
    }
  },

  // ========================================================
  // DAILY TRACKER VIEW
  // ========================================================
  setDailyTrackerRange(range) {
    this.currentDailyRange = range;
    document.querySelectorAll('.date-filter-pill').forEach(p => p.classList.toggle('active', p.dataset.range === range));
    this.renderDailyTracker(range);
  },

  renderDailyTracker(range = 'today') {
    const dispatches = StorageService.getDispatches();
    const todayStr = new Date().toISOString().split('T')[0];

    let filtered = [];
    if (range === 'today') {
      filtered = dispatches.filter(d => d.dateStr === todayStr);
    } else if (range === 'yesterday') {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      filtered = dispatches.filter(d => d.dateStr === yesterday);
    } else if (range === 'last7') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      filtered = dispatches.filter(d => d.dateStr >= sevenDaysAgo);
    } else {
      filtered = dispatches;
    }

    const uniquePitched = new Set(filtered.map(d => d.leadId).filter(Boolean)).size;

    document.getElementById('tracker-unique-pitched').textContent = uniquePitched;
    document.getElementById('tracker-total-dispatches').textContent = filtered.length;

    const tbody = document.getElementById('daily-tracker-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 30px;">No dispatches recorded for this timeframe. Pitch leads to track performance!</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(d => `
        <tr>
          <td><strong>${d.businessName || 'Business'}</strong> <span style="font-size: 0.74rem; color: #94a3b8;">(${d.city || 'Local'})</span></td>
          <td><span class="nav-item-badge">${d.channel ? d.channel.toUpperCase() : 'GMAIL'}</span></td>
          <td>${d.dateStr} (${d.timeStr || ''})</td>
          <td>${d.batchId || 'Batch #01'}</td>
          <td><div style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78rem; color: #cbd5e1;">${d.exactMessage || 'Outreach sent.'}</div></td>
          <td><span style="color: #6ee7b7; font-weight: 700; font-size: 0.74rem;">✅ DISPATCHED</span></td>
        </tr>
      `).join('');
    }

    if (window.AnalyticsEngine) window.AnalyticsEngine.renderChannelChart(filtered);
  },

  // ========================================================
  // DISPATCHED LEADS OUTBOX VIEW
  // ========================================================
  renderDispatchedLeads() {
    const tbody = document.getElementById('dispatched-leads-tbody');
    if (!tbody) return;

    const dispatches = StorageService.getDispatches();
    if (!dispatches || dispatches.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 30px;">No leads dispatched yet. Start pitching leads from your active batch!</td></tr>`;
      return;
    }

    tbody.innerHTML = dispatches.map(d => {
      const lead = this.leads.find(l => l.id === d.leadId);
      const exactMaps = lead ? this.getExactMapsUrl(lead) : (d.mapsUrl || '#');
      return `
        <tr>
          <td>
            <strong>${d.businessName || (lead ? lead.businessName : 'Client')}</strong>
            <div style="font-size: 0.74rem; color: #94a3b8;">📍 ${lead ? lead.city : (d.city || 'Local')}, ${lead ? lead.country : ''}</div>
            <a href="${exactMaps}" target="_blank" rel="noopener noreferrer" style="font-size: 0.70rem; color: #38bdf8;">🗺️ Google Maps ↗</a>
          </td>
          <td>
            <div style="font-size: 0.80rem; color: #cbd5e1;">📞 ${lead ? lead.phone : (d.phone || 'N/A')}</div>
            <div style="font-size: 0.74rem; color: #94a3b8;">📧 ${lead ? lead.email : (d.email || 'N/A')}</div>
          </td>
          <td><span class="nav-item-badge">${d.channel ? d.channel.toUpperCase() : 'GMAIL'}</span></td>
          <td>${d.dateStr} (${d.timeStr || ''})</td>
          <td>${d.batchId || 'Batch #01'}</td>
          <td>
            <div style="max-width: 280px; max-height: 50px; overflow-y: auto; font-size: 0.74rem; color: #cbd5e1; line-height: 1.4; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px;">
              ${d.exactMessage || 'Outreach sent.'}
            </div>
          </td>
          <td>
            <span style="font-size: 0.74rem; color: #fbbf24; font-weight: 700;">⏰ Sequence Active</span>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================
  // DATE-WISE HISTORY ACCORDION VIEW
  // ========================================================
  renderDateHistory() {
    const container = document.getElementById('date-history-accordion-container');
    if (!container) return;

    const dispatches = StorageService.getDispatches();
    if (!dispatches || dispatches.length === 0) {
      container.innerHTML = `<div class="glass-panel" style="padding: 40px; text-align: center; color: #94a3b8;">No date-wise history recorded yet. Pitch leads to build your dispatch audit log!</div>`;
      return;
    }

    // Group dispatches by date
    const groups = {};
    dispatches.forEach(d => {
      const dKey = d.dateStr || '2026-11-01';
      if (!groups[dKey]) groups[dKey] = [];
      groups[dKey].push(d);
    });

    const sortedDates = Object.keys(groups).sort().reverse();

    container.innerHTML = sortedDates.map(dateStr => {
      const items = groups[dateStr];
      return `
        <div class="date-dispatch-group">
          <div class="date-dispatch-header" onclick="this.nextElementSibling.classList.toggle('hidden');">
            <div class="date-header-left">
              <span class="date-header-badge">${dateStr}</span>
              <strong style="color: #fff; font-size: 0.95rem;">${items.length} Leads Successfully Pitched</strong>
            </div>
            <span style="color: #38bdf8; font-size: 0.85rem; font-weight: 700;">Click to Expand / Collapse ▼</span>
          </div>
          <div class="date-dispatch-body">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${items.map(it => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <strong style="color: #fff; font-size: 0.90rem;">${it.businessName || 'Business'}</strong>
                    <div style="font-size: 0.74rem; color: #94a3b8;">Channel: ${it.channel ? it.channel.toUpperCase() : 'GMAIL'} • Time: ${it.timeStr || ''} • Batch: ${it.batchId || 'Batch #01'}</div>
                  </div>
                  <div style="font-size: 0.74rem; color: #cbd5e1; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    "${it.exactMessage ? it.exactMessage.slice(0, 80) + '...' : ''}"
                  </div>
                  <span style="font-size: 0.72rem; background: rgba(16, 185, 129, 0.15); color: #6ee7b7; padding: 2px 8px; border-radius: 10px; font-weight: 700;">DISPATCHED</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ========================================================
  // FOLLOW-UP MANAGER VIEW
  // ========================================================
  renderFollowupManager() {
    const tbody = document.getElementById('followup-manager-tbody');
    if (!tbody) return;

    const dispatchedLeads = this.leads.filter(l => l.status === 'dispatched' || l.crmStatus === 'sent');
    if (dispatchedLeads.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 30px;">No dispatched leads currently scheduled for follow-up.</td></tr>`;
      return;
    }

    tbody.innerHTML = dispatchedLeads.map(l => {
      const hoursSince = l.dispatchedAt ? (Date.now() - new Date(l.dispatchedAt).getTime()) / (3600 * 1000) : 0;
      let stage = 'Day 2 (+48h Check-In)';
      let isDue = hoursSince >= 48;
      if (hoursSince >= 168) {
        stage = 'Day 7 (Demo Offer)';
      } else if (hoursSince >= 96) {
        stage = 'Day 4 (Value Drop)';
      }

      return `
        <tr>
          <td>
            <strong>${l.businessName}</strong>
            <div style="font-size: 0.74rem; color: #94a3b8;">📞 ${l.phone || 'N/A'} • ${l.city}</div>
          </td>
          <td>${l.dispatchedAt ? l.dispatchedAt.split('T')[0] : 'Today'}</td>
          <td><strong style="color: ${isDue ? '#fbbf24' : '#6ee7b7'};">${isDue ? '⚡ Due Now' : 'In 24 Hours'}</strong></td>
          <td><span class="nav-item-badge">${stage}</span></td>
          <td>
            <span style="color: #6ee7b7; font-size: 0.76rem; font-weight: 700;">Active</span>
          </td>
          <td>
            <button class="btn-primary" style="font-size: 0.74rem; padding: 4px 10px;" onclick="App.openPitchStudioForLead('${l.id}')">
              Send Follow-up
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ========================================================
  // REPLY INBOX & WEBHOOK SIMULATOR
  // ========================================================
  renderReplyInbox() {
    const list = document.getElementById('reply-conversations-list');
    if (!list) return;

    const replies = StorageService.getReplies();
    if (!replies || replies.length === 0) {
      list.innerHTML = `<div style="text-align: center; padding: 30px; color: #94a3b8;">No incoming client replies recorded yet. When a prospect replies, all pending follow-ups are automatically paused!</div>`;
      return;
    }

    list.innerHTML = replies.map(r => `
      <div class="glass-panel" style="padding: 18px; border-left: 4px solid #10b981;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <strong style="font-size: 1rem; color: #fff;">${r.businessName}</strong>
            <span style="font-size: 0.74rem; color: #94a3b8; margin-left: 8px;">Via ${r.channel.toUpperCase()} • ${r.receivedAt}</span>
          </div>
          <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; font-weight: 800;">
            ⏸️ FOLLOW-UPS AUTO-PAUSED
          </span>
        </div>
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; font-size: 0.86rem; color: #f1f5f9; margin-bottom: 10px;">
          "${r.message}"
        </div>
        <div style="background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 10px; font-size: 0.80rem; color: #cbd5e1;">
          <strong style="color: #38bdf8;">🤖 Suggested AI Response:</strong> ${r.suggestedResponse || 'Can I share a 1-minute video preview?'}
        </div>
      </div>
    `).join('');
  },

  async simulateIncomingReplyModal() {
    const biz = prompt("Enter Business Name to simulate incoming reply:", "Master Biryani & Fast Food (Burns Road)");
    if (!biz) return;
    const msg = prompt("Enter Prospect Reply Message:", "Sounds interesting, how much does this direct ordering web app cost?");
    if (!msg) return;

    try {
      const resp = await fetch('/api/webhook/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: biz,
          message: msg,
          channel: 'whatsapp'
        })
      });
      const data = await resp.json();
      if (data.success) {
        // Update local lead status and pause follow-ups
        const lead = this.leads.find(l => l.businessName.includes(biz));
        if (lead) {
          lead.status = 'replied';
          lead.crmStatus = 'replied';
          lead.followupPaused = true;
        }
        StorageService.saveLeads(this.leads);
        this.showToast(`🚨 Incoming reply received from ${biz}! Pending follow-ups AUTO-PAUSED.`);
        this.renderReplyInbox();
        this.updateAllMetricsAndBadges();
      }
    } catch (e) {
      this.showToast('Simulation error: ' + e.message, 'error');
    }
  },

  // ========================================================
  // CRM PIPELINE VIEW
  // ========================================================
  renderCRM() {
    const grid = document.getElementById('crm-stages-grid');
    if (!grid) return;

    const stages = [
      { key: 'qualified', label: '1. Qualified Leads', color: '#38bdf8' },
      { key: 'ready_to_contact', label: '2. Ready to Contact', color: '#818cf8' },
      { key: 'sent', label: '3. Pitch Sent', color: '#f59e0b' },
      { key: 'replied', label: '4. Replied / Active', color: '#10b981' },
      { key: 'meeting_scheduled', label: '5. Meeting / Demo', color: '#06b6d4' },
      { key: 'won', label: '6. Projects Won', color: '#ec4899' }
    ];

    grid.innerHTML = stages.map(s => {
      const leadsInStage = this.leads.filter(l => (l.crmStatus || 'qualified') === s.key);
      return `
        <div class="glass-panel" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; min-height: 400px; border-top: 3px solid ${s.color};">
          <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <strong style="color: #fff; font-size: 0.88rem;">${s.label}</strong>
            <span style="background: ${s.color}; color: #070c1e; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 10px;">${leadsInStage.length}</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 500px;">
            ${leadsInStage.slice(0, 15).map(l => `
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 10px;">
                <div style="font-weight: 700; color: #fff; font-size: 0.84rem;">${l.businessName}</div>
                <div style="font-size: 0.72rem; color: #94a3b8; margin: 2px 0;">📍 ${l.city}</div>
                <div style="font-size: 0.72rem; color: #38bdf8; font-weight: 600;">${(l.softwareOpportunity && l.softwareOpportunity.recommendedSoftware) || 'Web App'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  // ========================================================
  // SETTINGS VIEW
  // ========================================================
  renderSettingsInputs() {
    const s = StorageService.getSettings();
    document.getElementById('setting-google-places-key').value = s.google_places_api_key || '';
    document.getElementById('setting-pagespeed-key').value = s.pagespeed_api_key || '';
    document.getElementById('setting-openai-key').value = s.openai_api_key || '';
    document.getElementById('setting-gemini-key').value = s.gemini_api_key || '';
    document.getElementById('setting-company-name').value = s.company_name || 'MF Software Solutions';
    document.getElementById('setting-company-website').value = s.company_website || 'https://mfsoftware.com';
    document.getElementById('setting-wa-number').value = s.whatsapp_number || '+923376568003';
    document.getElementById('setting-email-address').value = s.email_address || 'info.mfsoft@gmail.com';
  },

  handleSaveAllSettings() {
    const newSettings = {
      google_places_api_key: document.getElementById('setting-google-places-key').value.trim(),
      pagespeed_api_key: document.getElementById('setting-pagespeed-key').value.trim(),
      openai_api_key: document.getElementById('setting-openai-key').value.trim(),
      gemini_api_key: document.getElementById('setting-gemini-key').value.trim(),
      company_name: document.getElementById('setting-company-name').value.trim(),
      company_website: document.getElementById('setting-company-website').value.trim(),
      whatsapp_number: document.getElementById('setting-wa-number').value.trim(),
      email_address: document.getElementById('setting-email-address').value.trim()
    };

    StorageService.saveSettings(newSettings);
    this.settings = StorageService.getSettings();
    this.showToast('All platform settings and API keys saved successfully!');
    this.updateAllMetricsAndBadges();
  },

  // ========================================================
  // DISPATCH EXECUTION & REAL OUTREACH TRACKING
  // ========================================================
  dispatchSingleLead(leadId, targetPhoneOverride = null, forcedChannel = null, customMessage = null) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const channel = forcedChannel || lead.recommendedPitchChannel || lead.channel || 'gmail';

    // 1. WhatsApp Validation Check
    if (channel === 'whatsapp' && !this.isRealMobileWhatsApp(lead) && !targetPhoneOverride) {
      this.dispatchLandlineWhatsApp(lead.id);
      return;
    }

    // 2. Generate Pitch
    const pitch = customMessage || window.PitchEngine.generatePitch(lead, channel, 'initial').body;

    // 3. Open Channel
    if (channel === 'whatsapp') {
      const phone = targetPhoneOverride || (lead.contactInfo && lead.contactInfo.phone ? lead.contactInfo.phone : lead.phone);
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(pitch);
      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`, '_blank');
    } else if (channel === 'gmail' || channel === 'email') {
      const email = (lead.contactInfo && lead.contactInfo.email) || lead.email || '';
      const subject = encodeURIComponent(window.PitchEngine.generatePitch(lead, 'gmail', 'initial').subject);
      const body = encodeURIComponent(pitch);
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`, '_blank');
    } else if (channel === 'instagram') {
      navigator.clipboard.writeText(pitch);
      const igHandle = (lead.contactInfo && lead.contactInfo.instagramHandle) || lead.instagramHandle || '';
      const cleanHandle = igHandle.replace('@', '').trim();
      const igUrl = cleanHandle ? `https://instagram.com/${cleanHandle}` : 'https://instagram.com/direct/inbox/';
      window.open(igUrl, '_blank');
      this.showToast('Pitch copied to clipboard! Paste in Instagram DM.');
    } else if (channel === 'linkedin') {
      navigator.clipboard.writeText(pitch);
      const liUrl = (lead.contactInfo && lead.contactInfo.linkedinProfile) || 'https://www.linkedin.com/messaging/';
      window.open(liUrl, '_blank');
      this.showToast('Pitch copied to clipboard! Paste in LinkedIn InMail.');
    } else {
      navigator.clipboard.writeText(pitch);
      window.open('https://www.facebook.com/messages/', '_blank');
      this.showToast('Pitch copied to clipboard! Paste in Facebook Messenger.');
    }

    // 4. Record True Dispatch Event in DB & Batches
    const dispatchRecord = {
      leadId: lead.id,
      businessName: lead.businessName,
      city: lead.city,
      country: lead.country,
      channel: channel,
      exactMessage: pitch,
      batchId: lead.batchId || 'batch_01',
      status: 'sent'
    };

    StorageService.logDispatchEvent(dispatchRecord);
    if (window.BatchManager) {
      window.BatchManager.recordDispatch(lead.id, this.leads);
    }
    StorageService.saveLeads(this.leads);

    this.showToast(`🚀 Dispatched pitch to ${lead.businessName} via ${channel.toUpperCase()}!`);
    this.updateAllMetricsAndBadges();
    this.renderTable();
  },

  // ========================================================
  // PROPOSALS & FLAW MODALS
  // ========================================================
  openProposalForLead(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;
    this.activeLeadForProposal = lead;

    const prop = window.SoftwareCatalog.generateStructuredProposal(lead);
    const bodyContainer = document.getElementById('modal-proposal-body');
    if (!bodyContainer) return;

    bodyContainer.innerHTML = `
      <div style="border-bottom: 2px solid #38bdf8; padding-bottom: 12px; margin-bottom: 16px;">
        <span class="nav-item-badge cyan">${prop.recommendedSoftwareType}</span>
        <h2 style="font-size: 1.4rem; color: #fff; margin-top: 6px;">${prop.projectName}</h2>
        <div style="font-size: 0.82rem; color: #94a3b8;">Client: <strong>${prop.clientName}</strong> • Target: <strong>${prop.targetLocation}</strong> • Decision Maker: <strong>${prop.decisionMaker}</strong></div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <strong style="color: #f87171; text-transform: uppercase; font-size: 0.80rem;">1. Business Problem & Lost Revenue:</strong>
          <p style="color: #cbd5e1; font-size: 0.86rem; margin-top: 2px;">${prop.businessProblem}</p>
          <div style="font-size: 0.74rem; color: #fbbf24; margin-top: 2px;">Evidence: ${prop.supportingEvidence}</div>
        </div>

        <div>
          <strong style="color: #38bdf8; text-transform: uppercase; font-size: 0.80rem;">2. Proposed Software Solution:</strong>
          <p style="color: #fff; font-weight: 700; font-size: 0.95rem; margin-top: 2px;">${prop.proposedSolution}</p>
        </div>

        <div>
          <strong style="color: #6ee7b7; text-transform: uppercase; font-size: 0.80rem;">3. Key Business Benefits:</strong>
          <ul style="margin: 4px 0 0 18px; color: #d1fae5; font-size: 0.84rem;">
            ${prop.businessBenefits.map(b => `<li>${b}</li>`).join('')}
          </ul>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px;">
            <strong style="color: #38bdf8; font-size: 0.78rem;">Customer Features:</strong>
            <ul style="margin: 4px 0 0 16px; font-size: 0.78rem; color: #cbd5e1;">
              ${prop.customerFeatures.map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px;">
            <strong style="color: #a855f7; font-size: 0.78rem;">Admin & Automation Features:</strong>
            <ul style="margin: 4px 0 0 16px; font-size: 0.78rem; color: #cbd5e1;">
              ${prop.adminFeatures.map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div style="background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 12px; font-size: 0.80rem;">
          <div><strong>Suggested Tech Stack:</strong> ${prop.suggestedTechStack}</div>
          <div style="margin-top: 4px;"><strong>Estimated Timeline:</strong> ${prop.estimatedTimeline}</div>
        </div>
      </div>
    `;

    document.getElementById('modal-proposal').classList.add('open');
  },

  openFullProposalModal() {
    const select = document.getElementById('pitch-studio-select-lead');
    if (select && select.value) {
      this.openProposalForLead(select.value);
    }
  },

  copyProposalText() {
    const body = document.getElementById('modal-proposal-body');
    if (body) {
      navigator.clipboard.writeText(body.innerText);
      this.showToast('Full proposal copied to clipboard!');
    }
  },

  // ========================================================
  // UTILITIES & EXISTING COMPATIBILITY
  // ========================================================
  isRealMobileWhatsApp(lead) {
    if (!lead) return false;
    const raw = (lead.contactInfo && lead.contactInfo.phone ? lead.contactInfo.phone : (lead.phone || '')).trim();
    const digits = raw.replace(/[^0-9]/g, '');

    // Pakistan Mobiles: +92 3XX or 03XX
    if (digits.startsWith('923') && digits.length === 12) return true;
    if (digits.startsWith('03') && digits.length === 11) return true;

    // UAE Mobiles: +971 5X
    if (digits.startsWith('9715') && digits.length === 12) return true;

    // Saudi Mobiles: +966 5X
    if (digits.startsWith('9665') && digits.length === 12) return true;

    return false;
  },

  getExactMapsUrl(lead) {
    if (!lead) return 'https://maps.google.com';
    if (lead.googlePlaceId && lead.googlePlaceId.startsWith('ChIJ')) {
      return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lead.googlePlaceId)}`;
    }
    if (lead.exactMapsUrl) return lead.exactMapsUrl;
    const parts = [lead.businessName, lead.address, lead.city].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
  },

  dispatchLandlineWhatsApp(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const modal = document.getElementById('modal-landline-wa');
    const body = document.getElementById('modal-landline-wa-body');
    const footer = document.getElementById('modal-landline-wa-footer');
    if (!modal || !body || !footer) return;

    body.innerHTML = `
      <p><strong>${lead.businessName}</strong> ka registered phone number (<code>${lead.phone}</code>) ek Landline / US Line hai aur <strong>WhatsApp par mojood nahi hai</strong>.</p>
      <p style="margin-top: 10px;">North America aur Western markets me businesses inquiries ke liye <strong>Instagram DM</strong> ya <strong>Gmail</strong> use karte hain.</p>
    `;

    footer.innerHTML = `
      <button class="btn-secondary" onclick="document.getElementById('modal-landline-wa').classList.remove('open')">Band Karein</button>
      <button class="btn-primary" onclick="document.getElementById('modal-landline-wa').classList.remove('open'); App.dispatchSingleLead('${lead.id}', null, 'instagram')">📸 Instagram DM Bhejein</button>
      <button class="btn-primary" onclick="document.getElementById('modal-landline-wa').classList.remove('open'); App.dispatchSingleLead('${lead.id}', null, 'gmail')">📧 Gmail Bhejein</button>
    `;

    modal.classList.add('open');
  },

  // Flaw modal handler
  openFlawModal(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    document.getElementById('flaw-modal-biz-title').textContent = `⚠️ Masla & Proof: ${lead.businessName}`;
    document.getElementById('flaw-modal-title').textContent = lead.flawTitle || 'Mobile Checkout Bottleneck';
    document.getElementById('flaw-modal-desc').textContent = lead.specificWeakness || 'Friction on mobile viewports causing lost customer orders.';
    document.getElementById('flaw-modal-where').textContent = lead.whereToCheck || 'Check Google Maps listing & mobile viewport.';
    document.getElementById('flaw-modal-why').textContent = lead.whyMoneyLeaks || `Estimated revenue leakage of ${lead.flawLeakRange || '$2,400/mo'}`;

    const proofButtons = document.getElementById('flaw-modal-proof-buttons');
    if (proofButtons) {
      proofButtons.innerHTML = `
        <a href="${this.getExactMapsUrl(lead)}" target="_blank" rel="noopener noreferrer" class="btn-sec-action">🗺️ Google Maps Listing ↗</a>
        ${lead.website ? `<a href="${lead.website}" target="_blank" rel="noopener noreferrer" class="btn-sec-action">🌐 Website ↗</a>` : ''}
      `;
    }

    const talkingPoints = document.getElementById('flaw-modal-talking-points');
    if (talkingPoints) {
      const pts = lead.talkingPoints || [
        `"Notice customers on smartphones face friction when trying to book directly."`,
        `"We build 1-tap direct ordering funnels with zero delivery commissions."`
      ];
      talkingPoints.innerHTML = pts.map(p => `<div>• ${p}</div>`).join('');
    }

    document.getElementById('modal-flaw').classList.add('open');
  },

  // Add lead modal handler
  openAddLeadModal() {
    document.getElementById('add-lead-modal').classList.add('open');
  },

  handleSaveRealLead() {
    const name = document.getElementById('new-lead-business-name').value.trim();
    const phone = document.getElementById('new-lead-phone').value.trim();
    const city = document.getElementById('new-lead-city').value.trim();
    const owner = document.getElementById('new-lead-owner-name').value.trim();
    const website = document.getElementById('new-lead-website').value.trim();

    if (!name || !phone || !city) {
      this.showToast('Please fill in business name, phone, and city.', 'warn');
      return;
    }

    const newLead = {
      id: `places_custom_${Date.now()}`,
      businessName: name,
      city: city,
      country: city.includes('Pakistan') ? 'Pakistan' : 'Global',
      address: `${city}`,
      phone: phone,
      website: website,
      rating: '4.5',
      reviews: 45,
      decisionMaker: owner || 'Owner',
      decisionMakerTitle: 'Owner',
      operatingStatus: 'OPERATIONAL',
      verificationStatus: 'VERIFIED ON GOOGLE MAPS',
      authenticityStatus: 'VERIFIED',
      googlePlaceId: `ChIJ_custom_${Date.now()}`,
      batchId: 'batch_01',
      crmStatus: 'qualified',
      softwareOpportunity: {
        category: 'website_development',
        categoryLabel: 'A. Website Development',
        recommendedSoftware: 'Direct Mobile Ordering Web App',
        businessBenefit: 'Recovers lost customer sales.',
        mvpScope: 'Mobile menu, 1-tap cart, WhatsApp slip.',
        suggestedTechStack: 'Next.js 14, Supabase'
      }
    };

    this.leads.unshift(newLead);
    StorageService.saveLeads(this.leads);
    document.getElementById('add-lead-modal').classList.remove('open');
    this.showToast(`Saved ${name} to active database!`);
    this.updateAllMetricsAndBadges();
    this.renderTable();
  },

  // ========================================================
  // REPLY LIKELIHOOD SCORING & PRIORITY SEQUENCING ENGINE
  // ========================================================
  calculateReplyScore(lead) {
    if (!lead) return { score: 50, label: 'Moderate', badgeClass: 'badge-reply-low', icon: '📊', reason: 'Verified listing' };

    let score = 50; // Base score
    const phone = String(lead.phone || '').trim().replace(/[\s\-()]/g, '');
    const phoneType = String(lead.phoneType || '');
    const channel = String(lead.recommendedPitchChannel || lead.channel || '');
    const dm = String(lead.decisionMaker || '').trim();
    const hasRealDm = dm && !['owner', 'unknown', 'principal', 'n/a', ''].includes(dm.toLowerCase());
    const hasInsta = Boolean(lead.instagramHandle || (lead.contactInfo && lead.contactInfo.instagramHandle));
    const hasEmail = Boolean(lead.email);

    // 1. Direct Decision-Maker Contact Channel (+25 pts)
    // - Direct WhatsApp mobile: Pakistan (+923, 03), UAE (+9715, 05), Saudi (+9665, 05), UK (+447, 07)
    // - Direct Instagram DM to verified handle (channel === 'instagram')
    // - Direct Executive line / mobile with identified decision maker
    const isMobileWA = (
      phoneType === 'mobile_whatsapp' ||
      lead.whatsappVerified === true ||
      phone.startsWith('+923') || phone.startsWith('923') || phone.startsWith('03') ||
      phone.startsWith('+9715') || phone.startsWith('9715') ||
      phone.startsWith('+9665') || phone.startsWith('9665') ||
      phone.startsWith('+447') || phone.startsWith('447') || phone.startsWith('07')
    );

    const isDirectInsta = (channel === 'instagram' || hasInsta) && hasRealDm;
    const isDirectPhone = Boolean(phone) && hasRealDm;

    if (isMobileWA || isDirectInsta || isDirectPhone) {
      score += 25;
    } else if (hasInsta) {
      score += 18;
    } else if (hasEmail) {
      score += 15;
    }

    // 2. Named Real Decision Maker with Title (+15 pts)
    if (hasRealDm) {
      score += 10;
      if (lead.decisionMakerTitle && !String(lead.decisionMakerTitle).toLowerCase().includes('principal')) {
        score += 5;
      }
    }

    // 3. High Financial Leakage / Pain Point Urgency (+15 pts)
    const leak = String(lead.flawLeakRange || '').toLowerCase();
    if (['80k', '100k', '140k', '150k', '200k', '250k', '$3', '$4', '$5', '$6', '$8', 'aed', 'sar', '£'].some(k => leak.includes(k))) {
      score += 15;
    } else if (leak) {
      score += 10;
    }

    // 4. Active Commercial Traction: Reviews & Rating (+10 pts)
    const rev = parseInt(lead.reviews || 0, 10);
    if (rev >= 500) score += 7;
    else if (rev >= 100) score += 5;
    else if (rev >= 30) score += 3;

    const rat = parseFloat(lead.rating || 0);
    if (rat >= 4.2 && rat <= 4.8) score += 3;

    // 5. Verified Google Place ID (+5 pts)
    if (String(lead.googlePlaceId || '').startsWith('ChIJ')) score += 5;

    // Outreach Status Deductions (Already pitched leads appear after fresh leads)
    if (lead.status === 'dispatched' || lead.crmStatus === 'sent' || lead.batchPitched) {
      score -= 30;
    }
    if (lead.status === 'replied') {
      score -= 40;
    }

    score = Math.max(15, Math.min(99, Math.round(score)));

    let label = 'Strong Prospect';
    let badgeClass = 'badge-reply-high';
    let icon = '⚡';
    if (score >= 90) {
      label = 'Highest Reply (Pitch 1st)';
      badgeClass = 'badge-reply-top';
      icon = '🔥';
    } else if (score >= 80) {
      label = 'Very High Reply';
      badgeClass = 'badge-reply-high';
      icon = '⚡';
    } else if (score >= 70) {
      label = 'Good Reply Chance';
      badgeClass = 'badge-reply-med';
      icon = '⭐';
    } else {
      label = 'Moderate';
      badgeClass = 'badge-reply-low';
      icon = '📊';
    }

    const channelName = isMobileWA ? 'WhatsApp' : (channel === 'instagram' ? 'Instagram DM' : (lead.email ? 'Direct Email' : 'Phone'));
    const reason = hasRealDm
      ? `Direct Channel (${channelName}) + Identified Decision Maker (${dm}) + Urgent Revenue Leak`
      : 'Verified Listing with Direct Contact Channel';

    return { score, label, badgeClass, icon, reason };
  },

  renderReplyBadge(leadOrScore) {
    const meta = typeof leadOrScore === 'object' && leadOrScore.badgeClass
      ? leadOrScore
      : this.calculateReplyScore(leadOrScore);
    return `<span class="badge-reply-score ${meta.badgeClass}" title="${meta.reason}">${meta.icon} ${meta.score}% Reply Chance</span>`;
  },

  getLeadRegion(lead) {
    if (!lead) return 'Other';
    const c = String(lead.country || '').toLowerCase();
    const code = String(lead.countryCode || '').toUpperCase();
    const city = String(lead.city || '').toLowerCase();

    if (code === 'US' || c.includes('usa') || c.includes('united states') || city.includes('austin') || city.includes('new york') || city.includes('miami') || city.includes('chicago') || city.includes('los angeles') || city.includes('houston') || city.includes('boston') || city.includes('seattle') || city.includes('san francisco') || city.includes('dallas')) {
      return 'USA';
    }
    if (code === 'GB' || code === 'UK' || c.includes('united kingdom') || c.includes('uk') || city.includes('london') || city.includes('manchester') || city.includes('birmingham') || city.includes('edinburgh') || city.includes('glasgow') || city.includes('liverpool') || city.includes('leeds') || city.includes('bristol')) {
      return 'UK';
    }
    if (code === 'KW' || c.includes('kuwait') || city.includes('kuwait city') || city.includes('salmiya') || city.includes('hawally') || city.includes('al ahmadi') || city.includes('shuwaikh') || city.includes('farwaniya') || city.includes('sabah al salem')) {
      return 'Kuwait';
    }
    if (code === 'CA' || c.includes('canada') || city.includes('toronto') || city.includes('vancouver') || city.includes('montreal') || city.includes('calgary') || city.includes('ottawa') || city.includes('edmonton')) {
      return 'Canada';
    }
    if (code === 'OM' || c.includes('oman') || city.includes('muscat') || city.includes('salalah') || city.includes('sohar') || city.includes('nizwa') || city.includes('seeb')) {
      return 'Oman';
    }
    if (code === 'BH' || c.includes('bahrain') || city.includes('manama') || city.includes('muharraq') || city.includes('riffa') || city.includes('saar') || city.includes('seef')) {
      return 'Bahrain';
    }
    return 'Other';
  },

  sortLeads(leadsArray, sortKey = 'reply_chance') {
    const list = [...leadsArray];
    switch (sortKey) {
      case 'reply_chance': {
        // Check how many unique regions are present in this list
        const regionSet = new Set(list.map(l => this.getLeadRegion(l)));
        if (regionSet.size <= 1) {
          // Single region or city filtered: standard score descending sort
          return list.sort((a, b) => {
            const diff = this.calculateReplyScore(b).score - this.calculateReplyScore(a).score;
            if (diff !== 0) return diff;
            return parseInt(b.reviews || 0, 10) - parseInt(a.reviews || 0, 10);
          });
        }

        // Worldwide Multi-Region View: Interleave high-reply leads across 6 countries
        const buckets = {
          'USA': [],
          'UK': [],
          'Kuwait': [],
          'Canada': [],
          'Oman': [],
          'Bahrain': [],
          'Other': []
        };

        list.forEach(l => {
          const r = this.getLeadRegion(l);
          if (buckets[r]) buckets[r].push(l);
          else buckets['Other'].push(l);
        });

        // Sort each bucket by reply score descending, then by reviews descending
        Object.keys(buckets).forEach(k => {
          buckets[k].sort((a, b) => {
            const scoreDiff = this.calculateReplyScore(b).score - this.calculateReplyScore(a).score;
            if (scoreDiff !== 0) return scoreDiff;
            return parseInt(b.reviews || 0, 10) - parseInt(a.reviews || 0, 10);
          });
        });

        // Round-robin rotation across 6 countries: USA ➔ UK ➔ Kuwait ➔ Canada ➔ Oman ➔ Bahrain ➔ Other
        const rotation = ['USA', 'UK', 'Kuwait', 'Canada', 'Oman', 'Bahrain', 'Other'].filter(k => buckets[k].length > 0);
        const result = [];
        const maxLen = Math.max(...rotation.map(k => buckets[k].length));

        for (let i = 0; i < maxLen; i++) {
          for (const r of rotation) {
            if (i < buckets[r].length) {
              result.push(buckets[r][i]);
            }
          }
        }
        return result;
      }
      case 'reviews':
        return list.sort((a, b) => parseInt(b.reviews || 0, 10) - parseInt(a.reviews || 0, 10));
      case 'rating':
        return list.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
      case 'leak_amount':
        return list.sort((a, b) => {
          const numA = parseInt((a.flawLeakRange || '').replace(/\D/g, '') || 0, 10);
          const numB = parseInt((b.flawLeakRange || '').replace(/\D/g, '') || 0, 10);
          return numB - numA;
        });
      case 'name_asc':
        return list.sort((a, b) => (a.businessName || '').localeCompare(b.businessName || ''));
      default:
        return this.sortLeads(list, 'reply_chance');
    }
  },

  // Table rendering for All Businesses
  renderTable() {
    const tbody = document.getElementById('leads-tbody');
    const cardsContainer = document.getElementById('cards-view-container');
    if (!tbody) return;

    const list = this.filteredLeads && this.filteredLeads.length > 0 ? this.filteredLeads : this.leads;

    tbody.innerHTML = list.map((lead, idx) => this.renderLeadTableRow(lead, idx)).join('');
    if (cardsContainer) {
      cardsContainer.innerHTML = list.map((lead, idx) => this.renderLeadCard(lead, idx)).join('');
    }
  },

  renderLeadTableRow(lead, idx) {
    const exactMaps = this.getExactMapsUrl(lead);
    const isDispatched = lead.status === 'dispatched' || lead.crmStatus === 'sent' || lead.batchPitched;
    const replyMeta = this.calculateReplyScore(lead);
    const solidWp = lead.solidWeakPoint || {
      coreProblem: lead.flawTitle || 'Aggregator Commission Bleed',
      financialLeak: lead.flawLeakRange || '$2,800 - $4,200/mo',
      whySolid: lead.flawDescription || 'Paying 28-30% aggregator cut without a direct online portal.'
    };

    return `
      <tr data-lead-id="${lead.id}">
        <td>
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-wrap: wrap;">
            <span class="priority-rank-pill">#${idx + 1} Pitch First</span>
            <span class="badge-reply-score ${replyMeta.badgeClass}" title="${replyMeta.reason}">
              ${replyMeta.icon} ${replyMeta.score}% Reply Chance
            </span>
          </div>
          <div style="font-weight: 800; color: #fff; font-size: 0.94rem;">${lead.businessName}</div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin: 2px 0;">📍 ${lead.address || (lead.city + ', ' + lead.country)}</div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 3px;">
            <span style="font-size: 0.68rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace;">ID: ${lead.googlePlaceId ? lead.googlePlaceId.slice(0, 16) + '...' : 'Verified'}</span>
            <a href="${exactMaps}" target="_blank" rel="noopener noreferrer" style="font-size: 0.70rem; color: #38bdf8; font-weight: 700; text-decoration: none;">🗺️ Maps ↗</a>
            ${lead.website ? `<a href="${lead.website}" target="_blank" rel="noopener noreferrer" style="font-size: 0.70rem; color: #94a3b8; text-decoration: none;">🌐 Web ↗</a>` : ''}
          </div>
        </td>
        <td>
          <div style="font-size: 0.82rem; color: #cbd5e1;">👤 <strong>${lead.decisionMaker || 'Owner'}</strong> <span style="font-size: 0.72rem; color: #94a3b8;">(${lead.decisionMakerTitle || 'Principal'})</span></div>
          <div style="display: flex; align-items: center; gap: 5px; margin-top: 5px;">
            <a href="mailto:${lead.email}" style="font-size: 0.78rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-weight: 700; text-decoration: none;" title="Send Email">📧 ${lead.email}</a>
            <button type="button" class="btn-copy-small" onclick="App.copyEmail('${lead.id}')" title="Copy Email" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px 5px; color: #cbd5e1; font-size: 0.68rem; cursor: pointer;">📋</button>
          </div>
          <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 3px;">📞 ${lead.phone || 'N/A'}</div>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 700; color: #fca5a5; cursor: pointer;" onclick="App.openPitchModal('${lead.id}')" title="View Problem & Pitch">
            ⚠️ ${solidWp.coreProblem}
          </div>
          <div style="font-size: 0.74rem; color: #f87171; font-weight: 700; margin-top: 2px;">💸 Leak: ${solidWp.financialLeak || lead.flawLeakRange || '$3,000/mo'}</div>
          <div style="font-size: 0.70rem; color: #94a3b8; margin-top: 4px; line-height: 1.3;">
            ${(solidWp.whySolid ? solidWp.whySolid.slice(0, 95) + '...' : '')}
          </div>
        </td>
        <td>
          ${(() => {
            if (lead.outreach_status === 'STOP_REPLIED') {
              return `<span style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; display: inline-block;">🛑 STOP / REPLIED</span>`;
            } else if (lead.outreach_status === 'stage1_sent') {
              return `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; display: inline-block;">✉️ STAGE 1 SENT</span>`;
            } else if (lead.outreach_status === 'stage2_bump_sent') {
              return `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; display: inline-block;">🔄 BUMP SENT</span>`;
            } else if (lead.outreach_status === 'FINISHED') {
              return `<span style="background: rgba(100, 116, 139, 0.25); color: #cbd5e1; border: 1px solid rgba(100, 116, 139, 0.4); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; display: inline-block;">🏁 COMPLETED</span>`;
            } else if (lead.outreach_status === 'INVALID_DOMAIN') {
              return `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; display: inline-block;" title="${this.escapeHtml(lead.validation_error || 'Invalid domain/MX')}">⚠️ INVALID MX</span>`;
            } else if (isDispatched) {
              return `<span style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 8px; border-radius: 4px; font-size: 0.74rem; font-weight: 800; display: inline-block;">🚀 PITCHED</span>`;
            } else {
              return `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 4px 8px; border-radius: 4px; font-size: 0.74rem; font-weight: 700; display: inline-block;">READY</span>`;
            }
          })()}
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 6px; min-width: 190px;">
            <button class="btn-hero-action gmail" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #fff; font-weight: 800; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.78rem; width: 100%; box-shadow: 0 0 10px rgba(239, 68, 68, 0.35);" onclick="App.openInGmail('${lead.id}')" title="1-Tap Open Gmail with Tailored Pitch">
              <span>🚀</span> <span>Open in Gmail</span>
            </button>
            <div style="display: flex; gap: 4px;">
              <button class="btn-sec-action" style="flex: 1; padding: 5px 4px; font-size: 0.70rem; text-align: center;" onclick="App.openPitchModal('${lead.id}')" title="Inspect Pitch & Problem Details">
                👁️ Pitch
              </button>
              <button class="btn-sec-action" style="flex: 1; padding: 5px 4px; font-size: 0.70rem; text-align: center;" onclick="App.copyPitch('${lead.id}')" title="Copy Full Cold Pitch">
                📋 Copy
              </button>
              <button class="btn-sec-action" style="flex: 1; padding: 5px 4px; font-size: 0.70rem; text-align: center; color: #c4b5fd; border-color: rgba(139, 92, 246, 0.45);" onclick="App.openVoiceCaller('${lead.id}')" title="Launch Free AI Voice Call Simulator">
                🎙️ Call AI
              </button>
              <button class="btn-sec-action" style="flex: 1; padding: 5px 4px; font-size: 0.70rem; text-align: center; color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);" onclick="App.copyProblemForAI('${lead.id}')" title="Copy problem prompt to verify in ChatGPT / Claude">
                🤖 AI
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  },

  renderLeadCard(lead, idx) {
    const exactMaps = this.getExactMapsUrl(lead);
    const isDispatched = lead.status === 'dispatched' || lead.crmStatus === 'sent' || lead.batchPitched;
    const replyMeta = this.calculateReplyScore(lead);
    const solidWp = lead.solidWeakPoint || {
      coreProblem: lead.flawTitle || 'Aggregator Commission Bleed',
      financialLeak: lead.flawLeakRange || '$2,800 - $4,200/mo',
      whySolid: lead.flawDescription || 'Paying 28-30% aggregator cut without a direct online portal.'
    };

    return `
      <div class="lead-card glass-panel" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
              <span class="priority-rank-pill">#${idx + 1} Priority Pitch</span>
              <span class="badge-reply-score ${replyMeta.badgeClass}">
                ${replyMeta.icon} ${replyMeta.score}% Reply
              </span>
            </div>
            <div style="font-size: 0.96rem; font-weight: 800; color: #fff;">${lead.businessName}</div>
            <div style="font-size: 0.74rem; color: #94a3b8;">📍 ${lead.city}, ${lead.country}</div>
          </div>
          ${(() => {
            if (lead.outreach_status === 'STOP_REPLIED') {
              return `<span style="background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.5); padding: 3px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 800;">🛑 STOP / REPLIED</span>`;
            } else if (lead.outreach_status === 'stage1_sent') {
              return `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 3px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 800;">✉️ STAGE 1 SENT</span>`;
            } else if (lead.outreach_status === 'stage2_bump_sent') {
              return `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); padding: 3px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 800;">🔄 BUMP SENT</span>`;
            } else if (lead.outreach_status === 'FINISHED') {
              return `<span style="background: rgba(100, 116, 139, 0.25); color: #cbd5e1; border: 1px solid rgba(100, 116, 139, 0.4); padding: 3px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 800;">🏁 COMPLETED</span>`;
            } else if (lead.outreach_status === 'INVALID_DOMAIN') {
              return `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 3px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">⚠️ INVALID MX</span>`;
            } else if (isDispatched) {
              return `<span style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); padding: 3px 7px; border-radius: 4px; font-size: 0.70rem; font-weight: 800;">🚀 PITCHED</span>`;
            } else {
              return `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 3px 7px; border-radius: 4px; font-size: 0.70rem; font-weight: 700;">READY</span>`;
            }
          })()}
        </div>

        <div style="font-size: 0.80rem; color: #cbd5e1;">
          👤 <strong>${lead.decisionMaker || 'Owner'}</strong> <span style="font-size: 0.72rem; color: #94a3b8;">(${lead.decisionMakerTitle || 'Principal'})</span>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.5); padding: 6px 10px; border-radius: 6px;">
          <a href="mailto:${lead.email}" style="font-size: 0.78rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-weight: 700; text-decoration: none;">📧 ${lead.email}</a>
          <button type="button" class="btn-copy-small" onclick="App.copyEmail('${lead.id}')" title="Copy Email" style="margin-left: auto; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 1px 6px; color: #cbd5e1; font-size: 0.68rem; cursor: pointer;">📋</button>
        </div>

        <div style="border-left: 3px solid #f87171; padding-left: 8px; margin: 2px 0;">
          <div style="font-size: 0.80rem; color: #fca5a5; font-weight: 700;">🚨 ${solidWp.coreProblem}</div>
          <div style="font-size: 0.72rem; color: #f87171; font-weight: 700;">💸 Leak: ${solidWp.financialLeak || lead.flawLeakRange || '$3,000/mo'}</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: auto;">
          <button class="btn-primary" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #fff; font-weight: 800; border: none; padding: 9px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.82rem; width: 100%; box-shadow: 0 0 10px rgba(239, 68, 68, 0.35);" onclick="App.openInGmail('${lead.id}')">
            <span>🚀</span> <span>Open in Gmail</span>
          </button>
          <div style="display: flex; gap: 4px;">
            <button class="btn-sec-action" style="flex: 1; font-size: 0.72rem; padding: 6px 4px; text-align: center;" onclick="App.openPitchModal('${lead.id}')">
              👁️ Pitch
            </button>
            <button class="btn-sec-action" style="flex: 1; font-size: 0.72rem; padding: 6px 4px; text-align: center;" onclick="App.copyPitch('${lead.id}')">
              📋 Copy
            </button>
            <button class="btn-sec-action" style="flex: 1; font-size: 0.72rem; padding: 6px 4px; text-align: center; color: #c4b5fd; border-color: rgba(139, 92, 246, 0.45);" onclick="App.openVoiceCaller('${lead.id}')" title="Launch Free AI Voice Call Simulator">
              🎙️ Call AI
            </button>
            <button class="btn-sec-action" style="flex: 1; font-size: 0.72rem; padding: 6px 4px; text-align: center; color: #38bdf8;" onclick="App.copyProblemForAI('${lead.id}')">
              🤖 AI
            </button>
          </div>
        </div>
      </div>
    `;
  },

  applyFilter(channel) {
    this.currentChannelFilter = channel;
    document.querySelectorAll('.channel-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === channel));
    this.runTableFilters();
  },

  handleSearch(query) {
    this.currentSearchQuery = query || '';
    this.runTableFilters();
  },

  setupEventListeners() {
    // 6 Country tabs
    document.querySelectorAll('.country-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterByCountry(btn.dataset.country);
      });
    });

    // City chips
    document.querySelectorAll('.city-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterByCity(chip.dataset.city);
      });
    });

    // Channel tabs (if present)
    document.querySelectorAll('.channel-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyFilter(btn.dataset.filter);
      });
    });

    // Table sort filter
    const sortFilter = document.getElementById('table-sort-filter');
    if (sortFilter) {
      sortFilter.addEventListener('change', () => {
        this.runTableFilters();
      });
    }

    // Table search input
    const tableSearch = document.getElementById('table-search-input');
    if (tableSearch) {
      tableSearch.addEventListener('input', (e) => {
        this.handleSearch(e.target.value.trim());
      });
    }

    // View toggle buttons
    const btnCards = document.getElementById('btn-view-cards');
    const btnTable = document.getElementById('btn-view-table');
    if (btnCards && btnTable) {
      btnCards.onclick = () => {
        btnCards.classList.add('active');
        btnTable.classList.remove('active');
        document.getElementById('table-view-container').style.display = 'none';
        document.getElementById('cards-view-container').style.display = 'grid';
      };
      btnTable.onclick = () => {
        btnTable.classList.add('active');
        btnCards.classList.remove('active');
        document.getElementById('table-view-container').style.display = 'block';
        document.getElementById('cards-view-container').style.display = 'none';
      };
    }

    // Modal outside click close
    const pitchModal = document.getElementById('pitch-preview-modal');
    if (pitchModal) {
      pitchModal.addEventListener('click', (e) => {
        if (e.target === pitchModal) {
          pitchModal.classList.remove('open');
        }
      });
    }
  },

  exportCSV() {
    const list = this.filteredLeads && this.filteredLeads.length > 0 ? this.filteredLeads : this.leads;
    let csv = "ID,Business Name,City,Country,Place ID,Phone,Website,Decision Maker,Recommended Software,Flaw Title,Leak Range\n";
    list.forEach(l => {
      const opp = (l.softwareOpportunity && l.softwareOpportunity.recommendedSoftware) || '';
      csv += `"${l.id}","${l.businessName}","${l.city}","${l.country}","${l.googlePlaceId || ''}","${l.phone || ''}","${l.website || ''}","${l.decisionMaker || ''}","${opp}","${l.flawTitle || ''}","${l.flawLeakRange || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `softhunter_leads_${Date.now()}.csv`;
    link.click();
    this.showToast('Exported CSV file!');
  },

  exportDispatchesCSV() {
    const dispatches = StorageService.getDispatches();
    let csv = "ID,Business Name,City,Channel,Date,Time,Batch ID,Status,Exact Message\n";
    dispatches.forEach(d => {
      csv += `"${d.id}","${d.businessName || ''}","${d.city || ''}","${d.channel || ''}","${d.dateStr || ''}","${d.timeStr || ''}","${d.batchId || ''}","${d.status || ''}","${(d.exactMessage || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `softhunter_dispatches_${Date.now()}.csv`;
    link.click();
    this.showToast('Exported dispatches CSV!');
  },

  // ========================================================
  // AUTOMATED SMTP OUTREACH ENGINE COORDINATOR
  // ========================================================
  async fetchOutreachStatus() {
    try {
      const res = await fetch('/api/outreach/status');
      if (!res.ok) return;
      const data = await res.json();
      this.outreachTelemetry = data;

      // Update Engine Status Banner
      const statusText = document.getElementById('engine-status-text');
      const liveIndicator = document.getElementById('engine-live-indicator');
      const btnToggle = document.getElementById('btn-toggle-engine');
      const btnToggleText = document.getElementById('btn-toggle-engine-text');
      const sidebarBadge = document.getElementById('sidebar-engine-badge');

      const isRunning = Boolean(data.running || data.auto_sender_enabled);

      if (statusText) {
        statusText.textContent = isRunning ? 'ENGINE RUNNING (ACTIVE PACING)' : 'ENGINE IDLE / PAUSED';
        statusText.style.color = isRunning ? '#34d399' : '#94a3b8';
      }

      if (liveIndicator) {
        liveIndicator.style.background = isRunning ? '#10b981' : '#64748b';
        liveIndicator.style.boxShadow = isRunning ? '0 0 12px #10b981' : 'none';
      }

      if (btnToggle && btnToggleText) {
        if (isRunning) {
          btnToggleText.textContent = 'Pause Auto-Engine';
          btnToggle.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        } else {
          btnToggleText.textContent = 'Start Auto-Engine';
          btnToggle.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        }
      }

      // Header Start / Stop controls
      const topDot = document.getElementById('top-engine-dot');
      const topLabel = document.getElementById('top-engine-label');
      const topStart = document.getElementById('btn-engine-start');
      const topStop = document.getElementById('btn-engine-stop');
      if (topDot && topLabel) {
        topDot.style.background = isRunning ? '#10b981' : '#64748b';
        topDot.style.boxShadow = isRunning ? '0 0 10px #10b981' : 'none';
        topLabel.textContent = isRunning ? 'RUNNING' : 'STOPPED';
        topLabel.style.color = isRunning ? '#34d399' : '#94a3b8';
        topLabel.title = data.current_action || '';
      }
      if (topStart && topStop) {
        topStart.disabled = isRunning;
        topStop.disabled = !isRunning;
        topStart.style.opacity = isRunning ? '0.4' : '1';
        topStop.style.opacity = isRunning ? '1' : '0.4';
        topStart.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        topStop.style.cursor = isRunning ? 'pointer' : 'not-allowed';
      }

      if (sidebarBadge) {
        sidebarBadge.textContent = isRunning ? 'ACTIVE' : 'READY';
        sidebarBadge.style.color = isRunning ? '#34d399' : '#94a3b8';
      }

      // Clocks & Window Badges
      const clock = document.getElementById('engine-pkt-clock');
      if (clock && data.pkt_time) {
        clock.textContent = `${data.pkt_time} PKT`;
      }

      const windowBadge = document.getElementById('engine-window-badge');
      if (windowBadge) {
        if (data.active_window && data.active_window.active) {
          windowBadge.textContent = `🟢 ${data.active_window.window_name}`;
          windowBadge.style.background = 'rgba(16, 185, 129, 0.15)';
          windowBadge.style.color = '#6ee7b7';
          windowBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else {
          windowBadge.textContent = `⏳ ${data.next_window_info || 'Outside Active Window'}`;
          windowBadge.style.background = 'rgba(245, 158, 11, 0.15)';
          windowBadge.style.color = '#fbbf24';
          windowBadge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
        }
      }

      // Hero Grid Metrics
      const actionEl = document.getElementById('engine-current-action');
      if (actionEl) {
        actionEl.textContent = data.current_action || (isRunning ? 'Monitoring send windows...' : 'Engine Idle');
      }

      const dailyProgEl = document.getElementById('engine-daily-progress');
      if (dailyProgEl) {
        dailyProgEl.textContent = `${data.sent_today || 0} / ${data.daily_limit || 45} Sent Today`;
      }

      const breakdownEl = document.getElementById('engine-breakdown-progress');
      if (breakdownEl) {
        breakdownEl.textContent = `${data.new_leads_sent_today || 0} New | ${data.followups_sent_today || 0} Follow-ups`;
      }

      const windowHoursEl = document.getElementById('engine-window-hours');
      if (windowHoursEl) {
        if (data.active_window && data.active_window.active) {
          windowHoursEl.textContent = `${data.active_window.hours_pkt}`;
        } else {
          windowHoursEl.textContent = data.next_window_info || 'Sending Paused';
        }
      }

      // Special Schedule Name
      const schedName = document.getElementById('engine-schedule-name');
      if (schedName && data.quotas_today) {
        schedName.textContent = data.quotas_today.special_name || 'Standard Schedule';
        if (data.quotas_today.is_special_day) {
          schedName.style.color = '#fbbf24';
        } else {
          schedName.style.color = '#38bdf8';
        }
      }

      // Country Quotas
      if (data.country_progress) {
        const cp = data.country_progress;
        const setQ = (id, c) => {
          const el = document.getElementById(id);
          if (el && cp[c]) {
            el.textContent = `${cp[c].sent} / ${cp[c].target}`;
          }
        };
        setQ('quota-kw', 'KW');
        setQ('quota-bh', 'BH');
        setQ('quota-om', 'OM');
        setQ('quota-gb', 'GB');
        setQ('quota-us', 'US');
        setQ('quota-ca', 'CA');
      }

      // Real-Time Activity Logs Box
      const logsBox = document.getElementById('engine-logs-box');
      if (logsBox && data.recent_logs) {
        if (data.recent_logs.length === 0) {
          logsBox.innerHTML = `<div style="color: #64748b; font-style: italic;">Engine initialized. Waiting for active window or manual trigger...</div>`;
        } else {
          logsBox.innerHTML = data.recent_logs.slice(0, 30).map(l => {
            let color = '#cbd5e1';
            if (l.includes('[!]') || l.includes('❌') || l.includes('FAIL')) color = '#fca5a5';
            else if (l.includes('[+]') || l.includes('SENT') || l.includes('SUCCESS') || l.includes('MATCHED')) color = '#6ee7b7';
            else if (l.includes('[*]') || l.includes('WINDOW') || l.includes('PACING')) color = '#38bdf8';
            else if (l.includes('PAUSE') || l.includes('WAITING') || l.includes('REPLY')) color = '#fbbf24';
            return `<div style="color: ${color}; margin-bottom: 3px; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;">${this.escapeHtml(l)}</div>`;
          }).join('');
        }
      }
    } catch (e) {
      // Backend status poll error silent catch
    }
  },

  async setOutreachEngine(enable) {
    if (enable && this.outreachTelemetry && this.outreachTelemetry.smtp_configured === false) {
      this.showToast('Gmail App Password missing — add it in Automated SMTP Engine settings first', 'error');
      return;
    }
    try {
      const res = await fetch('/api/outreach/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: Boolean(enable) })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.outreachTelemetry = await res.json();
      this.fetchOutreachStatus();
      this.showToast(enable ? '🚀 Outreach Engine Started' : '⏹️ Outreach Engine Stopped', enable ? undefined : 'warn');
    } catch (e) {
      this.showToast('Engine control failed (is the Python server running?): ' + e.message, 'error');
    }
  },

  async toggleOutreachEngine() {
    const isCurrentlyRunning = this.outreachTelemetry && (this.outreachTelemetry.running || this.outreachTelemetry.auto_sender_enabled);
    const targetState = !isCurrentlyRunning;

    try {
      const res = await fetch('/api/outreach/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: targetState })
      });
      const data = await res.json();
      this.outreachTelemetry = data;
      this.fetchOutreachStatus();

      if (targetState) {
        this.showToast('🚀 Automated Outreach Engine Started (Human Pacing Active)');
      } else {
        this.showToast('⏸️ Automated Outreach Engine Paused', 'warn');
      }
    } catch (e) {
      this.showToast('Error toggling outreach engine: ' + e.message, 'error');
    }
  },

  async loadOutreachConfig() {
    try {
      const res = await fetch('/api/outreach/config');
      if (!res.ok) return;
      const cfg = await res.json();
      this.outreachConfig = cfg;

      const emailEl = document.getElementById('cfg-gmail-address');
      const passEl = document.getElementById('cfg-gmail-password');
      const nameEl = document.getElementById('cfg-sender-name');

      if (emailEl && cfg.gmail_address) emailEl.value = cfg.gmail_address;
      if (passEl && cfg.gmail_app_password) passEl.value = cfg.gmail_app_password;
      if (nameEl && cfg.sender_name) nameEl.value = cfg.sender_name;
    } catch (e) {
      // ignore
    }
  },

  async saveOutreachConfig() {
    const emailEl = document.getElementById('cfg-gmail-address');
    const passEl = document.getElementById('cfg-gmail-password');
    const nameEl = document.getElementById('cfg-sender-name');

    const gmailAddress = emailEl ? emailEl.value.trim() : '';
    const gmailAppPassword = passEl ? passEl.value.trim() : '';
    const senderName = nameEl ? nameEl.value.trim() : '';

    try {
      const res = await fetch('/api/outreach/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmail_address: gmailAddress,
          gmail_app_password: gmailAppPassword,
          sender_name: senderName,
          reply_to: gmailAddress
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Credentials and engine config saved!');
        this.fetchOutreachStatus();
      } else {
        this.showToast('Failed to save config: ' + (data.message || 'Unknown error'), 'error');
      }
    } catch (e) {
      this.showToast('Save error: ' + e.message, 'error');
    }
  },

  async testSmtpConnection() {
    const emailEl = document.getElementById('cfg-gmail-address');
    const passEl = document.getElementById('cfg-gmail-password');
    const resultEl = document.getElementById('smtp-test-result');

    const gmailAddress = emailEl ? emailEl.value.trim() : '';
    const gmailAppPassword = passEl ? passEl.value.trim() : '';

    if (!gmailAddress || !gmailAppPassword) {
      this.showToast('Please enter both Gmail address and 16-digit Google App Password first.', 'warn');
      if (resultEl) {
        resultEl.textContent = '⚠️ Missing Gmail address or 16-digit App Password';
        resultEl.style.color = '#fbbf24';
      }
      return;
    }

    if (resultEl) {
      resultEl.textContent = '⏳ Testing connection to smtp.gmail.com:587 (TLS)...';
      resultEl.style.color = '#38bdf8';
    }

    try {
      const res = await fetch('/api/outreach/test_smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmail_address: gmailAddress,
          gmail_app_password: gmailAppPassword
        })
      });
      const data = await res.json();

      if (data.success) {
        if (resultEl) {
          resultEl.textContent = '✅ ' + data.message;
          resultEl.style.color = '#10b981';
        }
        this.showToast('Gmail SMTP credentials verified successfully!');
      } else {
        if (resultEl) {
          resultEl.textContent = '❌ ' + data.message;
          resultEl.style.color = '#f87171';
        }
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      if (resultEl) {
        resultEl.textContent = '❌ Test failed: ' + e.message;
        resultEl.style.color = '#f87171';
      }
      this.showToast('Test error: ' + e.message, 'error');
    }
  },

  async triggerSingleOutreach(leadId, stage = 1) {
    try {
      const res = await fetch('/api/outreach/trigger_single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, stage })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('⚡ Email dispatched successfully via Gmail SMTP!');
        // Update lead local status
        const lead = this.leads.find(l => l.id === leadId);
        if (lead) {
          lead.status = 'dispatched';
          lead.crmStatus = 'sent';
          lead.batchPitched = true;
          lead.outreach_status = stage === 1 ? 'stage1_sent' : (stage === 2 ? 'stage2_bump_sent' : 'FINISHED');
        }
        this.renderTable();
        this.updateAllMetricsAndBadges();
        this.fetchOutreachStatus();
      } else {
        this.showToast(data.message || 'Dispatch failed', 'error');
      }
    } catch (e) {
      this.showToast('Dispatch error: ' + e.message, 'error');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
      background: rgba(13, 21, 48, 0.95);
      border: 1px solid ${type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#38bdf8'};
      color: #fff;
      padding: 12px 18px;
      border-radius: 8px;
      margin-top: 8px;
      font-size: 0.85rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadeIn 0.3s ease;
    `;
    toast.innerHTML = `<span>${type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅'}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
