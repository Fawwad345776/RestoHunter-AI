/**
 * RestoHunter AI - Live Reply Center & Real-Time Inbox Coordinator
 * Channels: WhatsApp Direct, Gmail, LinkedIn, Instagram
 */

const SAMPLE_CLIENT_REPLIES = [];

const ReplyCenter = {
  activeFilter: null,

  init() {
    this.renderStats();
    this.setupListeners();
  },

  getRepliesData() {
    const stored = StorageService.getReplies();
    return stored || [];
  },

  renderStats() {
    const leads = (window.App && window.App.leads) || StorageService.getLeads() || [];
    const replies = this.getRepliesData();

    const stats = {
      whatsapp: {
        total: leads.filter(l => l.channel === 'whatsapp' && (l.status === 'dispatched' || l.status === 'replied')).length,
        replies: leads.filter(l => l.channel === 'whatsapp' && l.status === 'replied').length + replies.filter(r => r.channelKey === 'whatsapp').length
      },
      gmail: {
        total: leads.filter(l => l.channel === 'gmail' && (l.status === 'dispatched' || l.status === 'replied')).length,
        replies: leads.filter(l => l.channel === 'gmail' && l.status === 'replied').length + replies.filter(r => r.channelKey === 'gmail').length
      },
      linkedin: {
        total: leads.filter(l => l.channel === 'linkedin' && (l.status === 'dispatched' || l.status === 'replied')).length,
        replies: leads.filter(l => l.channel === 'linkedin' && l.status === 'replied').length + replies.filter(r => r.channelKey === 'linkedin').length
      },
      instagram: {
        total: leads.filter(l => l.channel === 'instagram' && (l.status === 'dispatched' || l.status === 'replied')).length,
        replies: leads.filter(l => l.channel === 'instagram' && l.status === 'replied').length + replies.filter(r => r.channelKey === 'instagram').length
      }
    };

    // Update DOM counts and badges with real honest data
    const waBadge = document.getElementById('whatsapp-unread-badge');
    const waTotal = document.getElementById('whatsapp-total-count');
    const gmailBadge = document.getElementById('gmail-unread-badge');
    const gmailTotal = document.getElementById('gmail-total-count');
    const linkedinBadge = document.getElementById('linkedin-unread-badge');
    const linkedinTotal = document.getElementById('linkedin-total-count');
    const instaBadge = document.getElementById('instagram-unread-badge');
    const instaTotal = document.getElementById('instagram-total-count');

    if (waTotal) waTotal.textContent = stats.whatsapp.total;
    if (gmailTotal) gmailTotal.textContent = stats.gmail.total;
    if (linkedinTotal) linkedinTotal.textContent = stats.linkedin.total;
    if (instaTotal) instaTotal.textContent = stats.instagram.total;

    if (waBadge) {
      waBadge.textContent = stats.whatsapp.replies > 0 ? `🟢 ${stats.whatsapp.replies} REPLIED` : `⚪ 0 REPLIES`;
      waBadge.style.background = stats.whatsapp.replies > 0 ? 'rgba(37, 211, 102, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      waBadge.style.color = stats.whatsapp.replies > 0 ? '#4ade80' : '#94a3b8';
    }
    if (gmailBadge) {
      gmailBadge.textContent = stats.gmail.replies > 0 ? `🔴 ${stats.gmail.replies} REPLIED` : `⚪ 0 REPLIES`;
      gmailBadge.style.background = stats.gmail.replies > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      gmailBadge.style.color = stats.gmail.replies > 0 ? '#f87171' : '#94a3b8';
    }
    if (linkedinBadge) {
      linkedinBadge.textContent = stats.linkedin.replies > 0 ? `🔵 ${stats.linkedin.replies} REPLIED` : `⚪ 0 REPLIES`;
      linkedinBadge.style.background = stats.linkedin.replies > 0 ? 'rgba(10, 102, 194, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      linkedinBadge.style.color = stats.linkedin.replies > 0 ? '#60a5fa' : '#94a3b8';
    }
    if (instaBadge) {
      instaBadge.textContent = stats.instagram.replies > 0 ? `🟣 ${stats.instagram.replies} REPLIED` : `⚪ 0 REPLIES`;
      instaBadge.style.background = stats.instagram.replies > 0 ? 'rgba(225, 48, 108, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      instaBadge.style.color = stats.instagram.replies > 0 ? '#f472b6' : '#94a3b8';
    }
  },

  setupListeners() {
    // Channel filter clicks
    document.querySelectorAll('.reply-channel-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent trigger if clicking on the open inbox link
        if (e.target.closest('.open-inbox-link')) return;

        const channel = card.dataset.channel;
        if (this.activeFilter === channel) {
          this.activeFilter = null;
          card.classList.remove('active-filter');
        } else {
          document.querySelectorAll('.reply-channel-card').forEach(c => c.classList.remove('active-filter'));
          this.activeFilter = channel;
          card.classList.add('active-filter');
        }

        if (window.App && window.App.filterByChannel) {
          window.App.filterByChannel(this.activeFilter);
        }
      });
    });
  },

  /**
   * Simulates an incoming prospect reply and pushes alert to WhatsApp & UI
   */
  simulateIncomingReply(customLead = null) {
    let replyObj;
    if (customLead) {
      const platformName = customLead.channel === 'whatsapp' ? 'WhatsApp'
        : customLead.channel === 'linkedin' ? 'LinkedIn'
        : customLead.channel === 'instagram' ? 'Instagram'
        : 'Gmail';

      replyObj = {
        platform: platformName,
        channelKey: customLead.channel,
        businessName: customLead.businessName,
        city: customLead.city.split(',')[0],
        clientMessage: "Hey! Just saw your message regarding our mobile setup. How fast can you deliver this?",
        aiSuggestedReply: `Hi ${customLead.decisionMaker.split(' ')[0]}! We can have it live in 48 hours for $650 one-time. Can I share a quick 1-min preview video?`
      };
    } else {
      const availableLeads = (window.App && window.App.leads) || [];
      const randomLead = availableLeads[Math.floor(Math.random() * availableLeads.length)] || {
        channel: 'whatsapp',
        businessName: 'Master Biryani',
        city: 'Karachi',
        decisionMaker: 'Tariq Mehmood'
      };
      replyObj = {
        platform: randomLead.channel === 'whatsapp' ? 'WhatsApp' : randomLead.channel === 'gmail' ? 'Gmail' : randomLead.channel === 'linkedin' ? 'LinkedIn' : 'Instagram',
        channelKey: randomLead.channel || 'whatsapp',
        businessName: randomLead.businessName,
        city: (randomLead.city || '').split(',')[0],
        clientMessage: "Hi Fawwad, saw your note! How does this 1-tap mobile setup work?",
        aiSuggestedReply: `Hi ${randomLead.decisionMaker.split(' ')[0]}! It's a 1-tap direct mobile system ready in 48 hours for $650. Can I share a quick 1-min preview?`
      };
    }

    // Mark as unread
    replyObj.id = 'rep_' + Date.now();
    replyObj.receivedAt = new Date().toISOString();
    replyObj.isRead = false;

    // Save to storage
    const currentReplies = this.getRepliesData();
    currentReplies.unshift(replyObj);
    StorageService.saveReplies(currentReplies);

    // Re-render metrics
    this.renderStats();

    // Trigger Hindi/Urdu WhatsApp Alert format
    WhatsAppService.notifyIncomingReply(replyObj);

    // Open WhatsApp Alert Modal
    this.showWhatsAppAlertModal(replyObj);

    if (window.App) {
      window.App.showToast(`🚨 NAYA CLIENT REPLY AAYA HAI! (${replyObj.businessName} via ${replyObj.platform})`, 'success');
    }
  },

  showWhatsAppAlertModal(reply) {
    const modal = document.getElementById('whatsapp-alert-modal');
    if (!modal) return;

    document.getElementById('wa-modal-biz').textContent = `${reply.businessName} (${reply.city})`;
    document.getElementById('wa-modal-platform').textContent = reply.platform;
    document.getElementById('wa-modal-msg').textContent = `"${reply.clientMessage}"`;
    document.getElementById('wa-modal-ai-reply').textContent = `"${reply.aiSuggestedReply}"`;

    const fullWaText =
      `🚨 *NAYA CLIENT REPLY AAYA HAI!*\n` +
      `-----------------------------------\n` +
      `🏢 *Business:* ${reply.businessName} (${reply.city})\n` +
      `📡 *Platform:* ${reply.platform}\n` +
      `💬 *Gora Ka Message:*\n` +
      `"${reply.clientMessage}"\n` +
      `-----------------------------------\n` +
      `👉 *AI Suggested Reply (Copy & Paste):*\n` +
      `"${reply.aiSuggestedReply}"\n` +
      `-----------------------------------\n` +
      `⚡ *Action:* Jald az jald reply dein taake deal $650 par close ho sakay!`;

    const preEl = document.getElementById('wa-modal-full-text');
    if (preEl) preEl.textContent = fullWaText;

    // Actions
    const copyBtn = document.getElementById('wa-modal-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(reply.aiSuggestedReply);
        if (window.App) window.App.showToast('AI Suggested Reply copied to clipboard!', 'success');
      };
    }

    const sendBtn = document.getElementById('wa-modal-send-btn');
    if (sendBtn) {
      sendBtn.onclick = () => {
        const text = encodeURIComponent(fullWaText);
        window.open(`https://api.whatsapp.com/send?phone=923376568003&text=${text}`, '_blank');
      };
    }

    const closeBtn = document.getElementById('modal-wa-alert-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.remove('open');
      };
    }

    modal.classList.add('open');
  },

  openReplyThread(leadId) {
    const replies = this.getRepliesData();
    const lead = window.App ? window.App.leads.find(l => l.id === leadId) : null;
    const reply = replies.find(r => lead && r.businessName.includes(lead.businessName.split('(')[0].trim())) || replies[0];
    if (reply) {
      this.showWhatsAppAlertModal(reply);
    }
  },

  /**
   * Receives a real inquiry submitted by a prospect on the live showcase
   */
  receiveRealClientInquiry({ name, business, contact, message, niche }) {
    const replyObj = {
      id: 'rep_real_' + Date.now(),
      platform: 'Direct On-Page Inquiry',
      channelKey: 'whatsapp', // Maps to priority WhatsApp inbox
      businessName: business || `${name}'s Business`,
      city: 'Live Demo Prospect',
      clientMessage: `${message} (Contact Info: ${contact})`,
      aiSuggestedReply: `Hi ${name.split(' ')[0]}! Thanks for checking our live demo. Yes, we can deploy this 0% commission system on ${business || 'your business'} within 48 hours for $650 one-time. Can I send the setup details to ${contact}?`,
      receivedAt: new Date().toISOString(),
      isRead: false
    };

    const currentReplies = this.getRepliesData();
    currentReplies.unshift(replyObj);
    StorageService.saveReplies(currentReplies);
    this.renderStats();

    // Play chime sound
    if (window.WhatsAppService && WhatsAppService.playChime) {
      WhatsAppService.playChime();
    }

    if (window.App && window.App.showToast) {
      window.App.showToast(`🚨 NAYA CLIENT INQUIRY AAYA HAI! (${name} - ${business})`, 'success');
    }

    return replyObj;
  }
};

window.ReplyCenter = ReplyCenter;
