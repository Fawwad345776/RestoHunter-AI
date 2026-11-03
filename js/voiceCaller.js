/**
 * RestoHunter AI - Free AI Voice Call Simulator & Audio Pitch Player
 * 100% Free, zero-cost in-browser Speech Synthesis & Objection Handling Engine
 * Features:
 * - Natural Voice Pitch Synthesis (Web Speech API)
 * - Live Animated Waveform Visualizer
 * - Real-Time Objection Handling Sandbox
 * - Free Trial Guide & Webhook for Real Phone Calling (Vapi/Twilio $10 Free Credit)
 */

const VoiceCaller = {
  activeLead: null,
  isCalling: false,
  callTimerInterval: null,
  callSeconds: 0,
  speechSynth: window.speechSynthesis || null,
  currentUtterance: null,
  selectedVoice: null,
  selectedRate: 1.0,
  animFrameId: null,
  availableVoices: [],

  init() {
    if (this.speechSynth) {
      this.loadVoices();
      if (this.speechSynth.onvoiceschanged !== undefined) {
        this.speechSynth.onvoiceschanged = () => this.loadVoices();
      }
    }
  },

  loadVoices() {
    if (!this.speechSynth) return;
    const voices = this.speechSynth.getVoices();
    this.availableVoices = voices.filter(v => v.lang.startsWith('en'));
    if (this.availableVoices.length === 0) {
      this.availableVoices = voices;
    }

    const select = document.getElementById('voice-select-speaker');
    if (!select) return;

    select.innerHTML = '';
    this.availableVoices.forEach((v, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${v.name} (${v.lang})`;
      // Prefer high-quality English voices
      if (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Natural')) {
        opt.selected = true;
        this.selectedVoice = v;
      }
      select.appendChild(opt);
    });

    if (!this.selectedVoice && this.availableVoices.length > 0) {
      this.selectedVoice = this.availableVoices[0];
    }
  },

  changeVoice(idx) {
    if (this.availableVoices[idx]) {
      this.selectedVoice = this.availableVoices[idx];
      if (this.isCalling) {
        this.stopSpeaking();
        this.startCall();
      }
    }
  },

  changeRate(rate) {
    this.selectedRate = parseFloat(rate) || 1.0;
  },

  generateScript(lead) {
    if (!lead) return '';
    const bizName = lead.businessName || 'your business';
    const dmName = lead.decisionMaker || 'there';
    const city = lead.city || 'your area';
    const reviews = lead.reviews || 'many';
    const solidWp = lead.solidWeakPoint || {};
    const problem = solidWp.coreProblem || lead.flawTitle || 'order delivery leakage';
    const leak = solidWp.financialLeak || lead.flawLeakRange || 'substantial revenue';
    const solution = solidWp.solutionSoftware || 'custom mobile web application';
    const email = lead.email || 'your email';

    let firstName = dmName.split(' ')[0].replace('&', '').trim();
    if (!firstName || ['The', 'Mr.', 'Dr.'].includes(firstName)) {
      firstName = dmName;
    }

    return (
      `"Hi ${firstName}, this is Alex calling from MF Solutions regarding ${bizName} in ${city}.\n\n` +
      `I'm looking at your Google Maps listing right now — congratulations on over ${reviews} reviews, that's impressive!\n\n` +
      `The reason for my quick call is that our automated audit noticed an operational bottleneck with your ${problem.toLowerCase()}.\n\n` +
      `For a high-volume venue like yours, that typically bleeds around ${leak} in lost profit margins every single month.\n\n` +
      `We build direct ${solution.toLowerCase()} systems that completely plug this leak and capture 100% of customer orders directly.\n\n` +
      `I know you're super busy managing daily service, so I won't hold you. Could I shoot a quick 2-minute video walkthrough showing how this works to ${email}?"`
    );
  },

  openModal(lead) {
    this.activeLead = lead;
    this.stopSpeaking();
    this.resetTimer();

    // Populate Lead Top Strip
    const bizEl = document.getElementById('voice-modal-biz-name');
    if (bizEl) bizEl.textContent = lead.businessName;

    const locEl = document.getElementById('voice-modal-location');
    if (locEl) locEl.textContent = `📍 ${lead.address || (lead.city + ', ' + lead.country)}`;

    const dmEl = document.getElementById('voice-modal-dm');
    if (dmEl) dmEl.textContent = `${lead.decisionMaker || 'Owner'} (${lead.decisionMakerTitle || 'Principal'})`;

    const phoneEl = document.getElementById('voice-modal-phone');
    if (phoneEl) phoneEl.textContent = `📞 ${lead.phone || 'Verified Line'}`;

    // Populate Script
    const script = this.generateScript(lead);
    const scriptEl = document.getElementById('voice-call-script-content');
    if (scriptEl) scriptEl.textContent = script;

    // Load saved Vapi key if exists
    const savedKey = localStorage.getItem('vapi_public_api_key');
    const keyInput = document.getElementById('voice-vapi-key');
    if (keyInput && savedKey) {
      keyInput.value = savedKey;
    }

    // Reset tabs
    this.switchTab('player');

    // Show Modal
    const modal = document.getElementById('modal-voice-call-simulator');
    if (modal) modal.classList.add('open');

    // Initialize waveform
    this.drawIdleWaveform();
  },

  closeModal() {
    this.stopSpeaking();
    const modal = document.getElementById('modal-voice-call-simulator');
    if (modal) modal.classList.remove('open');
  },

  switchTab(tabName) {
    document.querySelectorAll('.voice-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.voice-tab-pane').forEach(p => p.style.display = 'none');

    const btn = document.getElementById(`tab-voice-${tabName}`);
    if (btn) btn.classList.add('active');

    const pane = document.getElementById(`pane-voice-${tabName}`);
    if (pane) pane.style.display = 'block';
  },

  toggleCall() {
    if (this.isCalling) {
      this.stopSpeaking();
    } else {
      this.startCall();
    }
  },

  startCall() {
    if (!this.speechSynth) {
      if (window.App && window.App.showToast) {
        window.App.showToast('Speech synthesis not supported in this browser.', 'warn');
      }
      return;
    }

    const scriptText = this.generateScript(this.activeLead).replace(/"/g, '');
    this.isCalling = true;
    this.startTimer();

    // UI Updates
    const statusPill = document.getElementById('voice-call-status-pill');
    if (statusPill) {
      statusPill.innerHTML = '<span class="voice-active-indicator"></span> 📞 CALL CONNECTED (LIVE AI VOICE)';
      statusPill.style.background = 'rgba(16, 185, 129, 0.2)';
      statusPill.style.color = '#6ee7b7';
      statusPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    }

    const btnText = document.getElementById('btn-voice-start-text');
    if (btnText) btnText.textContent = 'End Voice Call';

    const btnCall = document.getElementById('btn-voice-start-call');
    if (btnCall) {
      btnCall.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    }

    this.startWaveformAnimation();

    // Speak Text
    this.currentUtterance = new SpeechSynthesisUtterance(scriptText);
    if (this.selectedVoice) this.currentUtterance.voice = this.selectedVoice;
    this.currentUtterance.rate = this.selectedRate || 1.0;
    this.currentUtterance.pitch = 1.0;

    this.currentUtterance.onend = () => {
      this.onCallComplete();
    };

    this.currentUtterance.onerror = () => {
      this.stopSpeaking();
    };

    this.speechSynth.cancel(); // Stop any pending speech
    this.speechSynth.speak(this.currentUtterance);
  },

  onCallComplete() {
    this.isCalling = false;
    this.stopTimer();
    this.stopWaveformAnimation();
    this.drawIdleWaveform();

    const statusPill = document.getElementById('voice-call-status-pill');
    if (statusPill) {
      statusPill.innerHTML = '✅ CALL COMPLETED (PROSPECT REACHED)';
      statusPill.style.background = 'rgba(56, 189, 248, 0.2)';
      statusPill.style.color = '#38bdf8';
      statusPill.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    }

    const btnText = document.getElementById('btn-voice-start-text');
    if (btnText) btnText.textContent = 'Replay Voice Call';

    const btnCall = document.getElementById('btn-voice-start-call');
    if (btnCall) {
      btnCall.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
  },

  stopSpeaking() {
    if (this.speechSynth) {
      this.speechSynth.cancel();
    }
    this.isCalling = false;
    this.stopTimer();
    this.stopWaveformAnimation();
    this.drawIdleWaveform();

    const statusPill = document.getElementById('voice-call-status-pill');
    if (statusPill) {
      statusPill.innerHTML = '📴 READY TO CALL';
      statusPill.style.background = 'rgba(245, 158, 11, 0.2)';
      statusPill.style.color = '#fbbf24';
      statusPill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    }

    const btnText = document.getElementById('btn-voice-start-text');
    if (btnText) btnText.textContent = 'Start Free AI Voice Call';

    const btnCall = document.getElementById('btn-voice-start-call');
    if (btnCall) {
      btnCall.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
  },

  startTimer() {
    this.callSeconds = 0;
    const timerEl = document.getElementById('voice-call-timer');
    if (timerEl) timerEl.textContent = '00:00';

    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    this.callTimerInterval = setInterval(() => {
      this.callSeconds++;
      const mins = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
      const secs = String(this.callSeconds % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  },

  stopTimer() {
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }
  },

  resetTimer() {
    this.stopTimer();
    this.callSeconds = 0;
    const timerEl = document.getElementById('voice-call-timer');
    if (timerEl) timerEl.textContent = '00:00';
  },

  // -------------------------------------------------------------
  // OBJECTION HANDLING SIMULATOR
  // -------------------------------------------------------------
  handleObjection(type) {
    if (!this.activeLead) return;
    const lead = this.activeLead;
    const email = lead.email || 'your email';
    const solidWp = lead.solidWeakPoint || {};
    const leak = solidWp.financialLeak || lead.flawLeakRange || '$3,000/mo';
    const bizName = lead.businessName || 'your business';
    const city = lead.city || 'your area';

    let objectionLabel = '';
    let responseText = '';

    switch (type) {
      case 'busy':
        objectionLabel = 'Client: "I\'m too busy right now / In lunch rush"';
        responseText = `I completely understand, you've got service to run! What's the best email to shoot a 60-second summary so you can review it whenever you have a free moment tonight?`;
        break;
      case 'email':
        objectionLabel = 'Client: "Send me an email first"';
        responseText = `Already queued up to ${email} right now! Please keep an eye out for a quick email from MF Solutions regarding ${bizName}. Have a wonderful and profitable service tonight!`;
        break;
      case 'price':
        objectionLabel = 'Client: "How much does it cost?"';
        responseText = `We charge zero upfront setup for established restaurants like yours; it typically pays for itself within the first 14 days by eliminating your ${leak} leakage. Shall I email the exact pricing tier?`;
        break;
      case 'system':
        objectionLabel = 'Client: "We already have a system in place"';
        responseText = `Most high-volume venues we work with did too, until they saw they were still losing ${leak} in third-party fees. Our software integrates directly alongside your current setup with zero downtime or disruption.`;
        break;
      case 'who':
        objectionLabel = 'Client: "Who are you and where did you get my number?"';
        responseText = `I'm Alex from MF Solutions. I came across ${bizName}'s verified Google Maps listing while doing our weekly regional tech audit here in ${city}.`;
        break;
      default:
        return;
    }

    // Append to Dialogue History
    const diagBox = document.getElementById('voice-objection-dialogue');
    if (diagBox) {
      const entry = document.createElement('div');
      entry.style.marginBottom = '12px';
      entry.innerHTML = `
        <div style="font-weight: 700; color: #fca5a5; font-size: 0.78rem;">${objectionLabel}</div>
        <div style="color: #6ee7b7; font-weight: 600; margin-top: 3px; font-size: 0.82rem; background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 6px 10px; border-radius: 4px;">
          🤖 AI Caller: "${responseText}"
        </div>
      `;
      diagBox.appendChild(entry);
      diagBox.scrollTop = diagBox.scrollHeight;
    }

    // Speak AI Response
    if (this.speechSynth) {
      this.speechSynth.cancel();
      const utt = new SpeechSynthesisUtterance(responseText);
      if (this.selectedVoice) utt.voice = this.selectedVoice;
      utt.rate = this.selectedRate || 1.0;
      this.speechSynth.speak(utt);
    }
  },

  // -------------------------------------------------------------
  // REAL PHONE CALL FREE TRIAL INTEGRATION
  // -------------------------------------------------------------
  saveCredentials() {
    const keyInput = document.getElementById('voice-vapi-key');
    if (!keyInput) return;
    const key = keyInput.value.trim();
    if (!key) {
      if (window.App) window.App.showToast('Please enter your Vapi Public Key', 'warn');
      return;
    }
    localStorage.setItem('vapi_public_api_key', key);
    if (window.App) window.App.showToast('✅ Vapi Free Trial Key saved! Real phone dialing enabled.', 'success');
  },

  testDialRealNumber() {
    const key = localStorage.getItem('vapi_public_api_key');
    const phone = this.activeLead ? this.activeLead.phone : '';

    if (!phone) {
      if (window.App) window.App.showToast('No phone number available for this lead', 'warn');
      return;
    }

    if (!key) {
      // Direct Click-to-Call fallback (FaceTime / Skype / Phone Dialer)
      if (window.App) {
        window.App.showToast(`💡 Tip: Vapi key nahi hai to direct apne phone/Skype se call karne ke liye dialer khol rahe hain...`, 'info');
      }
      setTimeout(() => {
        window.open(`tel:${phone.replace(/\s+/g, '')}`, '_self');
      }, 800);
      return;
    }

    if (window.App) {
      window.App.showToast(`📞 AI Agent is placing live call to ${phone} via Vapi Free Trial ($10 Credit)...`, 'success');
    }

    const script = this.generateScript(this.activeLead);
    const bizName = this.activeLead.businessName || 'the venue';

    // Call Vapi Outbound Phone API
    fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: {
          number: phone.replace(/[^+\d]/g, '')
        },
        assistant: {
          firstMessage: `Hi, this is Alex from MF Solutions calling regarding ${bizName}. Hope I caught you at a good time?`,
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are Alex, an expert B2B restaurant software sales rep for MF Solutions. You are calling ${bizName}. Script reference: ${script}. Goal: Be polite, concise (under 60s), mention their weak point, and ask to email a 2-minute video walkthrough to ${this.activeLead.email}. Handle objections calmly.`
              }
            ]
          },
          voice: 'jennifer'
        }
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data && (data.id || data.status)) {
        if (window.App) window.App.showToast(`🚀 Call ringing at ${phone}! Call ID: ${data.id || 'Live'}`, 'success');
      } else if (data && data.message) {
        if (window.App) window.App.showToast(`Vapi Notice: ${data.message}`, 'warn');
      }
    })
    .catch(err => {
      console.error('Vapi Call Error:', err);
      if (window.App) window.App.showToast(`Dialer ready. Opening system dialer for ${phone}`, 'info');
      window.open(`tel:${phone.replace(/\s+/g, '')}`, '_self');
    });
  },

  copyScript() {
    const script = this.generateScript(this.activeLead);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(script).then(() => {
        if (window.App) window.App.showToast('📋 AI Phone Script copied to clipboard!', 'success');
      });
    }
  },

  // -------------------------------------------------------------
  // ANIMATED WAVEFORM CANVAS
  // -------------------------------------------------------------
  drawIdleWaveform() {
    const canvas = document.getElementById('voice-waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  },

  startWaveformAnimation() {
    const canvas = document.getElementById('voice-waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    const animate = () => {
      if (!this.isCalling) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const numBars = 36;
      const barWidth = canvas.width / numBars - 2;

      for (let i = 0; i < numBars; i++) {
        const heightFactor = Math.sin(phase + i * 0.3) * 0.5 + 0.5;
        const barHeight = Math.max(4, heightFactor * (canvas.height - 12));
        const x = i * (barWidth + 2);
        const y = (canvas.height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#8b5cf6');
        grad.addColorStop(0.5, '#38bdf8');
        grad.addColorStop(1, '#10b981');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      phase += 0.15;
      this.animFrameId = requestAnimationFrame(animate);
    };

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    animate();
  },

  stopWaveformAnimation() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
};

// Auto-initialize when window loads
if (typeof window !== 'undefined') {
  window.VoiceCaller = VoiceCaller;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VoiceCaller.init());
  } else {
    VoiceCaller.init();
  }
}
