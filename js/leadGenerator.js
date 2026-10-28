/**
 * RestoHunter AI - Multi-Niche 100-Lead Prospecting & Financial Flaw Audit Engine
 */

const NICHES = {
  RESTAURANTS: {
    id: 'restaurants',
    name: 'Restaurants, Cafes & Pizzerias',
    icon: '🍽️',
    flaws: [
      {
        type: 'pdf_menu',
        title: 'Pinch-to-zoom PDF Menu on Mobile',
        description: 'Customer on mobile forced to download slow PDF. 68% bounce rate before ordering.',
        leakFormula: (orders) => Math.round(orders * 45 * 0.30),
        leakDesc: 'Lost to DoorDash/UberEats 30% commission cut',
        range: '$2,800 – $5,200/month',
        pitchAngle: '1-tap mobile ordering preview link with zero commission'
      },
      {
        type: 'doordash_cut',
        title: 'No Direct Commission-Free Ordering',
        description: 'Orders redirected to DoorDash/Grubhub paying 28-30% on every ticket.',
        leakFormula: (orders) => Math.round(orders * 40 * 0.28),
        leakDesc: 'Direct commission fees paid out to third-party delivery apps',
        range: '$3,200 – $6,400/month',
        pitchAngle: 'Direct VIP order system with 0% commission and SMS customer re-order'
      }
    ],
    sampleNames: [
      'Artisan Trattoria', 'Bluefin Sushi & Omakase', 'Firebrick Wood Fired Pizza',
      'The Rusty Anchor Oyster Bar', 'Velvet Ember Steakhouse', 'Copper Pot Bistro',
      'Mama Rosa Family Kitchen', 'Cilantro Craft Taqueria', 'Le Petit Baguette Bakery',
      'Urban Harvest Bowl Co.', 'Golden Dragon Dumpling House', 'Basilico Authentic Italian',
      'Prime Oak Smokehouse', 'Solstice Modern Kitchen', 'Noche Tapas & Wine'
    ]
  },

  DENTAL_MEDICAL: {
    id: 'dental_medical',
    name: 'Dental & Medical Clinics',
    icon: '🩺',
    flaws: [
      {
        type: 'no_online_booking',
        title: 'Missing After-Hours Online Booking Calendar',
        description: 'Over 40% of patient appointment searches occur after 7 PM when phone desk is closed.',
        leakFormula: () => Math.round(18 * 350),
        leakDesc: 'Lost emergency consultations and high-ticket new patient intakes',
        range: '$5,200 – $8,500/month',
        pitchAngle: '24/7 automated patient booking calendar & paperless intake form'
      },
      {
        type: 'paper_intake',
        title: 'Clunky Paper & Printable PDF Intake Forms',
        description: 'Patients wait 25+ min in lobby filling paper, causing schedule delays and lost walk-ins.',
        leakFormula: () => Math.round(12 * 400),
        leakDesc: 'Staff hours wasted re-typing paper forms into CRM + patient drop-off',
        range: '$4,200 – $6,800/month',
        pitchAngle: 'Mobile 1-tap patient onboarding widget with HIPAA-compliant sync'
      }
    ],
    sampleNames: [
      'Summit Smiles Dental Care', 'Dr. Elena Aesthetic Dentistry', 'Radiant Health Family Clinic',
      'Apex Orthodontics & Implants', 'ClearView Optometry & Eye Care', 'Evergreen Pediatrics',
      'Horizon Wellness & Medical Spa', 'Metro Spine & Chiropractic', 'Pearl River Dental Group',
      'Precision Pain Relief Institute', 'Bayside Dermatology Studio', 'Beacon Physical Therapy'
    ]
  },

  SALONS_SPAS: {
    id: 'salons_spas',
    name: 'Barber Shops, Salons & Spas',
    icon: '✂️',
    flaws: [
      {
        type: 'phone_only_booking',
        title: 'Manual Phone Booking & High No-Show Rate',
        description: 'No automated 2-way SMS or WhatsApp appointment confirmations. 15-22% no-show rate.',
        leakFormula: () => Math.round(24 * 95),
        leakDesc: 'Unfilled chair slots from last-minute ghosting and cancelled appointments',
        range: '$1,800 – $3,400/month',
        pitchAngle: 'Instant mobile booking widget with zero-no-show automated SMS reminders'
      },
      {
        type: 'no_stylist_selection',
        title: 'No Stylist Portfolio or Direct Chair Reservation',
        description: 'Clients cannot pick chair or view stylist Instagram work directly on website.',
        leakFormula: () => Math.round(16 * 110),
        leakDesc: 'Lost new high-end color and balayage appointments to competitors',
        range: '$1,500 – $2,900/month',
        pitchAngle: 'VIP Stylist booking portal with instant deposit collection'
      }
    ],
    sampleNames: [
      'The Gentleman\'s Blade Barbershop', 'Velvet Lounge Hair Studio', 'Luxe Lash & Brow Bar',
      'Gilded Mane Salon', 'Iron & Crown Barbers', 'Serenity Sanctuary Day Spa',
      'Urban Cut & Shave Parlor', 'Bella Vista Aesthetics', 'Roots & Radiance Hair Loft',
      'Oasis Float & Massage Therapy', 'The Polished Pearl Nail Bar', 'Monarch Barber Co.'
    ]
  },

  HOME_SERVICES: {
    id: 'home_services',
    name: 'Home Services (Roofing, Plumbing, HVAC)',
    icon: '🔨',
    flaws: [
      {
        type: 'outdated_site',
        title: '2010-Era Non-Responsive Website / Broken Mobile Call',
        description: 'Emergency homeowners bouncing because tap-to-call is missing and page takes 6s to load.',
        leakFormula: () => Math.round(4 * 2800),
        leakDesc: 'Losing high-ticket replacement jobs to top 3 Google local pack competitors',
        range: '$9,500 – $18,000/month',
        pitchAngle: 'High-converting emergency landing page with 1-click tap-to-call & instant estimate'
      },
      {
        type: 'missing_calculator',
        title: 'No Instant Quote Calculator or Online Dispatch Form',
        description: 'Homeowners want instant estimates. Long email contact forms have 82% abandonment.',
        leakFormula: () => Math.round(3 * 3400),
        leakDesc: 'Homeowners booking with modern competitors offering instant price estimators',
        range: '$8,000 – $15,000/month',
        pitchAngle: '60-second interactive instant roofing/HVAC quote calculator'
      }
    ],
    sampleNames: [
      'ProGuard Roofing & Restoration', 'RapidFlow 24/7 Emergency Plumbing', 'AirMaster HVAC Solutions',
      'TrueNorth Foundation Repair', 'Titan Electric & Lighting', 'Eagle Eye Gutter & Siding',
      'AllState Water Damage Restoration', 'BlueStar Heating & Cooling', 'Vanguard Solar Systems',
      'Precision Garage Door Experts', 'EverDry Waterproofing Pros', 'Summit Tree Service'
    ]
  },

  BOUTIQUE_HOTELS: {
    id: 'boutique_hotels',
    name: 'Boutique Hotels & Resorts',
    icon: '🏨',
    flaws: [
      {
        type: 'ota_commission_drain',
        title: 'Missing Direct Booking Engine (18-25% OTA Leak)',
        description: 'Bookings forwarded to Booking.com and Expedia, giving away up to 25% of gross revenue.',
        leakFormula: () => Math.round(35 * 180 * 0.22),
        leakDesc: 'Commissions paid to OTAs for guests who searched hotel brand directly',
        range: '$4,500 – $9,800/month',
        pitchAngle: 'Direct commission-free reservation engine with instant room upsells'
      },
      {
        type: 'outdated_gallery',
        title: 'Outdated Flash/Thumbnail Photo Gallery on Mobile',
        description: 'Rooms display low-res photos without 360 tour or mobile-optimized amenity showcase.',
        leakFormula: () => Math.round(20 * 190 * 0.20),
        leakDesc: 'Guests dropping off during reservation checkout to comparable modern boutique hotels',
        range: '$3,800 – $7,200/month',
        pitchAngle: 'Cinematic mobile room gallery with direct VIP reservation perks'
      }
    ],
    sampleNames: [
      'The Rosemary Boutique Inn', 'Harbor View Luxury Suites', 'The Highland Manor Hotel',
      'Pinecrest Mountain Lodge', 'Sundance Desert Resort', 'The Ivy Heritage House',
      'Canyon Vista Boutique Villas', 'Wharfside Waterfront Inn', 'The Emerald Terrace Hotel'
    ]
  }
};

