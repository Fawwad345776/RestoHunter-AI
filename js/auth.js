/**
 * RestoHunter AI — Authentication Access Gate & Client Demo Prototype Engine
 * Authorized Operator Credentials:
 * Name: Fawwad97
 * Password: [REDACTED]
 *
 * Prospective Client Preview URL:
 * https://fawwad345776.github.io/RestoHunter-AI/?v=3.1
 */

const AUTH_CONFIG = {
  USERNAME: 'Fawwad97',
  PASSWORD: '[REDACTED]',
  SESSION_KEY: 'restohunter_auth_session'
};

const PROTOTYPE_NICHE_DATA = {
  restaurant: {
    brand: 'Artisan Trattoria',
    badge: '🟢 0% Delivery App Cut',
    title: '🛡️ Zero-Commission Direct Mobile Ordering',
    desc: 'Third-party delivery apps (DoorDash, UberEats, Talabat, Deliveroo) deduct 28% to 35% commission on every order. Our direct mobile ordering system connects diners straight to your kitchen via 1-tap checkout, recovering $3,200 – $6,500/month in pure profit.',
    savingsVal: '0% Fee',
    speedVal: '< 45 Sec',
    items: [
      { name: 'Truffle Margherita Pizza', desc: 'San Marzano tomatoes, buffalo mozzarella', price: 18.50 },
      { name: 'Handmade Fettuccine Bolognese', desc: 'Slow-simmered beef ragu, parmesan', price: 22.00 },
      { name: 'Organic Burrata Caprese', desc: 'Heirloom tomatoes, balsamic glaze', price: 14.00 }
    ]
  },
  dental: {
    brand: 'Dr. Elena Aesthetic Dental',
    badge: '🟢 24/7 Patient Calendar',
    title: '📅 24/7 After-Hours Emergency Booking Flow',
    desc: 'Over 43% of patients look for dental care after 7 PM. Without an automated intake calendar, patients bounce to the next clinic on Google Maps, leaking $4,000 – $8,500/month in missed high-ticket consultations.',
    savingsVal: '+$6,800/mo',
    speedVal: 'Instant 24/7',
    items: [
      { name: 'Emergency Tooth Pain Consultation', desc: 'Same-day triage, digital X-rays', price: 95.00 },
      { name: 'Cosmetic Veneers Smile Assessment', desc: '3D digital scan, custom smile design', price: 150.00 },
      { name: 'Teeth Whitening Routine Intake', desc: 'In-office laser whitening session', price: 299.00 }
    ]
  },
  salon: {
    brand: 'Luxe Lash & Brow Bar',
    badge: '🟢 Zero No-Show Engine',
    title: '📱 1-Tap Booking with 2-Way Automated SMS Reminders',
    desc: 'Phone-only booking leads to a 15-20% no-show rate and empty chairs. Our automated 2-way SMS reminder widget slashes no-shows by 85% and recovers $1,800 – $3,500/month in lost chair time.',
    savingsVal: '85% Fewer No-Shows',
    speedVal: 'Auto-SMS',
    items: [
      { name: 'Russian Volume Full Lash Set', desc: 'Custom density mapping, 120 mins', price: 180.00 },
      { name: 'Brow Lamination & Tint Sculpt', desc: 'Keratin infusion, precision shape', price: 85.00 },
      { name: 'Collagen Facial Refresh', desc: 'Hydration boost with scalp massage', price: 110.00 }
    ]
  },
  home: {
    brand: 'TrueNorth Roofing & Restoration',
    badge: '🟢 60s Instant Estimator',
    title: '⚡ 60-Second Emergency Quote Calculator',
    desc: 'Homeowners facing roof leaks or plumbing emergencies bounce in under 5 seconds if a site lacks instant pricing. Our 60-second quote calculator captures high-intent homeowners immediately, generating $5,000 – $12,000/month in extra high-ticket jobs.',
    savingsVal: '3.4x Leads',
    speedVal: '60 Seconds',
    items: [
      { name: 'Emergency Storm Leak Inspection', desc: 'Drone inspection + insurance audit', price: 149.00 },
      { name: 'Full Roof Replacement Estimate', desc: 'Architectural shingles, 25-yr warranty', price: 4800.00 },
      { name: 'Gutter Guard Installation', desc: 'Seamless aluminum leaf guard system', price: 890.00 }
    ]
  },
  hotel: {
    brand: 'The Rosemary Boutique Inn',
    badge: '🟢 Direct VIP Booking',
    title: '🏨 Direct Commission-Free Reservation Widget',
    desc: 'Online Travel Agencies (Expedia, Booking.com) pocket 18% to 25% of every room reservation. Our VIP direct reservation engine offers guests complimentary perks while keeping 100% of room revenue in your bank.',
    savingsVal: 'Save 22% Fee',
    speedVal: 'Direct VIP',
    items: [
      { name: 'Heritage King Suite with Balcony', desc: 'Complimentary artisan breakfast + wine', price: 265.00 },
      { name: 'Courtyard Garden Studio', desc: 'King bed, walk-in rainfall shower', price: 195.00 },
      { name: 'Penthouse Skyline Loft', desc: 'Panoramic city views, private jacuzzi', price: 420.00 }
    ]
  }
};

