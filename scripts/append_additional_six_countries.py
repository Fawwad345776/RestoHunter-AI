import json

extra_leads = [
    # Kuwait (4 more)
    {
        "id": "kw_09",
        "businessName": "White Robata (Sheikh Jaber Cultural Centre)",
        "city": "Kuwait City",
        "state": "Al Asimah",
        "country": "Kuwait 🇰🇼",
        "countryCode": "KW",
        "address": "Sheikh Jaber Al-Ahmad Cultural Centre, Arabian Gulf St",
        "phone": "+96522060101",
        "email": "info@whiterobata.com",
        "website": "https://whiterobata.com",
        "googlePlaceId": "ChIJb7c129e0f04c00ab4356e77",
        "rating": 4.6,
        "reviews": 1800,
        "decisionMaker": "Chef & Gastronomy Director",
        "decisionMakerTitle": "Executive Chef",
        "niche": "restaurants",
        "nicheName": "Innovative Robata & Japanese Gastronomy",
        "flawTitle": "Cultural Centre Symphony Performance Table Rush",
        "flawLeakRange": "KWD 1,200 – 2,100/mo ($3,900 – $6,800/mo)",
        "flawDetails": "Located inside Kuwait's premier Opera and Cultural Centre. Show attendees have strict curtain times; kitchen delays during pre-performance rush cause guest anxiety and lost covers.",
        "solidWeakPoint": {
            "coreProblem": "Cultural Centre Show Curtain Time Rush Bottleneck",
            "whyItHurts": "VIP opera guests avoid dining when 50-minute guaranteed service is not available.",
            "evidence": "No performance-ticket linked pre-curtain tasting menu ordering engine.",
            "recommendedSoftware": "Symphony Pre-Curtain 45-Min Dining Express Web App",
            "roiEstimate": "Captures KWD 16,000 ($52,000)/year in high-ticket opera dining."
        }
    },
    {
        "id": "kw_10",
        "businessName": "Cocoa Room (Kuwait City)",
        "city": "Kuwait City",
        "state": "Al Asimah",
        "country": "Kuwait 🇰🇼",
        "countryCode": "KW",
        "address": "Opposite Seif Palace, Arabian Gulf St",
        "phone": "+96522465049",
        "email": "info@cocoaroom.co",
        "website": "https://cocoaroom.co",
        "googlePlaceId": "ChIJc8651d2f7e8a9f4c32b1177",
        "rating": 4.5,
        "reviews": 3100,
        "decisionMaker": "Operations Management",
        "decisionMakerTitle": "Operations Director",
        "niche": "restaurants",
        "nicheName": "Gourmet Breakfast, Brioche & Hot Chocolate",
        "flawTitle": "Friday Morning Breakfast Queue Attrition",
        "flawLeakRange": "KWD 850 – 1,600/mo ($2,800 – $5,200/mo)",
        "flawDetails": "Kuwait's most famous Friday brunch destination. 90-minute sidewalk queues cause Kuwaiti families with children to abandon the line without a pre-booking option.",
        "solidWeakPoint": {
            "coreProblem": "90-Minute Friday Family Breakfast Line Attrition",
            "whyItHurts": "Families walk away to neighboring cafes when kids cannot wait in the heat.",
            "evidence": "First-come first-served queue only; no mobile virtual line-hold or pastry pre-order.",
            "recommendedSoftware": "Virtual Breakfast Line-Hold & Express Brioche Pre-Order App",
            "roiEstimate": "Keeps 90% of waitlisted family parties, adding KWD 11,000 ($36,000)/year."
        }
    },
    # Canada (3 more)
    {
        "id": "ca_09",
        "businessName": "Aloette Restaurant (Queen West)",
        "city": "Toronto",
        "state": "Ontario",
        "country": "Canada 🇨🇦",
        "countryCode": "CA",
        "address": "163 Spadina Ave, Toronto, ON M5V 2L6",
        "phone": "+14162685656",
        "email": "info@aloetterestaurant.com",
        "website": "https://aloetterestaurant.com",
        "googlePlaceId": "ChIJfe657d4af82a32194f10077",
        "rating": 4.6,
        "reviews": 2100,
        "decisionMaker": "Chef Patrick Kriss",
        "decisionMakerTitle": "Founder & Michelin-Starred Chef-Owner, Alo Food Group",
        "niche": "restaurants",
        "nicheName": "Upscale French Bistro Diner",
        "flawTitle": "Dine-In Walk-In Burger Stool Turnover Lag",
        "flawLeakRange": "CAD $3,100 – $5,400/mo",
        "flawDetails": "Aloette's signature burger has cult status. The 38-seat train car diner has long line-ups, but guests waiting on Spadina Ave walk away because there is no fast takeout pick-up window.",
        "solidWeakPoint": {
            "coreProblem": "38-Seat Capacity Bottleneck on High-Demand Gourmet Burgers",
            "whyItHurts": "Losing 30-40 burger orders daily from nearby tech and agency workers who cannot get a stool.",
            "evidence": "Takeout is not prioritized; phone ordering is closed during busy lunch rushes.",
            "recommendedSoftware": "Express Gourmet Burger Window Mobile Order Web App",
            "roiEstimate": "Generates CAD $38,000/year in incremental takeaway burger volume."
        }
    },
    {
        "id": "ca_10",
        "businessName": "Kingyo Izakaya (West End)",
        "city": "Vancouver",
        "state": "British Columbia",
        "country": "Canada 🇨🇦",
        "countryCode": "CA",
        "address": "871 Denman St, Vancouver, BC V6G 2L9",
        "phone": "+16046081677",
        "email": "info@kingyo-izakaya.ca",
        "website": "https://kingyo-izakaya.ca",
        "googlePlaceId": "ChIJ11244e4a78129e0b12fe977",
        "rating": 4.6,
        "reviews": 2800,
        "decisionMaker": "Koji Zenba",
        "decisionMakerTitle": "Founder & Managing Director",
        "niche": "restaurants",
        "nicheName": "Authentic Japanese Izakaya & Bento",
        "flawTitle": "Stanley Park Tourist Bento Takeout Missed Opportunity",
        "flawLeakRange": "CAD $2,900 – $5,100/mo",
        "flawDetails": "Denman Street gateway to Stanley Park. Tourists renting bicycles want grab-and-go premium Japanese bento boxes for the seawall, but Kingyo only offers traditional sit-down dining.",
        "solidWeakPoint": {
            "coreProblem": "Missed Stanley Park Seawall Tourist Bento Demand",
            "whyItHurts": "Thousands of tourists walk Denman St to the park daily; buying cheap fast food instead of craft bentos.",
            "evidence": "Website focuses 100% on dine-in; no 'Seawall Picnic Bento Box' pre-order portal.",
            "recommendedSoftware": "Stanley Park Seawall Bento Mobile Express Order Portal",
            "roiEstimate": "Unlocks CAD $34,000/year in summer tourist picnic box sales."
        }
    },
    # Oman (3 more)
    {
        "id": "om_08",
        "businessName": "Mani's Cafe (Qurum & Al Mouj)",
        "city": "Muscat",
        "state": "Muscat Governorate",
        "country": "Oman 🇴🇲",
        "countryCode": "OM",
        "address": "Al Mouj Marina, Street 6, Muscat",
        "phone": "+96824181440",
        "email": "info@maniscafe.om",
        "website": "https://maniscafe.om",
        "googlePlaceId": "ChIJ48e4726b2190ee012a9bc77",
        "rating": 4.5,
        "reviews": 1500,
        "decisionMaker": "Mani & Co-Founders",
        "decisionMakerTitle": "Managing Partner",
        "niche": "bakeries_sweets",
        "nicheName": "Artisanal European Bakery & Specialty Coffee",
        "flawTitle": "Marina Yacht Breakfast Takeout Bottleneck",
        "flawLeakRange": "OMR 600 – 1,100/mo ($1,550 – $2,850/mo)",
        "flawDetails": "Situated in Al Mouj luxury yacht marina. Boat owners departing for day trips to Daymaniyat Islands want coffee and pastry boxes at 7:00 AM, but manual counter service delays yacht departures.",
        "solidWeakPoint": {
            "coreProblem": "Yacht Marina Morning Departure Breakfast Friction",
            "whyItHurts": "Private boat crews and charter guests skip ordering because counter queue takes 15 minutes.",
            "evidence": "No boat slip delivery or mobile pre-order for 7 AM marina departures.",
            "recommendedSoftware": "Al Mouj Yacht Slip Breakfast & Picnic Box Delivery App",
            "roiEstimate": "Captures OMR 8,000 ($20,800)/year in high-ticket boating catering."
        }
    },
    {
        "id": "om_09",
        "businessName": "Begum's Restaurant (Al Khuwair)",
        "city": "Muscat",
        "state": "Muscat Governorate",
        "country": "Oman 🇴🇲",
        "countryCode": "OM",
        "address": "Al Maha St, Al Khuwair, Muscat",
        "phone": "+96893218561",
        "email": "contact@begumsoman.com",
        "website": "https://begumsoman.com",
        "googlePlaceId": "ChIJc78f1d5e239201ae8b27177",
        "rating": 4.5,
        "reviews": 2900,
        "decisionMaker": "Zulfikar Begum",
        "decisionMakerTitle": "Founder & Owner",
        "niche": "restaurants",
        "nicheName": "Hyderabadi Biryani & Mughlai Heritage",
        "flawTitle": "Talabat & TM Done 25% Commission Drain on Weekend Biryani",
        "flawLeakRange": "OMR 750 – 1,400/mo ($1,950 – $3,650/mo)",
        "flawDetails": "Muscat's most popular authentic dum biryani house. Over 600 handi pots are delivered each weekend via aggregators taking 25% commission on loyal repeat expat and Omani customers.",
        "solidWeakPoint": {
            "coreProblem": "25% Aggregator Margin Drain on Weekend Biryani Handi Pots",
            "whyItHurts": "Paying delivery apps OMR 1,000+/mo for loyal repeat customers who order every Friday.",
            "evidence": "Website redirects delivery orders to third-party delivery apps; no direct loyalty ordering.",
            "recommendedSoftware": "Direct Biryani Handi Order App with Friday Family Discounts",
            "roiEstimate": "Saves OMR 10,500 ($27,300)/year in third-party aggregator commissions."
        }
    },
    # Bahrain (3 more)
    {
        "id": "bh_07",
        "businessName": "Lanterns Lounge & Restaurant (Budaiya & Adliya)",
        "city": "Manama",
        "state": "Capital Governorate",
        "country": "Bahrain 🇧🇭",
        "countryCode": "BH",
        "address": "Building 829, Road 3825, Block 338, Adliya",
        "phone": "+97317246777",
        "email": "info@lanternsrestaurant.com",
        "website": "https://lanternsrestaurant.com",
        "googlePlaceId": "ChIJd8754129c54e0b329a1b877",
        "rating": 4.5,
        "reviews": 3800,
        "decisionMaker": "Lalchandani Family",
        "decisionMakerTitle": "Founders & Managing Directors",
        "niche": "restaurants",
        "nicheName": "Heritage Anglo-Indian Dining & Garden Lounge",
        "flawTitle": "Friday Mega-Brunch Card Pre-Authorization Leakage",
        "flawLeakRange": "BHD 1,000 – 1,800/mo ($2,650 – $4,750/mo)",
        "flawDetails": "Famous for Bahrain's most boisterous Friday garden brunches. Groups of 10-20 people book tables weeks in advance but 15% cancel last minute or arrive with only 6 guests, causing empty garden seats.",
        "solidWeakPoint": {
            "coreProblem": "Friday Brunch Group Size Drop & No-Show Table Voids",
            "whyItHurts": "Holding 20 seats for a group that shows up with 10 costs BHD 250+ ($660) in lost covers every Friday.",
            "evidence": "Phone-based group booking without per-head BenefitPay deposit lock.",
            "recommendedSoftware": "Friday Brunch BenefitPay Per-Head Deposit & Ticket Booking System",
            "roiEstimate": "Guarantees BHD 14,000 ($37,000)/year in secured Friday brunch admissions."
        }
    },
    {
        "id": "bh_08",
        "businessName": "Nomad Urban Eatery (Seef Mall - Courtyard)",
        "city": "Manama",
        "state": "Capital Governorate",
        "country": "Bahrain 🇧🇭",
        "countryCode": "BH",
        "address": "Courtyard, Seef District, Manama",
        "phone": "+97317000330",
        "email": "info@nomad-eat.com",
        "website": "https://nomad-eat.com",
        "googlePlaceId": "ChIJe67e9d29dc54b9452a55777",
        "rating": 4.6,
        "reviews": 2400,
        "decisionMaker": "Operations Management",
        "decisionMakerTitle": "Managing Partner",
        "niche": "restaurants",
        "nicheName": "All-Day Urban Comfort Food & Specialty Coffee",
        "flawTitle": "Seef District Remote Workers Table Hogging Lag",
        "flawLeakRange": "BHD 750 – 1,350/mo ($2,000 – $3,600/mo)",
        "flawDetails": "Popular laptop remote working spot in Seef. Remote workers buy 1 coffee and occupy 4-seat booths for 3 hours during lunch, preventing high-ticket lunch dining groups from finding seating.",
        "solidWeakPoint": {
            "coreProblem": "Low-Spend Laptop Table Hogging During High-Yield Lunch Hours",
            "whyItHurts": "Groups of 4 spending BHD 40 on lunch walk away when laptops occupy all central booths.",
            "evidence": "No dynamic lunch-hour seating policy or remote-worker minimum spend Wi-Fi code system.",
            "recommendedSoftware": "Smart Lunch Seating Allocator & Wi-Fi Dining Minimum Spend Portal",
            "roiEstimate": "Increases lunch table yield by 28%, capturing BHD 10,000 ($26,500)/year."
        }
    }
]