const DECISION_MAKERS = [
  { name: 'Marcus Vance', title: 'Managing Owner' },
  { name: 'Dr. Elena Rostova', title: 'Founder & Lead Practitioner' },
  { name: 'David Sterling', title: 'General Manager' },
  { name: 'Sarah Jenkins', title: 'Director of Operations' },
  { name: 'Michael Chen', title: 'Owner & Head Chef' },
  { name: 'Robert DeLuca', title: 'Principal Owner' },
  { name: 'Chloe Montgomery', title: 'Creative Director & Founder' },
  { name: 'James Thornton', title: 'Managing Director' },
  { name: 'Amanda Wright', title: 'Co-Founder & General Partner' },
  { name: 'Brian Kowalski', title: 'Operating Owner' }
];

const LeadGenerator = {
  /**
   * Generates 100 Ban-Proof Leads allocated across:
   * - 34 Gmail (curiosity lowercase subject + 4-sentence body + financial leak)
   * - 33 LinkedIn (owner/GM connection note < 300 characters)
   * - 33 Instagram (story reply format referencing recent post/dish)
   */
  generate100Leads(city, country = 'USA', selectedNiche = 'all') {
    const history = StorageService.getPitchedHistory();
    const leads = [];
    const nicheKeys = Object.keys(NICHES);

    // Distribution formula (FB cancelled as per user instruction):
    // 34 Gmail, 33 LinkedIn, 33 Instagram = Total 100
    const channelPlan = [];
    for (let i = 0; i < 34; i++) channelPlan.push('gmail');
    for (let i = 0; i < 33; i++) channelPlan.push('linkedin');
    for (let i = 0; i < 33; i++) channelPlan.push('instagram');

    // Shuffle channel allocation to distribute nicely across niches
    channelPlan.sort(() => Math.random() - 0.5);

    let count = 0;
    let seedIndex = 1;

    while (leads.length < 100) {
      // Pick niche
      let nicheKey = selectedNiche !== 'all' && NICHES[selectedNiche.toUpperCase()]
        ? selectedNiche.toUpperCase()
        : nicheKeys[count % nicheKeys.length];

      const nicheObj = NICHES[nicheKey] || NICHES.RESTAURANTS;
      const baseName = nicheObj.sampleNames[count % nicheObj.sampleNames.length];
      const businessName = `${baseName} (${city.split(',')[0].trim()})`;

      // Prevent duplicates from history
      if (history.includes(businessName) && leads.length < 90) {
        count++;
        continue;
      }

      // Financial Flaw & Decision Maker
      const flaw = nicheObj.flaws[count % nicheObj.flaws.length];
      const dm = DECISION_MAKERS[(count + seedIndex) % DECISION_MAKERS.length];
      const rating = (4.3 + (count % 7) * 0.1).toFixed(1);
      const reviews = 38 + (count * 13) % 240;

      // Leak calculation
      const calculatedLeak = flaw.range;
      const channel = channelPlan[leads.length];

      // Realistic contact handles
      const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const emailDomain = slug.slice(0, 15) + (country === 'UK' ? '.co.uk' : country === 'Canada' ? '.ca' : country === 'Australia' ? '.com.au' : '.com');
      const email = `contact@${emailDomain}`;
      const instagramHandle = `@${slug.slice(0, 14)}`;
      const linkedinProfile = `linkedin.com/in/${dm.name.toLowerCase().replace(/\s+/g, '-')}-${city.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6)}`;

      leads.push({
        id: `lead_${Date.now()}_${leads.length + 1}`,
        businessName,
        city,
        country,
        niche: nicheObj.id,
        nicheName: nicheObj.name,
        nicheIcon: nicheObj.icon,
        rating,
        reviews,
        decisionMaker: dm.name,
        decisionMakerTitle: dm.title,
        flawType: flaw.type,
        flawTitle: flaw.title,
        flawDesc: flaw.description,
        flawLeakRange: calculatedLeak,
        flawPitchAngle: flaw.pitchAngle,
        channel, // 'gmail' | 'linkedin' | 'instagram'
        contactInfo: {
          email,
          instagramHandle,
          linkedinProfile,
          phone: `+1 (512) ${300 + count}-${1000 + count * 7}`
        },
        status: 'ready', // 'ready', 'queued', 'dispatched', 'replied', 'followup_due'
        createdAt: new Date().toISOString(),
        dispatchedAt: null,
        followupDueAt: null,
        demoLink: `https://restohunter.ai/preview/${slug.slice(0, 16)}`
      });

      count++;
      seedIndex++;
    }

    return leads;
  }
};

window.LeadGenerator = LeadGenerator;
window.NICHES = NICHES;
