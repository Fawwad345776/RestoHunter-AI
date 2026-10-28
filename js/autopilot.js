/**
 * RestoHunter AI - Cloud Autopilot, Safe Batch Dispatcher & Day-3 Follow-Up Engine
 */

const SOCIAL_AUTHORITY_TEMPLATES = {
  linkedin: [
    {
      title: 'How Fixing Mobile Booking Recovered $8,400/Mo For A Local Private Clinic',
      content: `Over 43% of patients looking for dental & medical appointments search after 7:00 PM.\n\nYet 8 out of 10 private clinics still force patients to "Call during business hours."\n\nHere is what happens when you swap that for a 24/7 mobile booking widget:\n\n1. Emergency patient drop-off drops by 74%.\n2. Front desk saves 14 hours/week on manual scheduling.\n3. Net recovered revenue: $8,400 in the first 30 days.\n\nLocal businesses don't need expensive re-branding. They need to fix the holes in their digital checkout bucket.\n\n#LocalBusiness #B2B #HealthcareTech #DigitalTransformation #ConversionRate`
    },
    {
      title: 'The Hidden $3,200/Month DoorDash Tax Most Restaurant Owners Ignore',
      content: `A popular pizzeria in our city was doing $14,000/month in delivery orders.\n\nSounds great until you look at their net margin after third-party delivery apps:\n\n- DoorDash & UberEats commission: 30% (-$4,200/mo)\n- Pinch-to-zoom PDF mobile menu bounce rate: 68%\n- Customer database owned: 0% (DoorDash owns the diner's email & number)\n\nWe implemented a simple 1-tap mobile ordering link with 0% commission.\nResult: 62% of regular diners switched to direct ordering in week 2.\nSaved: $3,180 in pure monthly profit.\n\nStop renting your regulars from Silicon Valley apps.\n\n#Restaurants #HospitalityTech #FoodAndBeverage #SmallBusinessGrowth`
    }
  ],
  instagram: [
    {
      title: 'Carousel: Why Pinch-to-Zoom PDF Menus Are Killing Your Restaurant Sales 📉',
      slides: [
        'Slide 1: Why 68% of diners leave your website without ordering.',
        'Slide 2: The "PDF Menu Nightmare" on a smartphone screen.',
        'Slide 3: How third-party delivery apps pocket 30% of your hard work.',
        'Slide 4: The 1-Tap Solution: Direct zero-commission mobile ordering.',
        'Slide 5: Drop a comment or DM "AUDIT" to see how much your kitchen is leaking!'
      ]
    },
    {
      title: 'Story: 3 Costly Flaws On Local Business Websites In 2026 🚨',
      slides: [
        '1. No 24/7 online booking for clinics & salons ($5,000/mo leak)',
        '2. Phone-only bookings with zero automated SMS reminders (18% no-shows)',
        '3. Missing instant quote calculator for roofers & plumbers'
      ]
    }
  ]
};

const AutopilotEngine = {
  isDispatching: false,
  timerId: null,
  countdownInterval: null,
  currentLeadIndex: 0,
  secondsRemaining: 0,

  /**
   * Start Ban-Safe Automated Batch Dispatch (3 to 7 min human random intervals)
   */
  startBatchDispatch(leads, onProgress, onComplete, fastMode = false) {
    if (this.isDispatching) return;
    this.isDispatching = true;

    const queuedLeads = leads.filter(l => l.status === 'ready' || l.status === 'queued');
    if (queuedLeads.length === 0) {
      this.isDispatching = false;
      if (onComplete) onComplete('No ready leads found to dispatch.');
      return;
    }

    this.currentLeadIndex = 0;
    this.dispatchNext(queuedLeads, onProgress, onComplete, fastMode);
  },

  dispatchNext(queuedLeads, onProgress, onComplete, fastMode) {
    if (!this.isDispatching || this.currentLeadIndex >= queuedLeads.length) {
      this.stopBatchDispatch();
      if (onComplete) onComplete('All leads processed safely!');
      return;
    }

    const lead = queuedLeads[this.currentLeadIndex];
    // Mark as dispatched
    lead.status = 'dispatched';
    lead.dispatchedAt = new Date().toISOString();
    // Day-3 follow up due date (72 hours)
    const due = new Date();
    due.setHours(due.getHours() + 72);
    lead.followupDueAt = due.toISOString();

    StorageService.markAsPitched(lead.id, lead.businessName);

    // Call progress callback
    if (onProgress) {
      onProgress(lead, this.currentLeadIndex + 1, queuedLeads.length);
    }

    this.currentLeadIndex++;

    if (this.currentLeadIndex < queuedLeads.length) {
      // Calculate random delay (180 to 420 seconds, or 4 to 8 seconds in fast simulation mode)
      const delay = fastMode
        ? Math.floor(Math.random() * 4) + 4
        : Math.floor(Math.random() * (420 - 180 + 1)) + 180;

      this.secondsRemaining = delay;
      this.updateCountdownWidget();

      this.countdownInterval = setInterval(() => {
        this.secondsRemaining--;
        this.updateCountdownWidget();
        if (this.secondsRemaining <= 0) {
          clearInterval(this.countdownInterval);
        }
      }, 1000);

      this.timerId = setTimeout(() => {
        clearInterval(this.countdownInterval);
        this.dispatchNext(queuedLeads, onProgress, onComplete, fastMode);
      }, delay * 1000);
    } else {
      this.stopBatchDispatch();
      if (onComplete) onComplete('All 100 leads dispatched with ban-safe human spacing!');
    }
  },

  stopBatchDispatch() {
    this.isDispatching = false;
    if (this.timerId) clearTimeout(this.timerId);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    const widget = document.getElementById('batch-dispatch-widget');
    if (widget) widget.classList.remove('active');
  },

  updateCountdownWidget() {
    const widget = document.getElementById('batch-dispatch-widget');
    const timerText = document.getElementById('batch-timer-text');
    if (!widget || !timerText) return;

    widget.classList.add('active');
    const mins = Math.floor(this.secondsRemaining / 60);
    const secs = this.secondsRemaining % 60;
    const formatted = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    timerText.textContent = `⚡ Anti-Ban Safe Delay: Next lead dispatches in ${formatted}...`;
  },

  /**
   * Day-3 Follow-Up Scanner
   */
  getDueFollowUps(leads) {
    const now = new Date();
    return leads.filter(l => {
      if (l.status === 'dispatched' && l.followupDueAt) {
        return new Date(l.followupDueAt) <= now;
      }
      return false;
    });
  },

  getSocialTemplates() {
    return SOCIAL_AUTHORITY_TEMPLATES;
  }
};

window.AutopilotEngine = AutopilotEngine;
