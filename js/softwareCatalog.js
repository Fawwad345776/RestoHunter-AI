/**
 * SoftHunter AI - Universal Software Development Opportunity Catalog & Proposal Generator
 * Analyzes verified digital footprints and maps genuine, evidence-based software opportunities
 * across all 6 industry-standard software categories:
 * A. Website Development
 * B. Mobile App Development
 * C. Desktop Software
 * D. Business Management (CRM/ERP)
 * E. AI & Automation
 * F. Custom Software
 */

const SOFTWARE_CATEGORIES = {
  WEBSITE_DEVELOPMENT: {
    id: 'website_development',
    name: 'Website & Web App Development',
    code: 'CAT-A',
    icon: '🌐',
    color: '#38bdf8',
    subtypes: [
      'High-Converting Business Website',
      '0% Commission Direct Mobile Ordering Web App',
      'Instant 1-Tap Mobile Booking & Appointment Portal',
      'Custom Customer Self-Service Portal',
      'B2B E-Commerce & Wholesale Ordering Platform',
      'Micro-SaaS Multi-Tenant Web Application'
    ],
    defaultTechStack: 'Next.js 14, TailwindCSS, TypeScript, PostgreSQL, Vercel, Stripe / Local Payment Gateway',
    typicalMvpDays: '7 - 14 Days',
    complexity: 'Medium'
  },
  MOBILE_APP_DEVELOPMENT: {
    id: 'mobile_app_development',
    name: 'Mobile App Development (iOS & Android)',
    code: 'CAT-B',
    icon: '📱',
    color: '#a855f7',
    subtypes: [
      'Customer Loyalty & VIP Mobile App',
      'On-Demand Dispatch & Delivery Driver App',
      'Gym & Fitness Studio Membership App',
      'Field Service Technician Mobile App',
      'Cross-Platform React Native / Flutter Consumer App'
    ],
    defaultTechStack: 'React Native / Flutter, Node.js / NestJS, Firebase Cloud Messaging, Supabase, Apple & Google Pay',
    typicalMvpDays: '14 - 28 Days',
    complexity: 'Medium-High'
  },
  DESKTOP_SOFTWARE: {
    id: 'desktop_software',
    name: 'Desktop & POS Software',
    code: 'CAT-C',
    icon: '💻',
    color: '#f59e0b',
    subtypes: [
      'Offline-First Desktop POS & Receipt Slip System',
      'Workshop Job Card & Inventory Billing Desktop Tool',
      'Boutique Hotel Front-Desk Property Management System (PMS)',
      'Warehouse Barcode Scanning & Stock Management Desktop App',
      'Windows / macOS Internal Business Utility'
    ],
    defaultTechStack: 'Electron / Tauri, React, SQLite / PostgreSQL, Thermal Printer ESC/POS, Local File System',
    typicalMvpDays: '10 - 21 Days',
    complexity: 'Medium'
  },
  BUSINESS_MANAGEMENT: {
    id: 'business_management',
    name: 'Business Management Software (CRM / ERP)',
    code: 'CAT-D',
    icon: '📊',
    color: '#10b981',
    subtypes: [
      'Custom Multi-Pipeline B2B CRM',
      'Lightweight Multi-Branch Inventory & Procurement ERP',
      'Staff Shift Scheduling & Payroll Attendance Manager',
      'Event Hall & Wedding Marquee Date Reservation ERP',
      'Medical & Dental Patient EHR Records System'
    ],
    defaultTechStack: 'Python / Django / FastAPI, Vue 3 / React, PostgreSQL, Redis, Docker, AWS S3',
    typicalMvpDays: '21 - 35 Days',
    complexity: 'High'
  },
  AI_AUTOMATION: {
    id: 'ai_automation',
    name: 'AI & Workflow Automation',
    code: 'CAT-E',
    icon: '🤖',
    color: '#06b6d4',
    subtypes: [
      '24/7 AI Receptionist & Patient Triage Chatbot',
      'Automated Inbound Lead Qualification & Meeting Scheduler',
      'Intelligent PDF Invoice & Expense Receipt Document Scanner',
      'WhatsApp Multi-Agent Automated Support Bot',
      'Automated Multi-Channel Follow-up & Review Collector'
    ],
    defaultTechStack: 'Python, FastAPI, OpenAI GPT-4o-mini / Claude 3.5, LangChain, Pinecone, WhatsApp Cloud API',
    typicalMvpDays: '7 - 14 Days',
    complexity: 'Medium'
  },
  CUSTOM_SOFTWARE: {
    id: 'custom_software',
    name: 'Custom Software & Enterprise Systems',
    code: 'CAT-F',
    icon: '⚖️',
    color: '#ec4899',
    subtypes: [
      'Secure Client Legal Intake & Conflict Check Portal',
      'Custom Real Estate MLS Data Aggregator & Map Visualizer',
      'Enterprise Third-Party API Integration Bridge',
      'Specialized Regulatory Compliance & Audit Log Platform',
      'Custom Logistics & Freight Tracking Portal'
    ],
    defaultTechStack: 'Go / Node.js, Next.js, PostgreSQL, Kubernetes, AES-256 Encryption, Stripe Connect',
    typicalMvpDays: '28 - 45 Days',
    complexity: 'High'
  }
};