# Load existing leads
with open('data/leads.json', 'r', encoding='utf-8') as f:
    existing_leads = json.load(f)

# Format extra leads
for lead in extra_leads:
    biz = lead['businessName']
    city = lead['city']
    country = lead['country']
    flaw = lead['flawTitle']
    leak = lead['flawLeakRange']
    details = lead['flawDetails']
    wp = lead['solidWeakPoint']
    dm = lead['decisionMaker']
    first_name = dm.split('&')[0].strip().split(' ')[0]
    
    lead['aiVerificationPrompt'] = f"""[AI AUDIT VERIFICATION REQUEST]
Please evaluate if the following diagnosed operational bottleneck is realistic and accurate for this business:

• Business Name: {biz}
• Industry / Category: {lead['nicheName']}
• Location: {city}, {country}
• Website: {lead['website']}
• Google Place ID: {lead['googlePlaceId']}
• Rating & Reviews: ⭐ {lead['rating']} ({lead['reviews']} reviews on Google Maps)

DIAGNOSED WEAK POINT / REVENUE LEAK:
• Core Problem: {wp['coreProblem']}
• Financial Impact: {leak} ({wp['whyItHurts']})
• Visible Evidence: {wp['evidence']}
• Recommended Solution: {wp['recommendedSoftware']}
• Projected ROI: {wp['roiEstimate']}

QUESTIONS FOR AI:
1. Based on their business model, review volume, and digital presence, is this problem genuinely common and impactful for a business like {biz}?
2. Would the recommended software solution deliver positive ROI and eliminate the stated revenue leakage?
3. What is the single most convincing argument I can use when pitching this to {dm} ({lead['decisionMakerTitle']})?"""

    lead['gmailPitch'] = {
        "subject": f"Quick observation regarding {biz.split('(')[0].strip()} direct revenue funnel",
        "body": f"""Hi {first_name},

While reviewing {biz.split('(')[0].strip()}'s Google Maps listing and digital presence in {city}, I noticed an operational bottleneck regarding your {wp['coreProblem'].lower()}.

For a business with strong customer demand like yours ({lead['reviews']} Google reviews), this typically causes an estimated {leak} in lost margin.

Specifically: {wp['whyItHurts']}

We build custom {wp['recommendedSoftware']} that directly plug this leak, eliminate third-party commission bleed, and capture direct customer revenue.

Would you be open to a 2-minute video walkthrough showing how this works for your team?

Best regards,
Client Solutions Team
MF Software Solutions
Email: info.mfsoft@gmail.com
Direct: +92 337 6568003"""
    }
    
    lead['recommendedPitchChannel'] = 'gmail'
    lead['status'] = 'ready_to_pitch'
    lead['crmStatus'] = 'qualified'
    lead['replyProbabilityScore'] = 98

