/**
 * RestoHunter AI — Operator Authentication Gate
 * Credentials:
 * Username: Fawwad97
 * Password: [REDACTED]
 */

const AUTH_CONFIG = {
  USERNAME: 'Fawwad97',
  PASSWORD: '[REDACTED]',
  SESSION_KEY: 'restohunter_auth_session'
};

const AuthSystem = {
  isAuthenticated: false,

  init() {
    this.checkSession();
    this.setupListeners();
  },

  checkSession() {
    const overlay = document.getElementById('auth-gate-overlay');
    const saved = sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY);

    if (saved === 'authorized_' + AUTH_CONFIG.USERNAME) {
      this.isAuthenticated = true;
      if (overlay) overlay.style.display = 'none';
      this.updateUserBadge(AUTH_CONFIG.USERNAME);
    } else {
      this.isAuthenticated = false;
      if (overlay) {
        overlay.style.display = 'flex';
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
      this.isAuthenticated = true;
      sessionStorage.setItem(AUTH_CONFIG.SESSION_KEY, 'authorized_' + AUTH_CONFIG.USERNAME);

      if (errorMsg) errorMsg.style.display = 'none';
      if (authCard) authCard.classList.remove('shake');

      const submitBtn = document.getElementById('auth-submit-btn');
      if (submitBtn) {
        submitBtn.innerHTML = '<span>✅</span> ACCESS GRANTED!';
        submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      }

      setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
        this.updateUserBadge(username);
        if (window.App && window.App.showToast) {
          window.App.showToast(`Welcome back, ${username}! System unlocked.`, 'success');
        }
      }, 400);

    } else {
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = '⚠️ Invalid username or password. Access denied.';
      }
      if (authCard) {
        authCard.classList.remove('shake');
        void authCard.offsetWidth;
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
    if (overlay) overlay.style.display = 'flex';
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