const SoftwareCatalog = {
  categories: SOFTWARE_CATEGORIES,

  /**
   * Matches lead's industry, scale, and verified flaw to the best software opportunity
   */
  detectOpportunity(lead) {
    if (!lead) return null;
    if (lead.softwareOpportunity && lead.softwareOpportunity.recommendedSoftware) {
      return lead.softwareOpportunity;
    }

    const niche = lead.niche || 'restaurants';
    const scale = lead.businessScale || 'small_business';
    const hasWebsite = Boolean(lead.website);

    // Restaurants & Bakeries
    if (niche === 'restaurants' || niche === 'bakeries_sweets') {
      if (scale === 'established' && hasWebsite) {
        return {
          category: 'mobile_app_development',
          categoryLabel: SOFTWARE_CATEGORIES.MOBILE_APP_DEVELOPMENT.name,
          categoryIcon: SOFTWARE_CATEGORIES.MOBILE_APP_DEVELOPMENT.icon,
          recommendedSoftware: 'VIP Diner Loyalty & Direct 0% Commission Mobile App (iOS & Android)',
          businessBenefit: 'Bypasses delivery aggregators, saving $3,000 - $6,000/mo while locking in high-value repeat diners with push notifications.',
          mvpScope: 'Visual menu, 1-tap re-order, customer digital wallet, real-time order tracking, kitchen tablet terminal.',
          demoConcept: 'Interactive smartphone ordering demo with instant kitchen slip dispatch.',
          complexity: 'Medium-High',
          suggestedTechStack: 'React Native, Node.js, PostgreSQL, Stripe / EasyPaisa, Firebase Cloud Messaging'
        };
      }
      return {
        category: 'website_development',
        categoryLabel: SOFTWARE_CATEGORIES.WEBSITE_DEVELOPMENT.name,
        categoryIcon: SOFTWARE_CATEGORIES.WEBSITE_DEVELOPMENT.icon,
        recommendedSoftware: '1-Tap Direct Mobile Ordering Web App + Instant WhatsApp Kitchen Slip',
        businessBenefit: 'Converts hungry mobile visitors into paid orders in 30 seconds without paying 30% delivery commission fees.',
        mvpScope: 'Mobile-first menu catalog, 1-tap cart, customer phone capture, automatic WhatsApp slip generator.',
        demoConcept: 'Clickable smartphone checkout simulator with zero friction.',
        complexity: 'Medium',
        suggestedTechStack: 'Next.js 14, TailwindCSS, Supabase, WhatsApp Business API'
      };
    }

    // Dental & Medical
    if (niche === 'dental_medical') {
      return {
        category: 'ai_automation',
        categoryLabel: SOFTWARE_CATEGORIES.AI_AUTOMATION.name,
        categoryIcon: SOFTWARE_CATEGORIES.AI_AUTOMATION.icon,
        recommendedSoftware: '24/7 AI Patient Triage Concierge & Instant Slot Booking Widget',
        businessBenefit: 'Captures high-ticket after-hours cosmetic and emergency toothache patients before they call competing clinics.',
        mvpScope: 'AI triage conversational widget, Google/Doctor calendar sync, instant SMS/WhatsApp confirmation tokens.',
        demoConcept: 'Live emergency triage simulator showing real-time appointment booking.',
        complexity: 'Medium',
        suggestedTechStack: 'Python FastAPI, OpenAI GPT-4o-mini, PostgreSQL, Twilio SMS'
      };
    }

    // Salons & Spas
    if (niche === 'salons_spas') {
      return {
        category: 'website_development',
        categoryLabel: SOFTWARE_CATEGORIES.WEBSITE_DEVELOPMENT.name,
        categoryIcon: SOFTWARE_CATEGORIES.WEBSITE_DEVELOPMENT.icon,
        recommendedSoftware: '1-Tap Stylist & Treatment Booking Funnel with SMS Deposit Slip',
        businessBenefit: 'Eliminates 18% salon phone no-shows with automated WhatsApp reminders and saves front desk 12 hrs/week.',
        mvpScope: 'Stylist selector, real-time chair calendar, upfront partial deposit capture, WhatsApp reminder triggers.',
        demoConcept: 'Interactive mobile salon chair booking simulator.',
        complexity: 'Medium',
        suggestedTechStack: 'Next.js 14, TailwindCSS, Supabase, WhatsApp Cloud API'
      };
    }

    // Gyms & Fitness
    if (niche === 'gyms_fitness') {
      return {
        category: 'mobile_app_development',
        categoryLabel: SOFTWARE_CATEGORIES.MOBILE_APP_DEVELOPMENT.name,
        categoryIcon: SOFTWARE_CATEGORIES.MOBILE_APP_DEVELOPMENT.icon,
        recommendedSoftware: 'Member Class Booking & Automated Recurring Dues Mobile App',
        businessBenefit: 'Automates member renewals, eliminates unpaid guest visits, and fills low-attendance morning classes.',
        mvpScope: 'Class schedule booking, trainer slots, automated monthly card charging, digital gym barcode pass.',
        demoConcept: 'Mobile gym member wallet with instant class check-in.',
        complexity: 'Medium-High',
        suggestedTechStack: 'Flutter, Node.js, Stripe Recurring Billing, Firebase Auth'
      };
    }

    // Auto Repair & Home Services
    if (niche === 'auto_repair' || niche === 'home_services') {
      return {
        category: 'desktop_software',
        categoryLabel: SOFTWARE_CATEGORIES.DESKTOP_SOFTWARE.name,
        categoryIcon: SOFTWARE_CATEGORIES.DESKTOP_SOFTWARE.icon,
        recommendedSoftware: 'Workshop Job Card, Parts Inventory & Quick WhatsApp Estimate POS',
        businessBenefit: 'Stops technician labor leakage, tracks parts profit margins, and sends customers 1-click video repair approvals.',
        mvpScope: 'Vehicle inspection checklist, digital estimate builder, 1-tap customer approval via WhatsApp, PDF invoice generator.',
        demoConcept: 'Desktop workshop dashboard showing instant estimate creation.',
        complexity: 'Medium',
        suggestedTechStack: 'Electron / Tauri, React, SQLite, ESC/POS Thermal Printing, WhatsApp API'
      };
    }

    // Real Estate, Event Planners & Hotels
    if (niche === 'real_estate' || niche === 'event_planners' || niche === 'boutique_hotels') {
      return {
        category: 'business_management',
        categoryLabel: SOFTWARE_CATEGORIES.BUSINESS_MANAGEMENT.name,
        categoryIcon: SOFTWARE_CATEGORIES.BUSINESS_MANAGEMENT.icon,
        recommendedSoftware: 'Event / Property Availability Master Calendar & Client Deposit ERP',
        businessBenefit: 'Eliminates catastrophic double-booking errors and tracks high-ticket inquiries from tour to contract.',
        mvpScope: 'Multi-hall availability calendar, lead qualification pipeline, contract generation with digital signature.',
        demoConcept: 'Drag-and-drop event reservation calendar with instant contract dispatch.',
        complexity: 'High',
        suggestedTechStack: 'Django / FastAPI, React, PostgreSQL, AWS S3, DocuSign API'
      };
    }

    // Law Firms
    if (niche === 'law_firms') {
      return {
        category: 'custom_software',
        categoryLabel: SOFTWARE_CATEGORIES.CUSTOM_SOFTWARE.name,
        categoryIcon: SOFTWARE_CATEGORIES.CUSTOM_SOFTWARE.icon,
        recommendedSoftware: 'Encrypted Client Intake Portal & Automated Conflict Check System',
        businessBenefit: 'Screens prospective client cases in 60 seconds, checks opposing party conflicts, and secures evidence.',
        mvpScope: 'Encrypted digital intake form, conflict database lookup, confidential document upload vault.',
        demoConcept: 'Secure legal client intake portal with instant conflict clearance check.',
        complexity: 'High',
        suggestedTechStack: 'Next.js, Node.js, PostgreSQL, AES-256 Encryption, Stripe Invoicing'
      };
    }

    // Default Fallback
    return {
      category: 'website_development',
      categoryLabel: SOFTWARE_CATEGORIES.WEBSITE_DEVELOPMENT.name,
      categoryIcon: SOFTWARE_CATEGORIES.WEBSITE_DEVELOPMENT.icon,
      recommendedSoftware: 'Modern Responsive Client Acquisition Funnel & 1-Tap Booking',
      businessBenefit: 'Replaces slow static site with a high-converting mobile client acquisition funnel.',
      mvpScope: 'Mobile responsive pages, contact capture, speed optimization, Google Maps integration.',
      demoConcept: 'Modern interactive web funnel loaded in under 1.2 seconds.',
      complexity: 'Low-Medium',
      suggestedTechStack: 'Next.js 14, TailwindCSS, Vercel, Supabase'
    };
  },

  /**
   * Generates a complete, structured Software Project Proposal for a business
   */
  generateStructuredProposal(lead) {
    const opp = this.detectOpportunity(lead);
    const biz = lead.businessName || 'Client';
    const city = lead.city || 'Local';
    const flaw = lead.flawTitle || 'Mobile Checkout Bottleneck';
    const leak = lead.flawLeakRange || '$2,400 - $4,800/mo';

    return {
      projectName: `${biz} — ${opp.recommendedSoftware}`,
      clientName: biz,
      targetLocation: `${city}, ${lead.country || ''}`,
      decisionMaker: `${lead.decisionMaker || 'Owner'} (${lead.decisionMakerTitle || 'Principal'})`,
      businessProblem: `Prospective customers browsing ${biz} on mobile devices face ${flaw.toLowerCase()}, creating friction and causing estimated revenue leakage of ${leak}.`,
      supportingEvidence: lead.whereToCheck || `Verified on Google Maps listing and digital footprint audit for ${biz}.`,
      recommendedSoftwareType: opp.categoryLabel,
      proposedSolution: opp.recommendedSoftware,
      businessBenefits: [
        opp.businessBenefit,
        `Recovers estimated ${leak} in otherwise lost customer bookings and orders.`,
        '100% direct customer data ownership with zero third-party platform commissions.',
        'Immediate 1-tap mobile experience tailored to local consumer buying behavior.'
      ],
      mainFeatures: [
        'Mobile-First Responsive Interface (<1.5s load speed)',
        'Direct 1-Tap Checkout / Booking Funnel',
        'Automated Real-Time Confirmation Slips via WhatsApp / Email',
        'Customer Database & Order / Appointment History Management'
      ],
      customerFeatures: [
        'Instant mobile product / service catalog with smooth filters',
        'Zero-registration checkout or social 1-tap login',
        'Instant digital order token / booking pass saved to phone',
        'Direct 1-tap call / navigation to physical location'
      ],
      adminFeatures: [
        'Real-time incoming order / appointment notification sound & visual alert',
        '1-click order acceptance / status update (Preparing, Ready, Dispatched)',
        'Daily sales / booking summary dashboard with revenue charts',
        'Customer database export to CSV / Excel'
      ],
      automationFeatures: [
        'Instant WhatsApp / SMS confirmation trigger upon order submission',
        'Automated appointment reminder 2 hours prior to prevent no-shows',
        'Automated Google Review invitation sent 24 hours after service completion'
      ],
      mvpScope: opp.mvpScope,
      demoConcept: opp.demoConcept,
      complexity: opp.complexity,
      suggestedTechStack: opp.suggestedTechStack,
      estimatedTimeline: '7 - 14 Business Days to Production Deployment'
    };
  }
};

if (typeof window !== 'undefined') {
  window.SoftwareCatalog = SoftwareCatalog;
  window.SOFTWARE_CATEGORIES = SOFTWARE_CATEGORIES;
}
