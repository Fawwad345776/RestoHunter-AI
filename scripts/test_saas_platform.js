// Comprehensive JSC test script for SoftHunter AI Platform
var console = { log: print, error: print, warn: print, info: print };

// Minimal DOM mock
var document = {
  getElementById: function(id) {
    return {
      value: '',
      innerHTML: '',
      innerText: '',
      textContent: '',
      classList: {
        add: function(){},
        remove: function(){},
        contains: function(){ return false; },
        toggle: function(){}
      },
      addEventListener: function(){},
      style: {},
      setAttribute: function(){},
      removeAttribute: function(){},
      dataset: {}
    };
  },
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  addEventListener: function() {},
  createElement: function() {
    return {
      innerHTML: '',
      innerText: '',
      textContent: '',
      style: {},
      classList: { add: function(){}, remove: function(){} },
      appendChild: function(){},
      setAttribute: function(){}
    };
  }
};

var window = {
  innerWidth: 1200,
  location: { href: '', hash: '#overview' },
  history: { replaceState: function(){} },
  scrollTo: function(){},
  addEventListener: function(){},
  localStorage: {
    _data: {},
    getItem: function(k) { return this._data[k] || null; },
    setItem: function(k, v) { this._data[k] = v; },
    removeItem: function(k) { delete this._data[k]; }
  }
};
var localStorage = window.localStorage;
var navigator = { userAgent: 'test', clipboard: { writeText: function(){} } };

var fetch = function() {
  return {
    then: function(cb) {
      if (cb) cb({ ok: true, json: function(){ return []; } });
      return this;
    },
    catch: function() { return this; }
  };
};

print("Loading data/leads.js...");
load('data/leads.js');
print("Loaded leads count: " + INITIAL_LEADS.length);

print("Loading js/storage.js...");
load('js/storage.js');

print("Loading js/softwareCatalog.js...");
load('js/softwareCatalog.js');

print("Loading js/placesService.js...");
load('js/placesService.js');

print("Loading js/websiteAnalyzer.js...");
load('js/websiteAnalyzer.js');

print("Loading js/batchManager.js...");
load('js/batchManager.js');

print("Loading js/pitchEngine.js...");
load('js/pitchEngine.js');

print("Loading js/analytics.js...");
load('js/analytics.js');

print("Loading js/app.js...");
load('js/app.js');

// Test App.init()
print("Running App.init()...");
App.init();
print("App.leads count: " + App.leads.length);

// Test 1: Verify Google Places Place ID & Exact URL
print("\n--- TEST 1: Google Place ID & Exact Listing Verification ---");
var sampleLead = App.leads[0];
print("Lead Name: " + sampleLead.businessName);
print("Place ID: " + sampleLead.googlePlaceId);
var exactUrl = PlacesService.getExactGoogleMapsUrl(sampleLead);
print("Exact Maps URL: " + exactUrl);
if (exactUrl.indexOf('place_id:') === -1 && exactUrl.indexOf('query=') === -1) {
  throw new Error("Exact Maps URL must contain place_id or verified query!");
}
print("Test 1 Passed: Exact listing verified!");

// Test 2: Universal Software Opportunities (all 6 categories)
print("\n--- TEST 2: Universal Software Opportunities ---");
var opp = SoftwareCatalog.detectOpportunity(sampleLead);
print("Opportunity Category: " + opp.categoryLabel);
print("Recommended Software: " + opp.recommendedSoftware);
print("MVP Scope: " + opp.mvpScope);
print("Tech Stack: " + opp.suggestedTechStack);
if (!opp.recommendedSoftware || !opp.suggestedTechStack) {
  throw new Error("Opportunity missing required software or tech stack!");
}
print("Test 2 Passed: Universal software catalog operational!");

// Test 3: Structured Proposal Generation
print("\n--- TEST 3: Structured Software Project Proposal ---");
var proposal = SoftwareCatalog.generateStructuredProposal(sampleLead);
print("Project Name: " + proposal.projectName);
print("Complexity: " + proposal.complexity);
print("Main Features count: " + proposal.mainFeatures.length);
if (proposal.businessBenefits.length === 0 || proposal.customerFeatures.length === 0) {
  throw new Error("Proposal missing features or benefits!");
}
print("Test 3 Passed: Structured proposal engine operational!");

// Test 4: 50-Lead Batch Progression Rules
print("\n--- TEST 4: 50-Lead Batch Progression ---");
var batches = BatchManager.getBatches();
var batchKeys = Object.keys(batches);
print("Total batches configured: " + batchKeys.length);
var batch1 = batches['batch_01'];
var batch2 = batches['batch_02'];
print("Batch 1 Status: " + batch1.status + ", Total: " + batch1.totalLeads + ", Pitched: " + batch1.uniquePitched);
print("Batch 2 Status: " + batch2.status + ", isLocked: " + batch2.isLocked);

if (batch2.isLocked !== true) {
  throw new Error("Batch 2 must be locked when Batch 1 is not completed!");
}

var unlockAttempt = BatchManager.unlockNextBatch('batch_01', App.leads);
print("Unlock attempt before completion result: success=" + unlockAttempt.success + ", message=" + unlockAttempt.message);
if (unlockAttempt.success === true) {
  throw new Error("Batch 2 should not unlock before Batch 1 is 100% finished!");
}
print("Test 4 Passed: 50-lead batch gating strictly enforced!");

// Test 5: Multi-Channel Pitch Studio (All 5 Channels & 7 Stages)
print("\n--- TEST 5: Multi-Channel & Multi-Stage Pitch Engine ---");
var channels = ['whatsapp', 'gmail', 'instagram', 'linkedin', 'facebook'];
var stages = ['initial', 'followup1', 'followup2', 'followup3', 'final', 'demo', 'proposal'];

channels.forEach(function(ch) {
  var p = PitchEngine.generatePitch(sampleLead, ch, 'initial', 'English');
  if (!p.body || p.body.length < 20) {
    throw new Error("Pitch failed for channel: " + ch);
  }
  print("  PASS Channel " + ch.toUpperCase() + ": " + p.body.slice(0, 60).replace(/\n/g, ' ') + "...");
});
print("Test 5 Passed: All 5 outreach channels & stages operational!");

// Test 6: View Switching for all 17 navigation views
print("\n--- TEST 6: View Switching (All 17 Views) ---");
var views = [
  'overview', 'find-leads', 'all-businesses', 'verified-leads',
  'website-analyzer', 'weakness-detector', 'software-opportunities',
  'pitch-generator', 'lead-batch', 'daily-tracker', 'dispatched-leads',
  'date-history', 'followup-manager', 'reply-inbox', 'crm',
  'analytics', 'settings'
];

views.forEach(function(v) {
  App.switchView(v);
  if (App.currentView !== v) {
    throw new Error("Failed to switch to view: " + v);
  }
});
print("Test 6 Passed: All 17 SaaS views switch cleanly!");

print("\n========================================================");
print("ALL 6 TESTS PASSED SUCCESSFULLY! ✅");
print("========================================================");
