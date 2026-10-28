/**
 * RestoHunter AI - Live Reply Center & Real-Time Inbox Coordinator
 */

const SAMPLE_CLIENT_REPLIES = [
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
    if (stats.gmail.total === 0) {
      stats.gmail = { total: 28, unread: 7 };
      stats.linkedin = { total: 11, unread: 2 };
      stats.instagram = { total: 19, unread: 5 };
    }

    // Update DOM badges
    const gmailBadge = document.getElementById('gmail-unread-badge');
    const gmailTotal = document.getElementById('gmail-total-count');
    const linkedinBadge = document.getElementById('linkedin-unread-badge');
    const linkedinTotal = document.getElementById('linkedin-total-count');
    const instaBadge = document.getElementById('instagram-unread-badge');
    const instaTotal = document.getElementById('instagram-total-count');

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
      replyObj = {
        platform: customLead.channel === 'linkedin' ? 'LinkedIn' : customLead.channel === 'instagram' ? 'Instagram' : 'Gmail',
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

    // Trigger WhatsApp notification & audio alert
    const alertResult = WhatsAppService.sendWhatsAppAlert(replyObj);

    // Show modal
    this.showReplyModal(replyObj, alertResult);
    this.renderStats();
  },

  showReplyModal(replyData, alertResult) {
    const modal = document.getElementById('whatsapp-alert-modal');
    if (!modal) return;

    document.getElementById('wa-modal-biz').textContent = `${replyData.businessName} (${replyData.city})`;
    document.getElementById('wa-modal-platform').textContent = replyData.platform;
    document.getElementById('wa-modal-msg').textContent = `"${replyData.clientMessage}"`;
    document.getElementById('wa-modal-ai-reply').textContent = `"${replyData.aiSuggestedReply}"`;
    document.getElementById('wa-modal-full-text').textContent = alertResult.message;

    const sendBtn = document.getElementById('wa-modal-send-btn');
    if (sendBtn) {
      sendBtn.onclick = () => {
        window.open(alertResult.whatsappUrl, '_blank');
      };
    }

    const copyBtn = document.getElementById('wa-modal-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(replyData.aiSuggestedReply);
        if (window.App) window.App.showToast('Copied AI Suggested Reply to clipboard!', 'success');
      };
    }

    modal.classList.add('open');
  }
};

window.ReplyCenter = ReplyCenter;
