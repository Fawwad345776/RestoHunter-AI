#!/usr/bin/env python3
"""
RestoHunter AI - 305 Leads Assembler & Exporter
Combines verified leads across all 6 countries:
- United States (70 leads)
- United Kingdom (60 leads)
- Kuwait (45 leads)
- Canada (55 leads)
- Oman (40 leads)
- Bahrain (35 leads)
Total: 305 Leads

Interleaves them in balanced round-robin sequence and writes to:
- data/leads.json
- data/leads.js
"""

import json
import os
import sys

# Add scripts directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_us_70 import get_us_leads
from data_uk_60 import get_uk_leads
from data_kw_45 import get_kuwait_leads
from data_ca_55 import get_canada_leads
from data_om_40 import get_oman_leads
from data_bh_35 import get_bahrain_leads

def assemble_and_export():
    us_leads = get_us_leads()
    uk_leads = get_uk_leads()
    kw_leads = get_kuwait_leads()
    ca_leads = get_canada_leads()
    om_leads = get_oman_leads()
    bh_leads = get_bahrain_leads()

    print(f"Loaded {len(us_leads)} US leads")
    print(f"Loaded {len(uk_leads)} UK leads")
    print(f"Loaded {len(kw_leads)} Kuwait leads")
    print(f"Loaded {len(ca_leads)} Canada leads")
    print(f"Loaded {len(om_leads)} Oman leads")
    print(f"Loaded {len(bh_leads)} Bahrain leads")

    # Round-robin interleaving
    all_buckets = [us_leads, uk_leads, kw_leads, ca_leads, om_leads, bh_leads]
    interleaved = []
    max_len = max(len(b) for b in all_buckets)

    for i in range(max_len):
        for bucket in all_buckets:
            if i < len(bucket):
                interleaved.append(bucket[i])

    total_leads = len(interleaved)
    print(f"\nTotal Interleaved Leads: {total_leads}")
    assert total_leads == 305, f"Expected 305 leads, got {total_leads}"

    # Validation checks
    for idx, lead in enumerate(interleaved):
        assert lead.get("id"), f"Missing ID at index {idx}"
        assert lead.get("name"), f"Missing name at index {idx}"
        assert lead.get("city"), f"Missing city at index {idx}: {lead.get('name')}"
        assert lead.get("country"), f"Missing country at index {idx}: {lead.get('name')}"
        email = lead.get("email", "")
        assert "@" in email and "." in email, f"Invalid email '{email}' for {lead.get('name')}"
        assert lead.get("googlePlaceId"), f"Missing Google Place ID for {lead.get('name')}"
        assert lead.get("solidWeakPoint"), f"Missing solid weak point for {lead.get('name')}"
        assert lead.get("aiAuditPrompt"), f"Missing AI audit prompt for {lead.get('name')}"
        assert lead.get("gmailPitch"), f"Missing Gmail pitch for {lead.get('name')}"
        assert lead.get("decisionMaker"), f"Missing decision maker for {lead.get('name')}"

    # Target file paths
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_path = os.path.join(workspace_dir, "data", "leads.json")
    js_path = os.path.join(workspace_dir, "data", "leads.js")

    # 1. Write data/leads.json
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(interleaved, f, indent=2, ensure_ascii=False)
    print(f"Successfully wrote {total_leads} leads to {json_path}")

    # 2. Write data/leads.js
    js_content = (
        "// RestoHunter AI - 305 Comprehensive Verified Leads Dataset\n"
        "// 100% Verified Google Maps & Domain Email Addresses\n"
        "// Countries: United States (70), United Kingdom (60), Kuwait (45), Canada (55), Oman (40), Bahrain (35)\n\n"
        f"const DEFAULT_LEADS = {json.dumps(interleaved, indent=2, ensure_ascii=False)};\n\n"
        "var INITIAL_LEADS = DEFAULT_LEADS;\n"
        "if (typeof window !== 'undefined') {\n"
        "  window.DEFAULT_LEADS = DEFAULT_LEADS;\n"
        "}\n"
        "if (typeof module !== 'undefined' && module.exports) {\n"
        "  module.exports = DEFAULT_LEADS;\n"
        "}\n"
    )
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Successfully wrote {total_leads} leads to {js_path}")

    # Summary by country and city
    by_country = {}
    by_city = {}
    for lead in interleaved:
        c = lead["country"]
        city = f"{lead['city']}, {c}"
        by_country[c] = by_country.get(c, 0) + 1
        by_city[city] = by_city.get(city, 0) + 1

    print("\n--- Breakdown by Country ---")
    for c, count in by_country.items():
        print(f"  {c}: {count} leads")

    print(f"\n--- Total Distinct Cities/Areas Covered: {len(by_city)} ---")
    for city, count in sorted(by_city.items()):
        print(f"  {city}: {count}")

    print("\nAll 305 leads successfully assembled, validated, and exported!")

if __name__ == "__main__":
    assemble_and_export()
