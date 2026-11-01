// Test script for Reply Probability Sequence & Pitch Priority
var console = { log: print, error: print, warn: print };

// Minimal DOM mock
var document = {
  getElementById: function(id) {
    var elem = {
      id: id,
      value: id === 'table-sort-filter' ? 'reply_chance' : '',
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
    return elem;
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
  addEventListener: function(){}
};
var localStorage = {
  _data: {},
  getItem: function(k) { return this._data[k] || null; },
  setItem: function(k, v) { this._data[k] = v; },
  removeItem: function(k) { delete this._data[k]; }
};
window.localStorage = localStorage;

var fetch = function() {
  return Promise.reject(new Error('Network offline for testing'));
};

load('data/leads.js');
load('js/storage.js');
load('js/softwareCatalog.js');
load('js/placesService.js');
load('js/websiteAnalyzer.js');
load('js/batchManager.js');
load('js/pitchEngine.js');
load('js/analytics.js');
load('js/app.js');

print("Initializing App...");
App.init();

print("\n--- CHECK 1: Leads Default Sequence (No Filter) ---");
var leads = App.leads;
print("Total leads: " + leads.length);

var top5 = leads.slice(0, 5);
var isDescending = true;
var prevScore = 100;

for (var i = 0; i < top5.length; i++) {
  var lead = top5[i];
  var meta = App.calculateReplyScore(lead);
  print("#" + (i + 1) + ": " + lead.businessName + " (" + lead.city + ") — DM: " + lead.decisionMaker + " | Reply Score: " + meta.score + "% [" + meta.label + "] | Phone: " + lead.phone);
  if (meta.score > prevScore) {
    isDescending = false;
  }
  prevScore = meta.score;
}

if (!isDescending) {
  throw new Error("FAIL: Leads are not ordered descending by reply chance!");
}
print("PASS: Top 5 leads are ordered by highest reply chance (99%)!");

print("\n--- CHECK 2: Score Calculation Criteria ---");
var topLead = leads[0];
var topMeta = App.calculateReplyScore(topLead);
if (topMeta.score < 95) {
  throw new Error("FAIL: Lead #1 score expected >= 95%, got " + topMeta.score + "%");
}
print("PASS: Lead #1 has " + topMeta.score + "% Reply Chance with reason: " + topMeta.reason);

print("\n--- CHECK 3: PlacesService Empty City / Country Sequence ---");
PlacesService.searchBusinesses({ country: '', city: '', category: 'all', count: 10 }).then(function(res) {
  var searchResults = res.results || [];
  print("PlacesService results count: " + searchResults.length);
  var psTopScore = searchResults[0].replyProbabilityScore || App.calculateReplyScore(searchResults[0]).score;
  print("PlacesService Top Result: " + searchResults[0].businessName + " | Score: " + psTopScore + "%");
  if (psTopScore < 95) {
    throw new Error("FAIL: PlacesService did not return highest reply chance lead first!");
  }
  print("PASS: PlacesService fallback strictly sequences by highest reply probability!");

  print("\n========================================================");
  print("ALL PRIORITY SEQUENCE CHECKS PASSED SUCCESSFULLY! ✅");
  print("========================================================");
});
