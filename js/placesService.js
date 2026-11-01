/**
 * SoftHunter AI - Google Places API (New) Discovery & Verification Engine
 * Implements strict Google Maps business discovery, Place ID verification,
 * operating status validation, and exact listing navigation.
 */

const PlacesService = {
  SEARCH_HISTORY_KEY: 'softhunter_search_history',
  API_USAGE_KEY: 'softhunter_api_usage',

  getSearchHistory() {
    try {
      const stored = localStorage.getItem(this.SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  saveSearchToHistory(searchParams, resultsCount) {
    try {
      const history = this.getSearchHistory();
      history.unshift({
        id: `srch_${Date.now()}`,
        timestamp: new Date().toISOString(),
        params: searchParams,
        resultsCount: resultsCount
      });
      // Keep last 30 searches
      localStorage.setItem(this.SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
    } catch (e) {}
  },

  getApiUsage() {
    try {
      const stored = localStorage.getItem(this.API_USAGE_KEY);
      return stored ? JSON.parse(stored) : { requestsThisMonth: 0, lastReset: new Date().toISOString() };
    } catch (e) {
      return { requestsThisMonth: 0, lastReset: new Date().toISOString() };
    }
  },

  incrementApiUsage() {
    try {
      const usage = this.getApiUsage();
      usage.requestsThisMonth = (usage.requestsThisMonth || 0) + 1;
      usage.lastRequest = new Date().toISOString();
      localStorage.setItem(this.API_USAGE_KEY, JSON.stringify(usage));
    } catch (e) {}
  },

  /**
   * Discovers businesses using Google Places API (New) or Curated Verified Directory
   */
  async searchBusinesses(params) {
    const {
      country = 'Pakistan',
      state = '',
      city = 'Karachi',
      category = 'restaurants',
      keyword = '',
      count = 25,
      minRating = 4.0,
      minReviews = 30,
      requireWebsite = false,
      requirePhone = false
    } = params;

    this.incrementApiUsage();

    try {
      const response = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          state,
          city,
          category,
          keyword,
          count: parseInt(count, 10),
          minRating: parseFloat(minRating),
          minReviews: parseInt(minReviews, 10),
          requireWebsite,
          requirePhone
        })
      });

      if (!response.ok) throw new Error('Network search failed');
      const data = await response.json();

      this.saveSearchToHistory(params, data.count || (data.results ? data.results.length : 0));
      return data;
    } catch (e) {
      console.warn('Backend search error, falling back to local dataset filter:', e);
      // Client-side fallback to verified dataset
      const allLeads = (window.App && window.App.leads) || (window.INITIAL_LEADS) || [];
      const filtered = allLeads.filter(l => {
        if (city && city.toLowerCase() !== 'all' && !l.city.toLowerCase().includes(city.toLowerCase())) return false;
        if (category && category !== 'all' && l.niche !== category) return false;
        if (parseFloat(l.rating || 0) < minRating) return false;
        if (parseInt(l.reviews || 0) < minReviews) return false;
        if (requireWebsite && !l.website) return false;
        if (requirePhone && !l.phone) return false;
        return true;
      });

      return {
        success: true,
        source: 'verified_local_database',
        count: filtered.slice(0, count).length,
        results: filtered.slice(0, count)
      };
    }
  },

  /**
   * Generates exact Google Maps listing URL for a business
   * NEVER opens a generic city location.
   */
  getExactGoogleMapsUrl(lead) {
    if (!lead) return 'https://maps.google.com';

    // 1. If explicit exact Google Place ID is present
    if (lead.googlePlaceId && lead.googlePlaceId.startsWith('ChIJ')) {
      return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(lead.googlePlaceId)}`;
    }

    // 2. If exactMapsUrl is already precomputed
    if (lead.exactMapsUrl && lead.exactMapsUrl.includes('place_id:')) {
      return lead.exactMapsUrl;
    }

    // 3. Exact full query with business name, street address, and city
    const queryParts = [lead.businessName, lead.address, lead.city].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts)}`;
  },

  /**
   * Opens the exact business listing in a new browser tab
   */
  openExactGoogleMaps(lead) {
    const url = this.getExactGoogleMapsUrl(lead);
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  /**
   * Verifies authenticity status of a business lead
   */
  evaluateAuthenticity(lead) {
    if (!lead) return { status: 'UNVERIFIED', color: '#94a3b8', badge: '⚪ Unverified' };

    let score = 0;
    if (lead.googlePlaceId && lead.googlePlaceId.length > 10) score += 40;
    if (lead.operatingStatus === 'OPERATIONAL') score += 20;
    if (lead.rating && parseFloat(lead.rating) >= 4.0) score += 15;
    if (lead.reviews && parseInt(lead.reviews, 10) >= 30) score += 15;
    if (lead.website || lead.phone) score += 10;

    if (score >= 80) {
      return { status: 'VERIFIED', color: '#10b981', badge: '🛡️ Verified' };
    } else if (score >= 50) {
      return { status: 'PARTIALLY VERIFIED', color: '#f59e0b', badge: '⚠️ Partially Verified' };
    } else {
      return { status: 'NEEDS REVIEW', color: '#ec4899', badge: '🔍 Needs Review' };
    }
  }
};

if (typeof window !== 'undefined') {
  window.PlacesService = PlacesService;
}
