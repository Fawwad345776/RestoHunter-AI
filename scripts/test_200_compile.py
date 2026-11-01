import subprocess
import json
import urllib.parse

# 1. Load 100 original established leads from commit 2bbc606
out_orig = subprocess.check_output(['git', 'show', '2bbc606:data/leads.json'])
orig_100 = json.loads(out_orig)
for l in orig_100:
    l['businessScale'] = 'established_brand'
    l['businessScaleLabel'] = '🏢 Established Brand'
    if not l.get('contactInfo'):
        l['contactInfo'] = {}
    l['contactInfo']['phoneType'] = l.get('phoneType', 'landline_uan')
    l['contactInfo']['phoneSource'] = l.get('phoneSource', 'Official Google Business Profile')

# 2. Load 50 Pakistani small businesses from current leads.json
with open('data/leads.json') as f:
    curr = json.load(f)
small_pak_50 = [l for l in curr if l.get('businessScale') == 'small_business']

print(f"Loaded {len(orig_100)} established brands and {len(small_pak_50)} Pakistani small businesses.")
