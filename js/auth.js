/**
 * Gringotts Spending Tracker - Authentication Module
 * Uses sessionStorage for client-side password protection
 */

const Auth = {
  /**
   * Check if user is currently authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    const session = sessionStorage.getItem(CONFIG.SESSION_KEY);
    if (!session) return false;

    try {
      const data = JSON.parse(session);
      return data.authenticated === true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Attempt to login with password
   * @param {string} password - The password to validate
   * @returns {boolean} - True if login successful
   */
  login(password) {
    if (password === CONFIG.DASHBOARD_PASSWORD) {
      const sessionData = {
        authenticated: true,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
      return true;
    }
    return false;
  },

  /**
   * Logout and clear session
   */
  logout() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    window.location.href = 'index.html';
  },

  /**
   * Require authentication - redirect to login if not authenticated
   * Call this at the top of protected pages
   * @returns {boolean} - True if authenticated, false if redirecting
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  /**
   * Initialize login form handling
   * Call this on the login page
   */
  initLoginForm() {
    // If already authenticated, redirect to dashboard
    if (this.isAuthenticated()) {
      this.showDashboard();
      return;
    }

    const form = document.getElementById('login-form');
    const errorDiv = document.getElementById('login-error');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;

        if (this.login(password)) {
          this.showDashboard();
        } else {
          if (errorDiv) {
            errorDiv.textContent = 'Incorrect password. Please try again.';
            errorDiv.classList.remove('hidden');
          }
          document.getElementById('password').value = '';
        }
      });
    }
  },

  /**
   * Show the dashboard navigation cards
   */
  showDashboard() {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');

    if (loginSection) loginSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');
  },

  /**
   * Add logout button handler
   */
  initLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }
  }
};
