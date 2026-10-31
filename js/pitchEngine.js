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
   * WhatsApp: Direct, concise, 3-sentence conversational format with authentic formatting
   */
  generateWhatsAppPitch(lead, firstName, bizShort) {
    const flaw = (lead.flawTitle || 'mobile booking bottleneck').replace(/\s*\(.*?\)/g, '').trim();
    const solution = (lead.deliverableSolution || 'direct mobile funnel')
      .split(' (')[0]
      .split(' +')[0]
      .replace(/with Instant WhatsApp.*/i, '')
      .replace(/with WhatsApp Confirmation.*/i, '')
      .trim();
    const leak = lead.flawLeakRange || 'revenue';

    const greetingLine = firstName.toLowerCase().startsWith('team')
      ? `Hi ${firstName}! Hope all is well 👋`
      : `Hi ${firstName}! Hope all is well at *${bizShort}* 👋`;

    // 3 short, punchy lines:
    // Line 1: Friendly greeting
    // Line 2: Specific bottleneck + estimated revenue leak
    // Line 3: 48h solution + low-friction 30-sec question
    let text = `${greetingLine}\n\n` +
      `Noticed a quick bottleneck on mobile: *${flaw}*, leaking ~*${leak}* in missed clients.\n\n` +
      `We build a *${solution}* in 48 hours to recover this. Mind if I share a quick 30-second breakdown?`;

    return {
      channel: 'whatsapp',
      subject: `WhatsApp Outreach for ${lead.decisionMaker}`,
      body: text,
      charCount: text.length,
      limitNote: 'WhatsApp Direct (Concise, punchy & high response rate)'
    };
  },

  /**
   * LinkedIn: Strict < 300 characters connection note tailored to specific flaw
   */
  generateLinkedInPitch(lead, firstName, bizShort) {
    const flawClean = (lead.flawTitle || 'mobile client intake bottleneck').replace(/\s*\(.*?\)/g, '').trim();
    const leak = (lead.flawLeakRange || 'revenue').replace(/\/mo$/i, '');
    const solutionClean = (lead.deliverableSolution || 'direct booking funnel')
      .split(' (')[0]
      .split(' +')[0]
      .replace(/with Instant WhatsApp.*/i, '')
      .replace(/with WhatsApp Confirmation.*/i, '')
      .trim();

    let text = `Hi ${firstName}, love ${bizShort}! Noticed ${flawClean.toLowerCase()} costs ~${leak}/mo. We build a ${solutionClean.toLowerCase()} in 48h to fix this. Worth a quick 30s chat?`;

    if (text.length > 295) {
      const shortFlaw = flawClean.length > 35 ? flawClean.substring(0, 32) + '...' : flawClean;
      text = `Hi ${firstName}, noticed ${shortFlaw.toLowerCase()} costs ~${leak} for ${bizShort}. We build a direct fix in 48h to recover this. Open to a quick chat?`;
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
   * Instagram: Story Reply format tailored to specific flaw (Ultra-concise)
   */
  generateInstagramPitch(lead, firstName, bizShort) {
    const flaw = (lead.flawTitle || 'mobile booking bottleneck').replace(/\s*\(.*?\)/g, '').trim();
    const leak = lead.flawLeakRange || 'monthly revenue';
    const igHandle = (lead.contactInfo && lead.contactInfo.instagramHandle)
      ? lead.contactInfo.instagramHandle.replace('@', '')
      : (lead.instagramHandle ? lead.instagramHandle.replace('@', '') : 'business');

    const text = `Hey ${firstName}! Great post 🔥 Quick observation: noticed on mobile you have: ${flaw} (~${leak} leak). We fix this in 48 hours. Mind if I send a quick 30s look?`;

    return {
      channel: 'instagram',
      subject: `Story Reply to @${igHandle}`,
      body: text,
      charCount: text.length,
      limitNote: 'Story Reply (Ultra-concise, lands in primary inbox)'
    };
  },

  /**
   * Gmail: Clean 3-sentence curiosity email + financial leak calculation
   */
  generateGmailPitch(lead, firstName, bizShort) {
    const flaw = (lead.flawTitle || 'mobile client intake bottleneck').replace(/\s*\(.*?\)/g, '').trim();
    const leak = lead.flawLeakRange || 'lost monthly revenue';
    const solution = (lead.deliverableSolution || '1-tap mobile conversion system')
      .split(' (')[0]
      .split(' +')[0]
      .replace(/with Instant WhatsApp.*/i, '')
      .replace(/with WhatsApp Confirmation.*/i, '')
      .trim();
    const city = (lead.city || '').split(',')[0].trim();

    const cleanFlawShort = flaw.substring(0, 32).trim();
    const subject = `quick note: ${bizShort.toLowerCase()} (${cleanFlawShort.toLowerCase()})`;

    const body = `hi ${firstName.toLowerCase()},\n\n` +
      `noticed a quick bottleneck on ${bizShort}'s mobile presence in ${city}: ${flaw.toLowerCase()}.\n\n` +
      `this typically costs businesses in your area around ${leak} in missed bookings each month. we build a ${solution.toLowerCase()} in 48 hours to recover this.\n\n` +
      `worth a quick 2-minute chat this week?\n\n` +
      `best,\n` +
      `fawwad`;

    return {
      channel: 'gmail',
      subject,
      body,
      charCount: body.length,
      limitNote: 'Curiosity Lowercase Subject + 3 Sentences (Fast Open & High Reply)'
    };
  },

  /**
   * Day-3 Follow-Up Message Generator (Ultra-concise 1-line bump)
   */
  generateDay3FollowUp(lead, mode = 'team') {
    const greeting = this.getGreetingName(lead, mode);
    const bizShort = lead.businessName.split('(')[0].trim();
    const flaw = (lead.flawTitle || 'the booking leak').replace(/\s*\(.*?\)/g, '').trim();

    if (lead.channel === 'whatsapp') {
      return `Hi ${greeting}! Quick bump regarding *${bizShort}* and fixing that *${flaw}* (~${lead.flawLeakRange}). Open to a quick 2-min chat? 🙌`;
    } else if (lead.channel === 'linkedin') {
      return `Hey ${greeting}, quick bump regarding ${bizShort} and fixing ${flaw.substring(0, 40)}. Worth a 30s look?`;
    } else if (lead.channel === 'instagram') {
      return `Hey ${greeting}! Quick bump regarding fixing ${flaw} for ${bizShort} (~${lead.flawLeakRange}). Mind if I share a quick breakdown? 🙌`;
    } else {
      return `hi ${greeting.toLowerCase()},\n\nquick bump on this — open to a quick 2-minute look at fixing ${flaw.toLowerCase()} for ${bizShort}?\n\nno worries if you're swamped!\n\nbest,\nfawwad`;
    }
  }
};

window.PitchEngine = PitchEngine;