const AuthSystem = {
  isAuthenticated: false,
  activeNiche: 'restaurant',
  cartItems: [],
  orderConfirmed: false,

  init() {
    this.checkSession();
    this.setupListeners();
    this.renderPrototypeScreen('restaurant');
  },

  checkSession() {
    const overlay = document.getElementById('auth-gate-overlay');
    const saved = sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY);

    if (saved === 'authorized_' + AUTH_CONFIG.USERNAME) {
      this.isAuthenticated = true;
      if (overlay) overlay.classList.add('hidden');
      this.updateUserBadge(AUTH_CONFIG.USERNAME);
    } else {
      this.isAuthenticated = false;
      if (overlay) {
        overlay.classList.remove('hidden');
        const userInput = document.getElementById('auth-username');
        if (userInput) userInput.focus();
      }
    }
  },

  setupListeners() {
    // Password visibility toggle
    const toggleBtn = document.getElementById('auth-toggle-pwd');
    const pwdInput = document.getElementById('auth-password');
    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener('click', () => {
        const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
        pwdInput.setAttribute('type', type);
        toggleBtn.textContent = type === 'password' ? '👁️' : '🙈';
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('btn-auth-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    // Client Prototype Modal Buttons
    const openDemoBtn = document.getElementById('btn-open-client-demo');
    if (openDemoBtn) {
      openDemoBtn.addEventListener('click', () => {
        this.openClientPrototype();
      });
    }

    const openNavDemoBtn = document.getElementById('btn-open-client-preview-nav');
    if (openNavDemoBtn) {
      openNavDemoBtn.addEventListener('click', () => {
        this.openClientPrototype();
      });
    }

    const closeDemoBtn = document.getElementById('modal-prototype-close');
    if (closeDemoBtn) {
      closeDemoBtn.addEventListener('click', () => {
        this.closeClientPrototype();
      });
    }

    // Niche tabs inside prototype modal
    const tabsContainer = document.getElementById('prototype-niche-tabs');
    if (tabsContainer) {
      tabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.prototype-tab-btn');
        if (!btn) return;
        tabsContainer.querySelectorAll('.prototype-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const niche = btn.getAttribute('data-niche');
        this.activeNiche = niche;
        this.cartItems = [];
        this.orderConfirmed = false;
        this.renderPrototypeScreen(niche);
      });
    }

    // Auto-launch prototype if URL has preview or demo query param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('preview') || urlParams.has('demo')) {
      setTimeout(() => {
        this.openClientPrototype();
      }, 400);
    }
  },

  openClientPrototype() {
    const modal = document.getElementById('client-prototype-modal');
    if (modal) {
      modal.classList.add('open');
      this.cartItems = [];
      this.orderConfirmed = false;
      this.renderPrototypeScreen(this.activeNiche);
    }
  },

  closeClientPrototype() {
    const modal = document.getElementById('client-prototype-modal');
    if (modal) {
      modal.classList.remove('open');
    }
  },

  renderPrototypeScreen(nicheKey) {
    const data = PROTOTYPE_NICHE_DATA[nicheKey] || PROTOTYPE_NICHE_DATA.restaurant;
    const screen = document.getElementById('prototype-screen-content');
    if (!screen) return;

    // Update breakdown texts on right column
    const titleEl = document.getElementById('proto-breakdown-title');
    const descEl = document.getElementById('proto-breakdown-desc');
    const savingsEl = document.getElementById('proto-metric-savings');
    const speedEl = document.getElementById('proto-metric-speed');

    if (titleEl) titleEl.innerHTML = data.title;
    if (descEl) descEl.textContent = data.desc;
    if (savingsEl) savingsEl.textContent = data.savingsVal;
    if (speedEl) speedEl.textContent = data.speedVal;

    // Calculate subtotal
    const subtotal = this.cartItems.reduce((acc, item) => acc + item.price, 0);
    const commissionAvoided = (subtotal * 0.30).toFixed(2);

    // If order was simulated and confirmed
    if (this.orderConfirmed) {
      const waMsg = encodeURIComponent(
        `Hi Fawwad! I tested your 0% commission direct ordering prototype for ${data.brand} and saved $${commissionAvoided} in third-party fees. I want to deploy this setup for my business in 48 hours!`
      );
      screen.innerHTML = `
        <div class="phone-status-bar">
          <span>9:41</span>
          <span>5G 📶 100% 🔋</span>
        </div>
        <div class="phone-order-confirmed">
          <div style="font-size: 2.6rem; margin: 12px 0 4px 0; text-align: center;">🎉</div>
          <h3 style="color: #34d399; margin: 0 0 6px 0; font-size: 1.05rem; text-align: center; font-weight: 800;">TEST ORDER CONFIRMED!</h3>
          <p style="font-size: 0.75rem; color: #cbd5e1; text-align: center; margin-bottom: 12px; line-height: 1.35;">
            Total: <strong>$${subtotal.toFixed(2)}</strong><br>
            <span style="color: #34d399; font-weight: 700;">Commission Saved: $${commissionAvoided} (0% App Fee)</span>
          </p>

          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 10px; padding: 10px; margin-bottom: 14px; font-size: 0.70rem; color: #a7f3d0; line-height: 1.45;">
            ✅ 100% payout straight to your bank account.<br>
            ✅ Direct kitchen ticket printed instantly.<br>
            ✅ Customer saved directly to your VIP SMS list.
          </div>

          <a href="https://api.whatsapp.com/send?phone=923376568003&text=${waMsg}" target="_blank" class="btn-checkout-sim" style="background: linear-gradient(135deg, #10b981, #059669); text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; font-size: 0.82rem; margin-bottom: 10px; height: 42px; border-radius: 10px; box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);">
            <span>📲</span> Deploy For My Business (WhatsApp Fawwad)
          </a>

          <button class="btn-add-item" style="width: 100%; border-radius: 8px; padding: 8px; background: rgba(255,255,255,0.08); color: #94a3b8; font-size: 0.72rem; cursor: pointer;" onclick="AuthSystem.resetOrder()">
            🔄 Test Another Order Demo
          </button>
        </div>
      `;
      return;
    }

    let itemsHtml = data.items.map((item, idx) => `
      <div class="phone-item-card">
        <div class="phone-item-info">
          <h4>${item.name}</h4>
          <p>${item.desc}</p>
          <span class="item-price">$${item.price.toFixed(2)}</span>
        </div>
        <button class="btn-add-item" onclick="AuthSystem.addItemToCart(${idx})">
          + Add
        </button>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="phone-status-bar">
        <span>9:41</span>
        <span>5G 📶 100% 🔋</span>
      </div>

      <div class="phone-app-header">
        <div>
          <div class="phone-app-brand">${data.brand}</div>
          <div style="font-size: 0.65rem; color: #94a3b8;">Direct Mobile Checkout</div>
        </div>
        <span class="phone-pill-commission">${data.badge}</span>
      </div>

      <div class="phone-menu-list">
        ${itemsHtml}
      </div>

      <div class="phone-cart-summary">
        <div class="cart-calc-row">
          <span>Items Added:</span>
          <span>${this.cartItems.length} items</span>
        </div>
        <div class="cart-calc-row">
          <span>Subtotal:</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        <div class="cart-calc-row saving">
          <span>DoorDash 30% Fee:</span>
          <span>$0.00 (Saved $${commissionAvoided}!)</span>
        </div>
        <div class="cart-calc-row total">
          <span>You Keep 100%:</span>
          <span style="color: #34d399;">$${subtotal.toFixed(2)}</span>
        </div>

        <button class="btn-checkout-sim" onclick="AuthSystem.handleSimulatedCheckout()">
          ${subtotal > 0 ? `🚀 1-Tap Checkout ($${subtotal.toFixed(2)})` : 'Tap "+ Add" Above to Test Order'}
        </button>
      </div>
    `;
  },

  addItemToCart(index) {
    const data = PROTOTYPE_NICHE_DATA[this.activeNiche] || PROTOTYPE_NICHE_DATA.restaurant;
    if (data.items[index]) {
      this.cartItems.push(data.items[index]);
      this.renderPrototypeScreen(this.activeNiche);
    }
  },

  handleSimulatedCheckout() {
    const subtotal = this.cartItems.reduce((acc, item) => acc + item.price, 0);
    if (subtotal === 0) {
      alert('Please click "+ Add" on any menu or service item above to test the 1-tap checkout!');
      return;
    }
    this.orderConfirmed = true;
    this.renderPrototypeScreen(this.activeNiche);
  },

  resetOrder() {
    this.orderConfirmed = false;
    this.cartItems = [];
    this.renderPrototypeScreen(this.activeNiche);
  },

  handleLogin() {
    const userInput = document.getElementById('auth-username');
    const pwdInput = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error-msg');
    const authCard = document.getElementById('auth-card');
    const overlay = document.getElementById('auth-gate-overlay');

    const username = userInput ? userInput.value.trim() : '';
    const password = pwdInput ? pwdInput.value : '';

    if (username === AUTH_CONFIG.USERNAME && password === AUTH_CONFIG.PASSWORD) {
      // Success
      this.isAuthenticated = true;
      sessionStorage.setItem(AUTH_CONFIG.SESSION_KEY, 'authorized_' + AUTH_CONFIG.USERNAME);

      if (errorMsg) errorMsg.style.display = 'none';
      if (authCard) authCard.classList.remove('shake');

      // Visual feedback
      const submitBtn = document.getElementById('auth-submit-btn');
      if (submitBtn) {
        submitBtn.innerHTML = '<span>✅</span> ACCESS GRANTED!';
        submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      }

      setTimeout(() => {
        if (overlay) overlay.classList.add('hidden');
        this.updateUserBadge(username);
        if (window.App && window.App.showToast) {
          window.App.showToast(`Welcome back, ${username}! System unlocked.`, 'success');
        }
      }, 500);

    } else {
      // Denied
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = '⚠️ Invalid username or password. Access denied.';
      }
      if (authCard) {
        authCard.classList.remove('shake');
        void authCard.offsetWidth; // Trigger reflow
        authCard.classList.add('shake');
      }
      if (pwdInput) {
        pwdInput.value = '';
        pwdInput.focus();
      }
    }
  },

  logout() {
    sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
    this.isAuthenticated = false;
    const overlay = document.getElementById('auth-gate-overlay');
    const submitBtn = document.getElementById('auth-submit-btn');
    const userInput = document.getElementById('auth-username');
    const pwdInput = document.getElementById('auth-password');

    if (submitBtn) submitBtn.innerHTML = '<span>🔓</span> UNLOCK SYSTEM';
    if (pwdInput) pwdInput.value = '';
    if (overlay) overlay.classList.remove('hidden');
    if (userInput) userInput.focus();

    if (window.App && window.App.showToast) {
      window.App.showToast('System locked. Please log in again.', 'info');
    }
  },

  updateUserBadge(username) {
    const display = document.getElementById('nav-username-display');
    if (display) display.textContent = username;
  }
};

window.AuthSystem = AuthSystem;

document.addEventListener('DOMContentLoaded', () => {
  AuthSystem.init();
});
