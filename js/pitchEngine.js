/**
 * RestoHunter AI - Pitch Generation Engine
 * Clean, high-converting direct outreach messages without external preview links or distractions.
 * Channels: WhatsApp Direct, LinkedIn (<300 chars), Instagram Story Reply, Gmail (4-sentence curiosity).
 */

const PitchEngine = {
  /**
   * Smart greeting parser supporting dual modes:
   * 1. 'team' (default for WhatsApp/Instagram): 100% natural and courteous for floor managers & social media staff.
   * 2. 'founder': Addresses the registered founder or partner directly for executive proposals and LinkedIn.
   */
  getGreetingName(lead, mode = 'team') {
    if (!lead) return 'there';

    // Team mode (Safe, natural, zero doubt)
    if (mode === 'team') {
      if (lead.teamGreeting && lead.teamGreeting.trim()) {
        return lead.teamGreeting.trim();
      }
      let rawBiz = (lead.businessName || '').split('(')[0].trim();
      let bizClean = rawBiz.replace(/Restaurant|Cafe|Bistro|Lounge|Bakery|Dhaba|Hotel|Saloon|Salon|Spa|Clinic|Grill|Karahi|Barbecue|BBQ|Steakhouse/gi, '').trim();
      return `Team ${bizClean || rawBiz}`;
    }

    // Founder mode
    if (lead.founderGreeting && lead.founderGreeting.trim()) {
      return lead.founderGreeting.trim();
    }

    if (!lead.decisionMaker) return this.getGreetingName(lead, 'team');
    let dm = lead.decisionMaker.trim();

    // Strip corporate or family suffixes
    dm = dm.replace(/&\s*(family|directors|partners|sons|brothers|group|board).*/i, '').trim();
    dm = dm.replace(/\s+(family|group|directors|partners|board|heirs)$/i, '').trim();

    if (dm.includes(' & ')) {
      const parts = dm.split(' & ').map(p => {
        let seg = p.trim().replace(/^(haji|syed|sardar|ch|dr\.|chef)\s+/i, '').split(/\s+/)[0];
        return seg;
      });
      return parts.filter(Boolean).join(' & ') || this.getGreetingName(lead, 'team');
    }

    if (/^(dr\.|chef)\s+/i.test(dm)) {
      const tokens = dm.split(/\s+/);
      return `${tokens[0]} ${tokens[1] || ''}`.trim();
    }

    let clean = dm.replace(/^(haji|syed|sardar|ch|muhammad|mohammad)\s+/i, '').trim();
    let first = clean.split(/\s+/)[0];
    return first || dm.split(/\s+/)[0] || this.getGreetingName(lead, 'team');
  },

  /**
   * Automatically detects the primary food delivery platform based on lead country, city, and address
   */
  detectDeliveryPlatform(lead) {
    if (lead && lead.regionDeliveryApps && lead.regionDeliveryApps.trim().length > 0) {
      return lead.regionDeliveryApps;
    }
    const loc = `${lead?.country || ''} ${lead?.city || ''} ${lead?.address || ''}`.toLowerCase();

    // Pakistan & South Asia -> foodpanda
    if (/pakistan|karachi|lahore|islamabad|rawalpindi|peshawar|faisalabad|multan|quetta|sialkot|gujranwala|hyderabad/i.test(loc)) {
      return 'foodpanda';
    }

    // United Arab Emirates, Gulf & Middle East -> Talabat & Deliveroo
    if (/uae|emirates|dubai|abu dhabi|sharjah|qatar|doha|riyadh|jeddah|saudi|kuwait|bahrain|oman/i.test(loc)) {
      return 'Talabat & Deliveroo';
    }

    // United Kingdom & Ireland -> Deliveroo & Just Eat
    if (/uk|united kingdom|london|manchester|birmingham|leeds|glasgow|edinburgh|liverpool|bristol|ireland|dublin|belfast/i.test(loc)) {
      return 'Deliveroo & Just Eat';
    }

    // Canada -> SkipTheDishes & DoorDash
    if (/canada|toronto|vancouver|montreal|calgary|edmonton|ottawa/i.test(loc)) {
      return 'SkipTheDishes & DoorDash';
    }

    // Australia & New Zealand -> Uber Eats & Menulog
    if (/australia|sydney|melbourne|brisbane|perth|adelaide|new zealand|auckland|wellington/i.test(loc)) {
      return 'Uber Eats & Menulog';
    }

    // India -> Zomato & Swiggy
    if (/india|mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|kolkata|pune/i.test(loc)) {
      return 'Zomato & Swiggy';
    }

    // Germany & Austria -> Lieferando & Uber Eats
    if (/germany|deutschland|berlin|munich|hamburg|frankfurt|austria|vienna/i.test(loc)) {
      return 'Lieferando & Uber Eats';
    }

    // Netherlands -> Thuisbezorgd & Uber Eats
    if (/netherlands|amsterdam|rotterdam|utrecht|hague/i.test(loc)) {
      return 'Thuisbezorgd & Uber Eats';
    }

    // Spain & Italy -> Glovo & Just Eat
    if (/spain|madrid|barcelona|italy|rome|milan/i.test(loc)) {
      return 'Glovo & Just Eat';
    }

    // USA / North America -> DoorDash & Uber Eats
    if (/usa|united states|austin|texas|new york|nyc|los angeles|chicago|san francisco|california|miami|florida|dallas|houston|seattle|boston|denver|atlanta|philadelphia/i.test(loc)) {
      return 'DoorDash & Uber Eats';
    }

    return 'local delivery apps';
  },

  /**
   * Generates tailored pitch based on channel constraints and local market context
   */
  generatePitch(lead, mode = 'team') {
    const greeting = this.getGreetingName(lead, mode);
    const bizShort = lead.businessName.split('(')[0].trim();

    if (lead.channel === 'whatsapp') {
      return this.generateWhatsAppPitch(lead, greeting, bizShort);
    } else if (lead.channel === 'linkedin') {
      return this.generateLinkedInPitch(lead, greeting, bizShort);
    } else if (lead.channel === 'instagram') {
      return this.generateInstagramPitch(lead, greeting, bizShort);
    } else {
      return this.generateGmailPitch(lead, greeting, bizShort);
    }
  },

  /**
   * WhatsApp: Direct conversational format with authentic formatting, diagnosed flaw, and clear deliverable offer
   */
  generateWhatsAppPitch(lead, firstName, bizShort) {
    const flaw = lead.flawTitle || 'Mobile conversion bottleneck';
    const solution = lead.deliverableSolution || '1-Tap Direct Mobile Funnel (48 Hours)';
    const leak = lead.flawLeakRange || 'significant monthly revenue';
    const city = (lead.city || '').split(',')[0].trim();
    const icon = lead.nicheIcon || '🎯';

    let text = `Hi ${firstName}! Hope you're having a great week at *${bizShort}* ${icon}\n\n` +
      `Quick observation regarding your mobile presence in ${city}:\n` +
      `We noticed a specific bottleneck: *${flaw}*.\n\n` +
      `For businesses of your caliber in ${city}, this drop-off typically leaks around *${leak}* in missed clients and bookings every month.\n\n` +
      `We set up a *${solution}* so you capture 100% of these clients directly, ready in 48 hours.\n\n` +
      `Would you be open to a quick 2-minute chat or brief walkthrough this week?`;

    return {
      channel: 'whatsapp',
      subject: `WhatsApp Direct Outreach for ${lead.decisionMaker}`,
      body: text,
      charCount: text.length,
      limitNote: 'WhatsApp Direct Outreach (Tailored to specific diagnosed flaw)'
    };
  },

  /**
   * LinkedIn: Strict < 300 characters connection note tailored to specific flaw
   */
  generateLinkedInPitch(lead, firstName, bizShort) {
    const flawClean = (lead.flawTitle || 'mobile client intake bottleneck').replace(/\s*\(.*?\)/g, '').trim();
    const leak = lead.flawLeakRange || 'monthly revenue';
    const solutionClean = (lead.deliverableSolution || 'direct booking funnel')
      .replace(/\s*\(48 Hours\)/i, '')
      .replace(/\s*\(Direct.*?\)/i, '')
      .trim();

    let text = `Hi ${firstName}, love ${bizShort}! Noticed ${flawClean.toLowerCase()} is leaking ~${leak}. We build a ${solutionClean.toLowerCase()} in 48h to capture 100% of these clients. Open to a quick chat?`;

    if (text.length > 295) {
      const shortFlaw = flawClean.length > 35 ? flawClean.substring(0, 32) + '...' : flawClean;
      text = `Hi ${firstName}, noticed ${shortFlaw.toLowerCase()} leaks ~${leak} for ${bizShort}. We build a 1-tap mobile fix in 48h to recover 100% of this. Open to a quick chat?`;
    }

    if (text.length > 298) {
      text = text.substring(0, 295) + '...';
    }

    return {
      channel: 'linkedin',
      subject: `Connection Note for ${lead.decisionMaker}`,
      body: text,
      charCount: text.length,
      limitNote: '< 300 characters connection note (Bypasses character limit)'
    };
  },

  /**
   * Instagram: Story Reply format tailored to specific flaw
   */
  generateInstagramPitch(lead, firstName, bizShort) {
    const flaw = lead.flawTitle || 'mobile booking bottleneck';
    const leak = lead.flawLeakRange || 'monthly revenue';
    const solution = (lead.deliverableSolution || 'direct mobile funnel').replace(/\s*\(48 Hours\)/i, '').trim();
    const igHandle = (lead.contactInfo && lead.contactInfo.instagramHandle)
      ? lead.contactInfo.instagramHandle.replace('@', '')
      : (lead.instagramHandle ? lead.instagramHandle.replace('@', '') : 'business');

    const text = `Hey ${firstName}! Great showcase on your page 🙌 Quick heads up: noticed on mobile you have: ${flaw}. In our audit data, that drop-off leaks ~${leak} every month. We build a ${solution.toLowerCase()} in 48 hours to fix this completely. Mind if I send a quick 30s breakdown?`;

    return {
      channel: 'instagram',
      subject: `Story Reply to @${igHandle}`,
      body: text,
      charCount: text.length,
      limitNote: 'Story Reply Format (Lands directly in primary inbox, bypasses spam requests)'
    };
  },

  /**
   * Gmail: Curiosity lowercase subject line + 4-sentence body + financial leak calculation
   */
  generateGmailPitch(lead, firstName, bizShort) {
    const flaw = lead.flawTitle || 'mobile client intake bottleneck';
    const leak = lead.flawLeakRange || 'lost monthly revenue';
    const solution = lead.deliverableSolution || '1-tap mobile conversion system';
    const city = (lead.city || '').split(',')[0].trim();

    const cleanFlawShort = flaw.replace(/\s*\(.*?\)/g, '').substring(0, 38).trim();
    const subject = `quick question regarding ${bizShort.toLowerCase()} (${cleanFlawShort.toLowerCase()})`;

    const body = `hi ${firstName.toLowerCase()},\n\n` +
      `was doing a brief audit of ${bizShort} in ${city} and noticed a specific bottleneck: ${flaw.toLowerCase()}.\n\n` +
      `for businesses of your caliber in ${city}, this friction typically leaks around ${leak} in missed clients and bookings every month.\n\n` +
      `we set up a ${solution.toLowerCase()} to capture 100% of these clients directly, ready in 48 hours.\n\n` +
      `would you be opposed to a brief 2-minute chat or quick walkthrough this week?\n\n` +
      `best,\n` +
      `fawwad`;

    return {
      channel: 'gmail',
      subject,
      body,
      charCount: body.length,
      limitNote: 'Curiosity Lowercase Subject + 4-Sentence Body (High Open & Reply Rate)'
    };
  },

  /**
   * Day-3 Follow-Up Message Generator
   */
  generateDay3FollowUp(lead, mode = 'team') {
    const greeting = this.getGreetingName(lead, mode);
    const bizShort = lead.businessName.split('(')[0].trim();
    const flaw = (lead.flawTitle || 'the mobile intake bottleneck').replace(/\s*\(.*?\)/g, '').trim();

    if (lead.channel === 'whatsapp') {
      return `Hi ${greeting}! Quick bump on my WhatsApp note regarding *${bizShort}* and fixing that *${flaw}* (~${lead.flawLeakRange}). Let me know if you're open to a quick 2-minute chat! 🙌`;
    } else if (lead.channel === 'linkedin') {
      return `Hey ${greeting}, quick follow-up on my note regarding ${bizShort} and fixing the ${lead.flawLeakRange} leak from ${flaw.substring(0, 45)}. Worth a quick 45-second look?`;
    } else if (lead.channel === 'instagram') {
      return `Hey ${greeting}! Quick bump on my message for ${bizShort} regarding fixing ${flaw} (~${lead.flawLeakRange}). Let me know if you'd like a quick 30s breakdown! 🙌`;
    } else {
      return `hi ${greeting.toLowerCase()},\n\nquick bump on this — did you get a chance to see my note about fixing ${flaw.toLowerCase()} and recovering ~${lead.flawLeakRange} for ${bizShort}?\n\nno worries at all if you're swamped, just wanted to check before i archive the audit.\n\nbest,\nfawwad`;
    }
  }
};

window.PitchEngine = PitchEngine;
