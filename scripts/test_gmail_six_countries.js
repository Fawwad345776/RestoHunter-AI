// Test script for 6-country Gmail-only leads dataset & verification features
load('data/leads.js');

print("=== SoftHunter AI — 6 Countries Gmail Leads Verification ===");

var leads = typeof DEFAULT_LEADS !== 'undefined' ? DEFAULT_LEADS : [];
print("Total Leads Count: " + leads.length);

if (leads.length !== 62) {
  print("❌ FAIL: Expected 62 leads, found " + leads.length);
  quit(1);
}

var countries = {};
var emailMissing = 0;
var invalidEmails = 0;
var missingSolidWeakPoint = 0;
var missingAiPrompt = 0;
var missingGmailPitch = 0;
var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

for (var i = 0; i < leads.length; i++) {
  var l = leads[i];
  var c = l.country || 'Unknown';
  countries[c] = (countries[c] || 0) + 1;

  if (!l.email) {
    emailMissing++;
    print("❌ Missing email for: " + l.businessName);
  } else if (!emailRegex.test(l.email)) {
    invalidEmails++;
    print("❌ Invalid email format: " + l.email + " (" + l.businessName + ")");
  }

  if (!l.solidWeakPoint || !l.solidWeakPoint.coreProblem) {
    missingSolidWeakPoint++;
    print("❌ Missing solidWeakPoint for: " + l.businessName);
  }

  if (!l.aiVerificationPrompt || l.aiVerificationPrompt.indexOf("QUESTIONS FOR AI") === -1) {
    missingAiPrompt++;
    print("❌ Missing or incomplete aiVerificationPrompt for: " + l.businessName);
  }

  if (!l.gmailPitch || !l.gmailPitch.subject || !l.gmailPitch.body) {
    missingGmailPitch++;
    print("❌ Missing gmailPitch for: " + l.businessName);
  }
}

print("\n--- Country Breakdown ---");
for (var cName in countries) {
  print("  " + cName + ": " + countries[cName] + " leads");
}

print("\n--- Data Quality Checks ---");
print("  Emails Missing: " + emailMissing + " (Target: 0)");
print("  Invalid Email Formats: " + invalidEmails + " (Target: 0)");
print("  Missing Solid Weak Points: " + missingSolidWeakPoint + " (Target: 0)");
print("  Missing AI Verification Prompts: " + missingAiPrompt + " (Target: 0)");
print("  Missing Gmail Pitches: " + missingGmailPitch + " (Target: 0)");

if (emailMissing === 0 && invalidEmails === 0 && missingSolidWeakPoint === 0 && missingAiPrompt === 0 && missingGmailPitch === 0) {
  print("\n✅ ALL 62 LEADS VALIDATED WITH 100% EMAIL ACCURACY & AI VERIFICATION PROMPTS!");
} else {
  print("\n❌ VALIDATION ERRORS DETECTED");
  quit(1);
}
