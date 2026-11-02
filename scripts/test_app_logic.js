// Test script to verify App logic in app.js
var window = {
  innerWidth: 1200,
  location: { hash: '' }
};
var document = {
  getElementById: function(id) {
    return {
      style: {},
      classList: {
        add: function() {},
        remove: function() {},
        toggle: function() {},
        contains: function() { return false; }
      },
      innerHTML: '',
      value: '',
      addEventListener: function() {}
    };
  },
  querySelectorAll: function() {
    return [];
  },
  body: {
    appendChild: function() {},
    removeChild: function() {}
  },
  addEventListener: function() {}
};
var navigator = {
  clipboard: {
    writeText: function(txt) {
      return {
        then: function(cb) { cb(); return { catch: function() {} }; }
      };
    }
  }
};
var StorageService = {
  getSettings: function() { return {}; },
  getLeads: function() { return []; },
  saveLeads: function() {},
  getDispatches: function() { return []; },
  getReplies: function() { return []; }
};
var fetch = function() {
  return {
    then: function() {
      return { then: function() { return { catch: function() {} }; }, catch: function() {} };
    },
    catch: function() {}
  };
};

load('data/leads.js');
load('js/app.js');

print("=== Testing App Logic in js/app.js ===");

// 1. Check getLeadRegion for each country
var leadUS = DEFAULT_LEADS[0]; // Terry Black's (US)
var leadUK = DEFAULT_LEADS.find(function(l) { return l.country.indexOf('United Kingdom') !== -1; });
var leadKW = DEFAULT_LEADS.find(function(l) { return l.country.indexOf('Kuwait') !== -1; });
var leadCA = DEFAULT_LEADS.find(function(l) { return l.country.indexOf('Canada') !== -1; });
var leadOM = DEFAULT_LEADS.find(function(l) { return l.country.indexOf('Oman') !== -1; });
var leadBH = DEFAULT_LEADS.find(function(l) { return l.country.indexOf('Bahrain') !== -1; });

print("Lead US Region: " + App.getLeadRegion(leadUS) + " (Expected: USA)");
print("Lead UK Region: " + App.getLeadRegion(leadUK) + " (Expected: UK)");
print("Lead KW Region: " + App.getLeadRegion(leadKW) + " (Expected: Kuwait)");
print("Lead CA Region: " + App.getLeadRegion(leadCA) + " (Expected: Canada)");
print("Lead OM Region: " + App.getLeadRegion(leadOM) + " (Expected: Oman)");
print("Lead BH Region: " + App.getLeadRegion(leadBH) + " (Expected: Bahrain)");

if (App.getLeadRegion(leadUS) !== 'USA' ||
    App.getLeadRegion(leadUK) !== 'UK' ||
    App.getLeadRegion(leadKW) !== 'Kuwait' ||
    App.getLeadRegion(leadCA) !== 'Canada' ||
    App.getLeadRegion(leadOM) !== 'Oman' ||
    App.getLeadRegion(leadBH) !== 'Bahrain') {
  print("❌ FAIL: Region mapping mismatch!");
  quit(1);
}

// 2. Initialize App
App.leads = DEFAULT_LEADS;
print("App leads initialized: " + App.leads.length);

// 3. Test sorting & rotation
var sorted = App.sortLeads(DEFAULT_LEADS, 'reply_chance');
print("Sorted leads count: " + sorted.length);
print("First 6 sorted leads regions:");
for (var i = 0; i < 6; i++) {
  print("  #" + (i+1) + " " + sorted[i].businessName + " (" + App.getLeadRegion(sorted[i]) + ")");
}

// 4. Test filtering
App.currentCountryFilter = 'Kuwait';
App.runTableFilters();
print("Filtered for Kuwait: " + App.filteredLeads.length + " leads");
if (App.filteredLeads.length !== 10) {
  print("❌ FAIL: Expected 10 Kuwait leads, got " + App.filteredLeads.length);
  quit(1);
}

App.currentCountryFilter = 'ALL';
App.currentCityFilter = 'London';
App.runTableFilters();
print("Filtered for London: " + App.filteredLeads.length + " leads");
if (App.filteredLeads.length < 3) {
  print("❌ FAIL: Expected London leads, got " + App.filteredLeads.length);
  quit(1);
}

print("\n✅ APP LOGIC FULLY VERIFIED!");
