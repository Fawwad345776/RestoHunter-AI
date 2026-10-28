/**
 * RestoHunter AI - Live Reply Center & Real-Time Inbox Coordinator
 * Channels: WhatsApp Direct, Gmail, LinkedIn, Instagram
 */

const SAMPLE_CLIENT_REPLIES = [
  {
    platform: 'WhatsApp',
    channelKey: 'whatsapp',
    businessName: 'Copper Pot Bistro',
    city: 'London',
    clientMessage: "Hi Fawwad, saw your WhatsApp note! Does this 0% commission direct menu work on both iPhones and Androids without downloading an app?",
    aiSuggestedReply: "Hi Oliver! Yes, 100% works on any mobile browser instantly. Diners don't need to download anything. Ready to preview the London setup?"
  },
  {
    platform: 'LinkedIn',
    channelKey: 'linkedin',
    businessName: 'Dr. Elena Dental',
    city: 'Miami',
    clientMessage: "Hey! Sounds interesting. How much do you charge for this?",
    aiSuggestedReply: "Hi Dr. Elena! It's $650 one-time, ready in 48 hours. Can I share a quick 1-min preview video?"
  },
  {
    platform: 'Gmail',
    channelKey: 'gmail',
    businessName: 'Artisan Trattoria',
    city: 'Austin',
    clientMessage: "We've been getting killed by DoorDash fees. Does this integrate with our current Clover POS?",
    aiSuggestedReply: "Hi Chef Marcus! Yes, 100% integrates directly with Clover & Toast. You save roughly $3,200/mo in commissions right away. Mind if I send the 45s setup video?"
  },
  {
    platform: 'WhatsApp',
    channelKey: 'whatsapp',
    businessName: 'Beacon Physical Therapy',
    city: 'Sydney',
    clientMessage: "Our front desk is overwhelmed with phone bookings. Can this patient calendar sync with Cliniko?",
    aiSuggestedReply: "Hi Sarah! Yes, it integrates directly with Cliniko & Google Calendar. Patients can book in 30 seconds 24/7. Mind if I send the 1-min screen recording?"
  },
  {
    platform: 'Instagram',
    channelKey: 'instagram',
    businessName: 'Velvet Lounge Hair Studio',
    city: 'London',
    clientMessage: "OMG our no-shows this Saturday were awful. How does the automated SMS reminder work?",
    aiSuggestedReply: "Hey Sarah! It sends a 2-way confirmation 24h & 2h before the appointment, cutting no-shows by 85%. I can set it up on your chairs this afternoon — can I send the demo?"
  },
  {
    platform: 'Gmail',
    channelKey: 'gmail',
    businessName: 'ProGuard Roofing',
    city: 'Dallas',
    clientMessage: "Can this quote calculator handle storm damage insurance claims estimates too?",
    aiSuggestedReply: "Hi David! Yes, it includes instant storm deductible calculators. Can generate 5-8 extra emergency leads per storm. Want to see the 1-min screen recording?"
  },
  {
    platform: 'LinkedIn',
    channelKey: 'linkedin',
    businessName: 'The Rosemary Boutique Inn',
    city: 'Toronto',
    clientMessage: "We give Expedia over $6,000 every single month. Would love to see your direct booking concept.",
    aiSuggestedReply: "Hi Amanda! That's exactly what our direct VIP engine eliminates. I made a 1-min personalized preview for Rosemary Inn here: https://fawwad345776.github.io/RestoHunter-AI/?v=3.1. Let me know what you think!"
  }
];

const ReplyCenter = {
  activeFilter: null,

  init() {
    this.renderStats();
    this.setupListeners();
  },

  getRepliesData() {
    let replies = StorageService.getReplies();
    if (!replies || replies.length === 0) {
      replies = [...SAMPLE_CLIENT_REPLIES];
      StorageService.saveReplies(replies);
    }
    return replies;
  },

  renderStats() {
    const replies = this.getRepliesData();
    const stats = {
      whatsapp: { total: 0, unread: 0 },
      gmail: { total: 0, unread: 0 },
      linkedin: { total: 0, unread: 0 },
      instagram: { total: 0, unread: 0 }
    };

    replies.forEach(r => {
      const ch = r.channelKey;
      if (stats[ch]) {
        stats[ch].total++;
        if (!r.isRead) stats[ch].unread++;
      }
    });

    // Provide lively defaults if fresh
    if (stats.whatsapp.total === 0) {
      stats.whatsapp = { total: 25, unread: 6 };
      stats.gmail = { total: 25, unread: 7 };
      stats.linkedin = { total: 25, unread: 2 };
      stats.instagram = { total: 25, unread: 5 };
    }

    // Update DOM badges
    const waBadge = document.getElementById('whatsapp-unread-badge');
    const waTotal = document.getElementById('whatsapp-total-count');
    const gmailBadge = document.getElementById('gmail-unread-badge');
    const gmailTotal = document.getElementById('gmail-total-count');
    const linkedinBadge = document.getElementById('linkedin-unread-badge');
    const linkedinTotal = document.getElementById('linkedin-total-count');
    const instaBadge = document.getElementById('instagram-unread-badge');
    const instaTotal = document.getElementById('instagram-total-count');

    if (waBadge) waBadge.textContent = `🟢 ${stats.whatsapp.unread} NEW`;
    if (waTotal) waTotal.textContent = stats.whatsapp.total;
    if (gmailBadge) gmailBadge.textContent = `🔴 ${stats.gmail.unread} NEW`;
    if (gmailTotal) gmailTotal.textContent = stats.gmail.total;
    if (linkedinBadge) linkedinBadge.textContent = `🔴 ${stats.linkedin.unread} NEW`;
    if (linkedinTotal) linkedinTotal.textContent = stats.linkedin.total;
    if (instaBadge) instaBadge.textContent = `🔴 ${stats.instagram.unread} NEW`;
    if (instaTotal) instaTotal.textContent = stats.instagram.total;
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
      const samples = SAMPLE_CLIENT_REPLIES;
      replyObj = samples[Math.floor(Math.random() * samples.length)];
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
