/**
 * RestoHunter AI - WhatsApp Real-Time Notification Service
 * Dedicated alerting for: +923376568003 (customizable in settings)
 */

const WhatsAppService = {
  /**
   * Formats the exact client reply notification template
   */
  formatReplyNotification({ businessName, city, platform, clientMessage, aiSuggestedReply }) {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    return `🚨 NAYA CLIENT REPLY AAYA HAI!
${divider}
🏢 Business: ${businessName} (${city})
📱 Platform: ${platform}
💬 Gora Ka Message: 
"${clientMessage}"

👉 AI Suggested Reply: 
"${aiSuggestedReply}"
${divider}`;
  },

  /**
   * Alias for backward compatibility with ReplyCenter
   */
  notifyIncomingReply(data) {
    return this.sendWhatsAppAlert(data);
  },

  /**
   * Triggers the WhatsApp notification:
   * 1. Copies/formats the alert
   * 2. Plays audio chime
   * 3. Sends background webhook / CallMeBot push if configured
   * 4. Prepares WhatsApp direct chat URL
   */
  sendWhatsAppAlert(data) {
    const settings = (window.StorageService && StorageService.getSettings()) || {};
    const phone = (settings.whatsapp_number || '+923376568003').replace(/[^0-9]/g, '');
    const message = this.formatReplyNotification(data);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;

    // Play subtle alert chime
    this.playChime();

    // 1. Try local backend server if running
    fetch('/api/whatsapp-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message,
        businessName: data.businessName,
        platform: data.platform
      })
    }).catch(() => {});

    // 2. Automated background push via CallMeBot (if API key set)
    if (settings.callmebot_api_key) {
      const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${settings.callmebot_api_key}`;
      fetch(callmebotUrl, { mode: 'no-cors' }).catch(() => {});
    }

    // 3. Automated background push via Custom Webhook (if set)
    if (settings.whatsapp_webhook_url) {
      fetch(settings.whatsapp_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+${phone}`,
          text: message,
          business: data.businessName,
          platform: data.platform,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});
    }

    return {
      phone,
      message,
      whatsappUrl
    };
  },

  /**
   * Sound effect on incoming reply
   */
  playChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      // AudioContext muted/unsupported
    }
  }
};

window.WhatsAppService = WhatsAppService;

