/**
 * RestoHunter AI - Pitch Generation Engine
 * Clean, high-converting direct outreach messages without external preview links or distractions.
 * Channels: WhatsApp Direct, LinkedIn (<300 chars), Instagram Story Reply, Gmail (4-sentence curiosity).
 */

const PitchEngine = {
  /**
   * Smart greeting parser for verified founders, chef-patrons, partnerships and teams
   */
  getGreetingName(lead) {
    if (!lead || !lead.decisionMaker) return 'there';
    const dm = lead.decisionMaker.trim();
    const bizClean = (lead.businessName || '').split('(')[0].trim();

    if (/family/i.test(dm)) return dm;
    if (/directorate|leadership|team|board/i.test(dm)) return `Team ${bizClean}`;
    if (/group$/i.test(dm.trim())) return `${dm.replace(/\s+group$/i, '')} Team`;

    if (/&\s*(directors|partners|sons|brothers)/i.test(dm)) {
      const leadName = dm.replace(/\s*&\s*(directors|partners|sons|brothers).*/i, '').trim();
      const tokens = leadName.split(/\s+/);
      let first = tokens[0];
      if (/^(haji|syed|sardar|ch)/i.test(first) && tokens.length > 1) {
        first = tokens[1];
      }
      return `${first} & Team`;
    }

    if (dm.includes(' & ')) {
      const parts = dm.split(' & ').map(p => {
        return p.trim().split(/\s+/)[0];
      });
      return parts.join(' & ');
    }

    if (/^(muhammad|mohammad)\s+/i.test(dm)) {
      const tokens = dm.split(/\s+/);
      return tokens[1] || tokens[0];
    }

    if (/^(dr\.|chef)\s+/i.test(dm)) {
      const tokens = dm.split(/\s+/);
      return `${tokens[0]} ${tokens[1] || ''}`.trim();
    }

    let base = dm;
    if (base.includes('(')) base = base.split('(')[0].trim();
    const tokens = base.split(/\s+/);
    if (/^(haji|syed|sardar|ch)/i.test(tokens[0]) && tokens.length > 1) {
      return tokens[1];
    }
    return tokens[0];
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
  generatePitch(lead) {
    const greeting = this.getGreetingName(lead);
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
   * WhatsApp: Direct conversational format with authentic formatting, diagnosed flaw, and clear 0% commission offer
   */
  generateWhatsAppPitch(lead, firstName, bizShort) {
    const deliveryApp = this.detectDeliveryPlatform(lead);
    let text = '';

    if (lead.niche === 'restaurants') {
      text = `Hi ${firstName}! Hope you're having a great week at *${bizShort}* 🍽️\n\nQuick heads up: noticed your mobile website currently directs delivery customers to ${deliveryApp}.\n\nBased on restaurants in ${lead.city.split(',')[0]}, that 30% commission cut usually costs around *${lead.flawLeakRange}* in lost margin every month.\n\nWe help local restaurants set up a direct 1-tap mobile ordering system with *0% commission* where you keep 100% of your ticket revenue, ready in 48 hours.\n\nWould you be open to a quick 2-minute chat this week?`;
    } else if (lead.niche === 'dental_medical') {
      text = `Hi ${firstName}! Hope all is well at *${bizShort}* 🦷\n\nQuick observation regarding patient intake: noticed after 7 PM emergency patients have no online booking calendar, leaking an estimated *${lead.flawLeakRange}* in missed appointments.\n\nWe set up 24/7 automated mobile booking calendars for clinics with paperless intake, ready in 48 hours.\n\nCan I share a quick 45-second breakdown of how it works for ${bizShort}?`;
    } else if (lead.niche === 'salons_spas') {
      text = `Hey ${firstName}! Love the work your team is doing at *${bizShort}* ✨\n\nSaw that appointments are still handled by phone or DM, which in our audit data usually risks ~*${lead.flawLeakRange}* in empty chair no-shows every month.\n\nWe set up an instant mobile booking widget with automated 2-way SMS reminders that slashes no-shows by 85%, ready in 48 hours.\n\nWould you be open to a quick 2-minute chat?`;
    } else if (lead.niche === 'home_services') {
      text = `Hi ${firstName}! Great reviews on *${bizShort}* in ${lead.city.split(',')[0]} 🔨\n\nNoticed your mobile website currently lacks a 60-second emergency quote calculator. When homeowners have an emergency, 70% bounce without that, leaking ~*${lead.flawLeakRange}* in top-tier jobs.\n\nWe build high-converting instant estimate calculators that capture emergency jobs immediately, ready in 48 hours.\n\nOpen to checking out a quick breakdown?`;
    } else {
      text = `Hi ${firstName}! Incredible property at *${bizShort}* 🌟\n\nNoticed your mobile reservation button redirects guests directly to OTAs where you give away 18-25% in commissions (*${lead.flawLeakRange}*).\n\nWe set up direct commission-free reservation engines with VIP perks so you keep 100% room revenue, ready in 48 hours.\n\nWould you be open to a quick 2-minute chat?`;
    }

    return {
      channel: 'whatsapp',
      subject: `WhatsApp Direct Outreach for ${lead.decisionMaker}`,
      body: text,
      charCount: text.length,
      limitNote: 'WhatsApp Direct Outreach (Direct to owner mobile, high conversion)'
    };
  },

  /**
   * LinkedIn: Strict < 300 characters connection note
   */
  generateLinkedInPitch(lead, firstName, bizShort) {
    const deliveryApp = this.detectDeliveryPlatform(lead);
    let text = '';

    if (lead.niche === 'restaurants') {
      text = `Hi ${firstName}, love ${bizShort}! Noticed ${deliveryApp} takes ~30% (${lead.flawLeakRange}) of orders. We build 0% commission direct ordering systems so you keep 100% ticket revenue, ready in 48h. Open to a quick chat?`;
    } else if (lead.niche === 'dental_medical') {
      text = `Hi ${firstName}, great reviews on ${bizShort}! Noticed after-hours patients have no direct booking, losing ~${lead.flawLeakRange}. We build 24/7 mobile intake calendars for clinics in 48h. Worth a quick chat?`;
    } else if (lead.niche === 'salons_spas') {
      text = `Hey ${firstName}! Big fan of ${bizShort}. Saw bookings are phone-only, risking ~${lead.flawLeakRange} in no-shows. We set up 1-tap booking with auto-SMS reminders that cuts no-shows by 85%. Open to a chat?`;
    } else if (lead.niche === 'home_services') {
      text = `Hi ${firstName}, your work at ${bizShort} is top tier. Noticed your site lacks a 60s emergency quote tool, leaking ~${lead.flawLeakRange}. We build instant quote engines in 48h. Open to a quick look?`;
    } else {
      text = `Hi ${firstName}! Noticed ${bizShort} redirects guests to OTAs, losing ~${lead.flawLeakRange} in fees. We build direct commission-free reservation engines in 48h. Mind taking a quick look?`;
    }

    // Strict safety cap to ensure < 300 characters
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
   * Instagram: Story Reply format to bypass hidden spam requests folder
   */
  generateInstagramPitch(lead, firstName, bizShort) {
    const deliveryApp = this.detectDeliveryPlatform(lead);
    let text = '';

    if (lead.niche === 'restaurants') {
      text = `Hey ${firstName}! Just saw your story at ${bizShort} — food looks incredible 🔥 Quick question: saw you're on ${deliveryApp} — did you know a direct 1-tap ordering setup with 0% commission saves ~${lead.flawLeakRange} in app cuts? We set this up for local restaurants in 48 hours. Open to a quick 2-min chat?`;
    } else if (lead.niche === 'dental_medical') {
      text = `Hey guys! Loved your recent post about the clinic 🙌 Quick heads up: noticed after-hours emergency patients have no online calendar to book directly from Instagram, costing an estimated ${lead.flawLeakRange} in missed appointments. We set up 24/7 automated booking in 48 hours. Can I send a quick breakdown?`;
    } else if (lead.niche === 'salons_spas') {
      text = `That transformation cut on your story is clean 🔥 Quick question: saw you guys still take all chair appointments manually by phone or DM. We help local shops slash no-shows by 85% with an automated SMS reminder widget in 48 hours. Mind if I send a quick 30s breakdown?`;
    } else if (lead.niche === 'home_services') {
      text = `Solid project showcase on your story guys! 🔨 Quick tip: checked your bio link on mobile and noticed there's no 1-tap instant quote calculator. Homeowners in ${lead.city.split(',')[0]} bounce without that, leaking ~${lead.flawLeakRange}. We build 60s quote engines in 48h. Can I share a quick breakdown?`;
    } else {
      text = `Incredible property views on your story! 🌟 Quick heads up: noticed your mobile bio link redirects guests to OTAs where you lose 20% commission on every room (${lead.flawLeakRange}). We build direct commission-free reservation engines in 48 hours. Mind if I share a quick breakdown?`;
    }

    return {
      channel: 'instagram',
      subject: `Story Reply to @${lead.contactInfo.instagramHandle ? lead.contactInfo.instagramHandle.replace('@', '') : 'business'}`,
      body: text,
      charCount: text.length,
      limitNote: 'Story Reply Format (Lands directly in primary inbox, bypasses spam requests)'
    };
  },

  /**
   * Gmail: Curiosity lowercase subject line + 4-sentence body + financial leak calculation
   */
  generateGmailPitch(lead, firstName, bizShort) {
    const deliveryApp = this.detectDeliveryPlatform(lead);
    let subject = '';
    let body = '';

    if (lead.niche === 'restaurants') {
      subject = `quick question regarding ${bizShort.toLowerCase()} mobile orders`;
      body = `hi ${firstName.toLowerCase()},\n\nnoticed your mobile website currently directs delivery customers to ${deliveryApp.toLowerCase()}.\n\nbased on restaurants in ${lead.city.split(',')[0]}, that 30% third-party commission cut is typically costing you around ${lead.flawLeakRange} in lost margin every month.\n\nwe help local restaurants set up a direct 1-tap mobile ordering system with 0% commission so you keep 100% of your ticket revenue, ready in 48 hours.\n\nwould you be opposed to a quick 2-minute chat or brief walkthrough this week?\n\nbest,\nfawwad`;
    } else if (lead.niche === 'dental_medical') {
      subject = `after-hours patient booking for ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nwas looking at ${bizShort}'s patient intake workflow and noticed there's no online booking calendar for patients searching after 7 pm.\n\nfor private practices in ${lead.city.split(',')[0]}, this after-hours drop-off typically leaks ${lead.flawLeakRange} in missed consultations and emergency walk-ins.\n\nwe set up clean 24/7 automated mobile booking calendars specifically for clinics with paperless intake, ready in 48 hours.\n\nmind if i send over a brief 45-second breakdown of how it works?\n\nbest,\nfawwad`;
    } else if (lead.niche === 'salons_spas') {
      subject = `quick idea on no-shows for ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nlove the work your team is doing at ${bizShort}.\n\nsaw that clients can only book by phone, which in our audit data usually correlates to a 15-20% no-show rate and roughly ${lead.flawLeakRange} in empty chair hours every month.\n\nwe build instant mobile booking widgets with automated 2-way sms reminders designed to drop no-shows by 85%, ready in 48 hours.\n\ncan i share a brief 30-second breakdown of what it looks like for ${bizShort}?\n\nbest,\nfawwad`;
    } else if (lead.niche === 'home_services') {
      subject = `website quote leak on ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nnoticed your emergency services in ${lead.city.split(',')[0]} are getting great reviews, but your mobile page currently lacks a 1-tap quote calculator.\n\nwhen homeowners have an emergency, 70% bounce to whichever company offers 60-second instant pricing, leaking an estimated ${lead.flawLeakRange} in top-tier jobs.\n\nwe build modern high-converting estimate calculators tailored for ${bizShort}, ready in 48 hours.\n\nopen to a quick 1-minute walkthrough?\n\nbest,\nfawwad`;
    } else {
      subject = `commission leak audit for ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nnoticed ${bizShort}'s mobile reservation button redirects guests directly to otas like booking.com, giving away 18-25% in commissions.\n\nfor a boutique property of your caliber, that's roughly ${lead.flawLeakRange} in commission fees going out the door each month.\n\nwe build direct commission-free reservation engines with VIP perks so you keep 100% room revenue, ready in 48 hours.\n\nwould you be against a quick 2-minute chat?\n\nbest,\nfawwad`;
    }

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
  generateDay3FollowUp(lead) {
    const greeting = this.getGreetingName(lead);
    const bizShort = lead.businessName.split('(')[0].trim();
    const deliveryApp = this.detectDeliveryPlatform(lead);

    if (lead.channel === 'whatsapp') {
      return `Hi ${greeting}! Quick bump on my WhatsApp note regarding *${bizShort}* and recovering that *${lead.flawLeakRange}* margin from ${deliveryApp}. Let me know if you're open to a quick 2-minute chat! 🙌`;
    } else if (lead.channel === 'linkedin') {
      return `Hey ${greeting}, quick follow-up on my note regarding ${bizShort} and the ${lead.flawLeakRange} ${deliveryApp} leak. Would you like me to share a quick 45-second breakdown?`;
    } else if (lead.channel === 'instagram') {
      return `Hey ${greeting}! Quick bump on my message for ${bizShort} regarding eliminating that ${deliveryApp} commission cut (${lead.flawLeakRange}). Let me know if you'd like a quick 30s breakdown! 🙌`;
    } else {
      return `hi ${greeting.toLowerCase()},\n\nquick bump on this — did you get a chance to see my note about recovering that ${lead.flawLeakRange} leak from ${deliveryApp.toLowerCase()} for ${bizShort}?\n\nno worries at all if you're swamped, just wanted to check before i archive the notes.\n\nbest,\nfawwad`;
    }
  }
};

window.PitchEngine = PitchEngine;
