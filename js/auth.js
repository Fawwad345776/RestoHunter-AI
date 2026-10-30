/**
 * RestoHunter AI — Operator Access Controller
 * Direct workspace access for Fawwad97. No hardcoded password on GitHub.
 */

const AUTH_CONFIG = {
  USERNAME: 'Fawwad97',
  SESSION_KEY: 'restohunter_auth_session'
};

const AuthSystem = {
  isAuthenticated: true,

  init() {
    this.checkSession();
    this.setupListeners();
  },

  checkSession() {
    const overlay = document.getElementById('auth-gate-overlay');
    if (overlay) overlay.style.display = 'none';
    this.isAuthenticated = true;
    this.updateUserBadge(AUTH_CONFIG.USERNAME);
  },

  setupListeners() {
    // Optional logout / reload
    const logoutBtn = document.getElementById('btn-auth-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }
  },

  handleLogin() {
    const overlay = document.getElementById('auth-gate-overlay');
    if (overlay) overlay.style.display = 'none';
    this.isAuthenticated = true;
    this.updateUserBadge(AUTH_CONFIG.USERNAME);
  },

  logout() {
    const overlay = document.getElementById('auth-gate-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  updateUserBadge(username) {
    const display = document.getElementById('nav-username-display');
    if (display) display.textContent = username || AUTH_CONFIG.USERNAME;
  }
};

window.AuthSystem = AuthSystem;

document.addEventListener('DOMContentLoaded', () => {
  AuthSystem.init();
});