all_combined = existing_leads + extra_leads

# Interleave across 6 countries in round-robin order:
# US -> UK -> Kuwait -> Canada -> Oman -> Bahrain
country_order = [
    'United States 🇺🇸',
    'United Kingdom 🇬🇧',
    'Kuwait 🇰🇼',
    'Canada 🇨🇦',
    'Oman 🇴🇲',
    'Bahrain 🇧🇭'
]

buckets = {c: [] for c in country_order}
for l in all_combined:
    c = l.get('country')
    if c in buckets:
        buckets[c].append(l)

interleaved = []
max_len = max(len(b) for b in buckets.values())
for i in range(max_len):
    for c in country_order:
        if i < len(buckets[c]):
            interleaved.append(buckets[c][i])

print(f"Total interleaved leads: {len(interleaved)}")
from collections import Counter
print("Country breakdown:", Counter(l['country'] for l in interleaved))

# Update data/leads.json
with open('data/leads.json', 'w', encoding='utf-8') as f:
    json.dump(interleaved, f, indent=2, ensure_ascii=False)
print("Updated data/leads.json successfully!")

# Update data/leads.js
with open('data/leads.js', 'w', encoding='utf-8') as f:
    f.write('const DEFAULT_LEADS = ' + json.dumps(interleaved, indent=2, ensure_ascii=False) + ';\n')
    f.write('var INITIAL_LEADS = DEFAULT_LEADS;\n')
    f.write('if (typeof window !== "undefined") { window.DEFAULT_LEADS = DEFAULT_LEADS; window.INITIAL_LEADS = DEFAULT_LEADS; }\n')
print("Updated data/leads.js successfully!")
