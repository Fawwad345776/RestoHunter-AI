/**
 * SoftHunter AI - Multi-Channel & Multi-Stage AI Pitch Engine
 * Channels: Gmail / Email, WhatsApp, Instagram DM, LinkedIn, Facebook Messenger
 * Stages: Initial Pitch, Follow-up 1, Follow-up 2, Follow-up 3, Final Follow-up, Demo Invitation, Proposal Introduction
 * Languages: English (default), Urdu, Spanish, Arabic, German, French
 */

const PitchEngine = {
  getGreetingName(lead, mode = 'team') {
    if (!lead) return 'there';
    if (mode === 'team') {
      if (lead.teamGreeting && lead.teamGreeting.trim()) return lead.teamGreeting.trim();
      let rawBiz = (lead.businessName || '').split('(')[0].trim();
      let bizClean = rawBiz.replace(/Restaurant|Cafe|Bistro|Lounge|Bakery|Dhaba|Hotel|Saloon|Salon|Spa|Clinic|Grill|Karahi|Barbecue|BBQ|Steakhouse/gi, '').trim();
      return `Team ${bizClean || rawBiz}`;
    }
    if (lead.founderGreeting && lead.founderGreeting.trim()) return lead.founderGreeting.trim();
    if (!lead.decisionMaker) return this.getGreetingName(lead, 'team');
    let dm = lead.decisionMaker.trim().replace(/^(haji|syed|sardar|ch|muhammad|mohammad)\s+/i, '').trim();
    return dm.split(/\s+/)[0] || this.getGreetingName(lead, 'team');
  },

  detectDeliveryPlatform(lead) {
    if (lead && lead.regionDeliveryApps) return lead.regionDeliveryApps;
    const loc = `${lead?.country || ''} ${lead?.city || ''} ${lead?.address || ''}`.toLowerCase();
    if (/pakistan|karachi|lahore|islamabad/i.test(loc)) return 'foodpanda';
    if (/uae|dubai|abu dhabi|riyadh|saudi/i.test(loc)) return 'Talabat & Deliveroo';
    if (/uk|london|manchester/i.test(loc)) return 'Deliveroo & Just Eat';
    if (/canada|toronto/i.test(loc)) return 'SkipTheDishes & DoorDash';
    if (/australia|sydney/i.test(loc)) return 'Uber Eats & Menulog';
    return 'DoorDash & Uber Eats';
  },

  /**
   * Picks the sentence variants that bring the first email closest to 48 words (target: 45-50).
   * Keep in sync with buildShortPitch_ in apps-script/Code.gs and build_short_pitch in scripts/outreach_engine.py.
   */
  buildShortPitch(first, biz, city, problem, leak) {
    const name = biz.replace(/\s*\([^)]*\)/g, '').trim() || biz;
    const issue = String(problem || '').split(' ').map(w => /^[A-Z0-9&]{2,}[a-z]?$/.test(w) ? w : w.toLowerCase()).join(' ').replace(/\.+$/, '');
    const cost = String(leak || '').split('(')[0].trim().replace(/\s*[–-]\s*/g, '–');
    // No issue found for a lead: ask a question instead of claiming one.
    const opens = issue ? [
      `While looking into ${name} online, I noticed a possible issue: ${issue}.`,
      `Looking at ${name} online, I noticed a possible issue: ${issue}.`,
      `I noticed a possible issue at ${name}: ${issue}.`
    ] : [
      `I came across ${name} online and had a quick question: is your website bringing in as many enquiries as it could?`,
      `Quick question about ${name}: is your website bringing in as many enquiries as it could?`
    ];
    // No proven figure for a lead: say so in general terms instead of quoting a number.
    const costs = !issue ? [''] : cost
      ? [`This typically costs businesses like yours around ${cost}.`, `This typically costs around ${cost}.`]
      : ['Issues like this usually cost businesses enquiries.', 'This usually costs enquiries.'];
    const fixes = issue
      ? ['We build custom systems that fix this and keep revenue direct.', 'We build systems that fix this directly.', 'We fix this directly.']
      : ['We build websites and booking systems that turn more visitors into customers.', 'We help businesses get more enquiries from their website.', 'We help with exactly that.'];
    const asks = ['Would you be open to a 2-minute video walkthrough?', 'Open to a 2-minute video walkthrough?'];
    const stops = ["If you're not interested, just reply 'stop'.", "Not interested? Reply 'stop'."];

    let best = '';
    let bestScore = Infinity;
    opens.forEach(o => costs.forEach(c => fixes.forEach(f => asks.forEach(a => stops.forEach(s => {
      const body = `Hi ${first},\n\n${[o, c].filter(Boolean).join(' ')}\n\n${f} ${a}\n\n${s}`;
      const score = Math.abs(body.trim().split(/\s+/).length - 48);
      if (score < bestScore) { best = body; bestScore = score; }
    })))));
    return best;
  },

  /**
   * Generates a channel-specific and sequence-stage personalized pitch
   */
  generatePitch(lead, channel = 'whatsapp', stage = 'initial', language = 'English') {
    if (!lead) return { subject: '', body: '', channel, stage, language };

    const biz = lead.businessName || 'Your Business';
    const dm = lead.decisionMaker || 'Owner';
    const teamGreeting = this.getGreetingName(lead, 'team');
    const founderGreeting = this.getGreetingName(lead, 'founder');
    const flaw = lead.flawTitle || 'Mobile Checkout Friction';
    const solution = (lead.softwareOpportunity && lead.softwareOpportunity.recommendedSoftware) || lead.deliverableSolution || 'Direct Mobile Web App';
    const leak = lead.flawLeakRange || '$2,400 - $4,800/mo';
    const senderCompany = 'MF Software Solutions';

    let subject = '';
    let body = '';

    // ==========================================
    // 1. GMAIL / EMAIL CHANNEL (100% Ban-Safe 3-Stage Threaded Copy)
    // ==========================================
    if (channel === 'gmail' || channel === 'email') {
      const optOut = "\n\nNot interested? Reply 'stop'.";
      const shortName = biz.replace(/\s*\([^)]*\)/g, '').trim() || biz;
      const emailProblem = (lead.solidWeakPoint && lead.solidWeakPoint.coreProblem) || lead.flawTitle || '';
      const emailLeak = (lead.solidWeakPoint && lead.solidWeakPoint.financialLeak) || lead.flawLeakRange || '';

      if (stage === 'initial') {
        subject = `Quick observation regarding ${biz} direct revenue funnel`;
        body = this.buildShortPitch(founderGreeting || teamGreeting, biz, lead.city || 'your city', emailProblem, emailLeak);
      } else if (stage === 'followup1') {
        subject = `Re: Quick observation regarding ${biz} direct revenue funnel`;
        body = `Hi ${founderGreeting || teamGreeting},

Floating this back up in case it got buried.

Still open to a 2-minute video walkthrough on ${emailProblem ? 'fixing this' : 'getting more enquiries'} for ${shortName}?${optOut}`;
      } else if (stage === 'followup2' || stage === 'final') {
        subject = `Re: Quick observation regarding ${biz} direct revenue funnel`;
        body = `Hi ${founderGreeting || teamGreeting},

I won't follow up again. If ${emailProblem ? emailProblem.toLowerCase() : 'getting more from your website'} ever becomes a priority, just reply here.

Wishing ${shortName} continued success!`;
      } else if (stage === 'demo') {
        subject = `Interactive Demo: ${biz} Custom Software`;
        body = `Hi ${founderGreeting || teamGreeting},

As promised, we prepared an interactive demo concept of the ${solution} for ${biz}.

It demonstrates how a customer on a smartphone books in under 25 seconds with instant confirmation.

Let me know if you'd like me to send over the direct demo link.

Best regards,
${senderCompany}`;
      } else if (stage === 'proposal') {
        subject = `Project Proposal: ${biz} — ${solution}`;
        body = `Dear ${founderGreeting || teamGreeting},

Attached is our formal project proposal for deploying a custom ${solution} for ${biz}.

Scope includes full mobile optimization, automated customer confirmation slips, admin management dashboard, and zero-commission checkout.

Looking forward to your review and feedback.

Sincerely,
${senderCompany} Executive Team`;
      } else {
        subject = `Re: Quick observation regarding ${biz} direct revenue funnel`;
        body = `Hi ${founderGreeting || teamGreeting},

Following up on my previous note regarding ${biz}'s digital ordering setup.

Let me know if taking a quick look at the video makes sense for your team.${optOut}`;
      }
    }

    // ==========================================
    // 2. WHATSAPP CHANNEL
    // ==========================================
    else if (channel === 'whatsapp') {
      if (stage === 'initial') {
        body = `Assalam-o-Alaikum ${founderGreeting || teamGreeting}! 

Noticed customers browsing ${biz} on smartphones run into ${flaw.toLowerCase()}.

We build custom *${solution}* so customers can order / book directly in 1-tap with zero commission.

Can I drop a 30-sec video demo here for your team to check out?`;
      } else if (stage === 'followup1') {
        body = `Hi ${founderGreeting}! Just following up on my previous message regarding the mobile ordering funnel for ${biz}. Would love to share a quick 20-second screen recording if you have a minute.`;
      } else if (stage === 'followup2') {
        body = `Hey ${founderGreeting}! Did you know local businesses typically lose ~${leak} when customers can't book directly on mobile? We built a 1-tap prototype for ${biz} — happy to send it here.`;
      } else if (stage === 'followup3') {
        body = `Hi ${founderGreeting}! We have the interactive prototype ready for ${biz}. Shows how orders come directly to your counter WhatsApp in real-time. Mind if I send the link?`;
      } else if (stage === 'final') {
        body = `Hi ${founderGreeting}, will assume this isn't a priority right now. Won't message further. Wishing ${biz} great sales this month! Feel free to ping anytime.`;
      } else if (stage === 'demo') {
        body = `Hi ${founderGreeting}! Here is the interactive demo concept for ${biz}: 1-tap mobile booking with instant WhatsApp confirmation. Can I send the preview over?`;
      } else {
        body = `Hi ${founderGreeting}! We have drafted the proposal for ${biz}'s custom ${solution}. Ready to review whenever convenient for you.`;
      }
    }

    // ==========================================
    // 3. INSTAGRAM DM CHANNEL
    // ==========================================
    else if (channel === 'instagram') {
      if (stage === 'initial') {
        body = `Hey ${teamGreeting}! Love your page and content 🔥 

Quick heads up: noticed visitors checking your bio link on mobile run into ${flaw.toLowerCase()}.

We build 1-tap *${solution}* that gets you direct orders without losing 30% to delivery apps.

Mind if I drop a 20-sec demo recording here to see what you think?`;
      } else if (stage === 'followup1') {
        body = `Hey team! Just bumping this in case it got buried in your DMs. Would love to show you how ${biz} can get direct mobile orders. Let me know! 🙌`;
      } else if (stage === 'followup2') {
        body = `Hey ${teamGreeting}! Dropping a quick note — businesses similar to ${biz} recover around ${leak} with a 1-tap mobile funnel. Happy to share a quick preview!`;
      } else if (stage === 'followup3') {
        body = `Hey guys! Finished a quick clickable demo for ${biz}. Zero commissions, instant confirmation. Mind if I drop the link here?`;
      } else if (stage === 'final') {
        body = `Hey team! Won't spam your DMs further. Keep up the awesome posts with ${biz}! If you ever want to upgrade your direct bio funnel, we're here. Cheers!`;
      } else {
        body = `Hey team! Demo concept for ${biz} is ready. Let us know if you'd like to check out the mobile walkthrough!`;
      }
    }

    // ==========================================
    // 4. LINKEDIN CHANNEL (<300 characters)
    // ==========================================
    else if (channel === 'linkedin') {
      if (stage === 'initial') {
        body = `Hi ${dm}, noticed ${biz} could recover an estimated ${leak} by fixing ${flaw.toLowerCase()}. We develop custom ${solution} with zero third-party commissions. Open to a brief 2-min review?`;
      } else if (stage === 'followup1') {
        body = `Hi ${dm}, following up on my previous note about ${biz}'s mobile conversion. Happy to share a 30-sec demo whenever convenient.`;
      } else if (stage === 'followup2') {
        body = `Hi ${dm}, we mapped a solution recovering ${leak} for ${biz} via direct mobile checkout. Would a brief conversation make sense?`;
      } else {
        body = `Hi ${dm}, closing the loop regarding ${biz}. Wishing you continued success, and happy to connect whenever direct software becomes a focus.`;
      }
    }

    // ==========================================
    // 5. FACEBOOK MESSENGER
    // ==========================================
    else {
      body = `Hello ${teamGreeting}! 

We came across ${biz} on Google Maps and noticed customers on smartphones encounter ${flaw.toLowerCase()}.

We develop custom ${solution} allowing your customers to book directly with zero third-party commission deductions.

Would your team be open to a 30-second demo showing how it works?`;
    }

    // Translate to Roman Urdu if selected
    if (language === 'Urdu') {
      if (channel === 'whatsapp' || channel === 'instagram') {
        body = `Assalam-o-Alaikum ${founderGreeting || teamGreeting}!

Aapke ${biz} ka Google profile dekha. Mobile par customer jab check karta hai toh ${lead.specificWeakness || flaw.toLowerCase()} ka masla aata hai.

Hum direct *${solution}* lagatay hain jahan customer 1-click me order bhej deta hai aur delivery apps ko 30% commission nahi dena parta.

Kya mai 30-second ki short video demo yahan share karoon aapki team ke liye?`;
      }
    }

    return {
      subject,
      body,
      channel,
      stage,
      language,
      rawPitch: body
    };
  }
};

if (typeof window !== 'undefined') {
  window.PitchEngine = PitchEngine;
}
