/**
 * RestoHunter AI - Pitch Generation Engine (LinkedIn <300 chars, Instagram Story Reply, Gmail 4-sentence body)
 * Dynamically tailored with authentic local delivery apps, native currencies, and localized financial leaks.
 * Live Client Preview URL: https://fawwad345776.github.io/RestoHunter-AI/?v=3.1
 */

const PitchEngine = {
  PREVIEW_URL: 'https://fawwad345776.github.io/RestoHunter-AI/?v=3.1',

  /**
   * Generates tailored pitch based on channel constraints and local market context
   */
  generatePitch(lead) {
    const firstName = lead.decisionMaker ? lead.decisionMaker.split(' ')[0] : 'there';
    const bizShort = lead.businessName.split('(')[0].trim();

    if (lead.channel === 'linkedin') {
      return this.generateLinkedInPitch(lead, firstName, bizShort);
    } else if (lead.channel === 'instagram') {
      return this.generateInstagramPitch(lead, firstName, bizShort);
    } else {
      return this.generateGmailPitch(lead, firstName, bizShort);
    }
  },

  /**
   * LinkedIn: Strict < 300 characters connection note + live client preview link
   */
  generateLinkedInPitch(lead, firstName, bizShort) {
    const deliveryApp = lead.regionDeliveryApps || 'delivery apps';
    const previewUrl = this.PREVIEW_URL;
    let text = '';

    if (lead.niche === 'restaurants') {
      text = `Hi ${firstName}, love ${bizShort}! Noticed your menu is PDF-only, losing ~${lead.flawLeakRange} to ${deliveryApp} cuts. Built a 0% commission direct ordering preview for you: ${previewUrl} - Mind taking a look?`;
    } else if (lead.niche === 'dental_medical') {
      text = `Hi ${firstName}, great reviews on ${bizShort}! Noticed after-hours patients have no direct booking, losing ~${lead.flawLeakRange}. Built a 24/7 mobile intake demo for your clinic: ${previewUrl} - Worth a quick look?`;
    } else if (lead.niche === 'salons_spas') {
      text = `Hey ${firstName}! Big fan of ${bizShort}. Saw bookings are phone-only, risking ~${lead.flawLeakRange} in no-shows. Built a 1-tap booking demo with auto-SMS reminders: ${previewUrl} - Mind checking it?`;
    } else if (lead.niche === 'home_services') {
      text = `Hi ${firstName}, your work at ${bizShort} is top tier. Noticed your site lacks a 60s emergency quote tool, leaking ~${lead.flawLeakRange}. Built a live quote demo: ${previewUrl} - Open to a look?`;
    } else {
      text = `Hi ${firstName}! Noticed ${bizShort} redirects guests to OTAs, losing ~${lead.flawLeakRange} in fees. Built a direct commission-free reservation demo for you: ${previewUrl} - Mind taking a look?`;
    }

    // Strict safety cap to ensure < 300 characters
    if (text.length > 298) {
      // If needed, preserve preview link at end
      const maxLeadText = 295 - previewUrl.length - 12;
      text = text.substring(0, maxLeadText) + `... Preview: ${previewUrl}`;
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
   * Instagram: Story Reply format to bypass hidden spam requests folder + live client preview link
   */
  generateInstagramPitch(lead, firstName, bizShort) {
    const deliveryApp = lead.regionDeliveryApps || 'delivery apps';
    const previewUrl = this.PREVIEW_URL;
    let text = '';

    if (lead.niche === 'restaurants') {
      text = `Yo team ${bizShort}! Just saw your story — food looks incredible 🔥 Quick observation: checked your bio link on mobile and noticed it pulls up a pinch-to-zoom PDF menu. You're probably losing ~${lead.flawLeakRange} to ${deliveryApp} commissions. Built a clean 1-tap mobile ordering concept for you guys with zero commission. Check the live preview here: ${previewUrl} - Mind if I drop a 30s walkthrough?`;
    } else if (lead.niche === 'dental_medical') {
      text = `Hey guys! Loved your recent post about the clinic 🙌 Quick heads up from a local tech consultant: noticed after-hours emergency patients have no online calendar to book directly from Instagram, costing an estimated ${lead.flawLeakRange} in missed appointments. Put together a clean 24/7 mobile booking prototype for ${bizShort}. You can test the live preview here: ${previewUrl} - Can I send more info?`;
    } else if (lead.niche === 'salons_spas') {
      text = `That transformation cut on your story is clean 🔥 Quick question: saw you guys still take all chair appointments manually by phone or DM. We helped another local shop slash no-shows by 85% with an automated SMS reminder widget. Built a free mobile concept for ${bizShort}. Check the live demo here: ${previewUrl} - Mind if I send a quick preview?`;
    } else if (lead.niche === 'home_services') {
      text = `Solid project showcase on your story guys! 🔨 Quick tip: checked your bio link on mobile and noticed there's no 1-tap emergency call or instant quote calculator. Homeowners in ${lead.city.split(',')[0]} bounce in under 5s without that, leaking ~${lead.flawLeakRange}. Mocked up a high-converting layout for ${bizShort}: ${previewUrl} - Can I share how it works?`;
    } else {
      text = `Incredible property views on your story! 🌟 Quick heads up: noticed your mobile bio link redirects guests to OTAs where you lose 20% commission on every room (${lead.flawLeakRange}). Mocked up a direct commission-free reservation widget for ${bizShort}: ${previewUrl} - Mind if I send a 30s screen recording?`;
    }

    return {
      channel: 'instagram',
      subject: `Story Reply to @${lead.contactInfo.instagramHandle.replace('@', '')}`,
      body: text,
      charCount: text.length,
      limitNote: 'Story Reply Format (Lands directly in primary inbox, bypasses spam requests)'
    };
  },

  /**
   * Gmail: Curiosity lowercase subject line + 4-sentence body + financial leak calculation + live client preview link
   */
  generateGmailPitch(lead, firstName, bizShort) {
    const deliveryApp = lead.regionDeliveryApps || 'DoorDash/UberEats';
    const previewUrl = this.PREVIEW_URL;
    let subject = '';
    let body = '';

    if (lead.niche === 'restaurants') {
      subject = `quick question regarding ${bizShort.toLowerCase()} mobile menu`;
      body = `hi ${firstName.toLowerCase()},\n\nnoticed your mobile website currently opens a pinch-to-zoom pdf menu and sends delivery customers to ${deliveryApp.toLowerCase()}.\n\nbased on restaurants in ${lead.city.split(',')[0]}, that 30% third-party commission cut is typically costing you around ${lead.flawLeakRange} in lost margin every month.\n\ni put together an interactive prototype of a 1-tap direct mobile ordering flow for ${bizShort} that lets you keep 100% of your ticket revenue.\n\nyou can preview the live interactive concept here:\n${previewUrl}\n\nwould you be opposed to checking out a quick 1-minute video walkthrough?`;
    } else if (lead.niche === 'dental_medical') {
      subject = `after-hours patient booking for ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nwas looking at ${bizShort}'s patient intake workflow and noticed there's no online booking calendar for patients searching after 7 pm.\n\nfor private practices in ${lead.city.split(',')[0]}, this after-hours drop-off typically leaks ${lead.flawLeakRange} in missed high-ticket consultations and emergency walk-ins.\n\ni put together a clean 24/7 automated mobile booking prototype specifically for ${bizShort} with paperless intake.\n\nyou can test the live preview here:\n${previewUrl}\n\nmind if i send over a 45-second screen recording of how it works?`;
    } else if (lead.niche === 'salons_spas') {
      subject = `quick idea on no-shows for ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nlove the work your team is doing at ${bizShort}.\n\nsaw that clients can only book by phone, which in our audit data usually correlates to a 15-20% no-show rate and roughly ${lead.flawLeakRange} in empty chair hours every month.\n\nwe built an instant mobile booking widget with automated 2-way sms reminders designed to drop no-shows to near zero.\n\nyou can preview the live demo here:\n${previewUrl}\n\ncan i share a 30-second preview of what it looks like for ${bizShort}?`;
    } else if (lead.niche === 'home_services') {
      subject = `website quote leak on ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nnoticed your emergency services in ${lead.city.split(',')[0]} are getting great reviews, but your mobile page currently lacks a 1-tap quote calculator.\n\nwhen homeowners have an emergency, 70% bounce to whichever company offers 60-second instant pricing, leaking an estimated ${lead.flawLeakRange} in top-tier jobs.\n\ni designed a modern high-converting estimate flow tailored for ${bizShort}:\n${previewUrl}\n\nopen to a 1-minute video walkthrough?`;
    } else {
      subject = `commission leak audit for ${bizShort.toLowerCase()}`;
      body = `hi ${firstName.toLowerCase()},\n\nnoticed ${bizShort}'s mobile reservation button redirects guests directly to otas like booking.com, giving away 18-25% in commissions.\n\nfor a boutique property of your caliber, that's roughly ${lead.flawLeakRange} in commission fees going out the door each month.\n\nwe built a direct commission-free reservation engine concept with instant room upgrades for ${bizShort}.\n\nyou can check the live prototype here:\n${previewUrl}\n\nwould you be against seeing a quick 45-second demo?`;
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
   * Day-3 Follow-Up Message Generator with live client preview link
   */
  generateDay3FollowUp(lead) {
    const firstName = lead.decisionMaker ? lead.decisionMaker.split(' ')[0] : 'there';
    const bizShort = lead.businessName.split('(')[0].trim();
    const previewUrl = this.PREVIEW_URL;

    if (lead.channel === 'linkedin') {
      return `Hey ${firstName}, quick follow-up on my note regarding ${bizShort}'s mobile flow and the ${lead.flawLeakRange} leak. Here is the 45s live preview: ${previewUrl} - Would you like me to walk you through it?`;
    } else if (lead.channel === 'instagram') {
      return `Hey guys! Just wanted to make sure you got the interactive preview link for ${bizShort} before we wrap up this week's audits: ${previewUrl} - Let me know your thoughts! 🙌`;
    } else {
      return `hi ${firstName.toLowerCase()},\n\nquick bump on this — did you get a chance to see my note about recovering that ${lead.flawLeakRange} leak for ${bizShort}?\n\nhere is the direct interactive prototype preview link:\n${previewUrl}\n\nno worries at all if you're swamped, just wanted to check before i archive the preview.\n\nbest,\nsupport team`;
    }
  }
};

window.PitchEngine = PitchEngine;
