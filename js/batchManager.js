/**
 * SoftHunter AI - 50-Lead Batch Management System
 * Enforces strict, unskippable B2B batch sales progression:
 * - Default batch size: 50 unique, verified, qualified businesses.
 * - Tracks unique businesses pitched (1 business pitched across 1 or more channels = 1 unique pitched business).
 * - Next batch remains strictly LOCKED until current batch is 100% completed (50/50 unique businesses pitched).
 * - Real-time batch stats: Total Leads, Unique Pitched, Remaining, Completion %, Status.
 * - Unlocks "GET NEXT 50 LEADS" only when current batch is completed.
 */

const BatchManager = {
  BATCH_SIZE: 50,

  /**
   * Loads batches from Storage or Backend
   */
  getBatches() {
    let batches = null;
    try {
      const stored = localStorage.getItem('softhunter_batches');
      if (stored) batches = JSON.parse(stored);
    } catch (e) {}

    if (!batches || Object.keys(batches).length === 0) {
      batches = this.initializeDefaultBatches();
    }
    return batches;
  },

  saveBatches(batches) {
    try {
      localStorage.setItem('softhunter_batches', JSON.stringify(batches));
      fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batches)
      }).catch(() => {});
    } catch (e) {}
  },

  initializeDefaultBatches() {
    const leads = (window.App && window.App.leads) || (window.INITIAL_LEADS) || [];
    const batches = {};
    const totalBatches = Math.max(1, Math.ceil(leads.length / this.BATCH_SIZE));

    for (let b = 1; b <= totalBatches; b++) {
      const batchId = `batch_${String(b).padStart(2, '0')}`;
      const batchLeads = leads.filter(l => l.batchId === batchId || Math.floor(leads.indexOf(l) / this.BATCH_SIZE) + 1 === b);
      const uniquePitched = batchLeads.filter(l => l.status === 'dispatched' || l.crmStatus === 'sent' || l.batchPitched).length;
      const total = batchLeads.length || this.BATCH_SIZE;

      batches[batchId] = {
        id: batchId,
        number: b,
        title: `Batch #${String(b).padStart(2, '0')}`,
        totalLeads: total,
        uniquePitched: uniquePitched,
        remaining: Math.max(0, total - uniquePitched),
        completionRate: total > 0 ? Math.round((uniquePitched / total) * 100) : 0,
        status: b === 1 ? (uniquePitched >= total ? 'completed' : 'active') : (b === 2 && batches['batch_01']?.status === 'completed' ? 'active' : 'locked'),
        isLocked: b > 1,
        createdAt: '2026-11-01T00:00:00Z',
        completedAt: null
      };
    }
    this.saveBatches(batches);
    return batches;
  },

  /**
   * Recalculates batch statistics based on active leads
   */
  syncWithLeads(leads) {
    if (!leads || leads.length === 0) return this.getBatches();
    const batches = this.getBatches();

    let previousBatchCompleted = true;
    const sortedBatchIds = Object.keys(batches).sort();

    sortedBatchIds.forEach((batchId, idx) => {
      const b = batches[batchId];
      const batchLeads = leads.filter(l => l.batchId === batchId);
      const total = batchLeads.length;

      // Unique pitched: ONLY count unique businesses that have status === 'dispatched' or crmStatus === 'sent'
      const uniquePitched = batchLeads.filter(l => l.status === 'dispatched' || l.crmStatus === 'sent' || l.batchPitched).length;
      const remaining = Math.max(0, total - uniquePitched);
      const completionRate = total > 0 ? Math.round((uniquePitched / total) * 100) : 0;

      b.totalLeads = total;
      b.uniquePitched = uniquePitched;
      b.remaining = remaining;
      b.completionRate = completionRate;

      if (uniquePitched >= total && total > 0) {
        b.status = 'completed';
        b.isLocked = false;
        if (!b.completedAt) b.completedAt = new Date().toISOString();
        previousBatchCompleted = true;
      } else if (previousBatchCompleted || idx === 0) {
        b.status = 'active';
        b.isLocked = false;
        previousBatchCompleted = false;
      } else {
        b.status = 'locked';
        b.isLocked = true;
        previousBatchCompleted = false;
      }
    });

    this.saveBatches(batches);
    return batches;
  },

  /**
   * Returns current active batch
   */
  getActiveBatch() {
    const batches = this.getBatches();
    for (const bId of Object.keys(batches).sort()) {
      if (batches[bId].status === 'active') return batches[bId];
    }
    // If all completed, return the last batch
    const all = Object.values(batches);
    return all[all.length - 1] || null;
  },

  /**
   * Records a successful dispatch on a lead
   * CRITICAL: Generating or copying does NOT count.
   * Only true dispatch click marks lead as pitched.
   */
  recordDispatch(leadId, leads) {
    if (!leads) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    lead.status = 'dispatched';
    lead.crmStatus = 'sent';
    lead.batchPitched = true;
    lead.dispatchedAt = new Date().toISOString();

    // Re-sync batches
    this.syncWithLeads(leads);
  },

  /**
   * Manually unlock next batch if criteria met
   */
  unlockNextBatch(currentBatchId, leads) {
    const batches = this.getBatches();
    const current = batches[currentBatchId];
    if (!current) return { success: false, message: 'Batch not found' };

    if (current.uniquePitched < current.totalLeads) {
      return {
        success: false,
        message: `Current ${current.title} is not finished! Pitched: ${current.uniquePitched}/${current.totalLeads}. Remaining: ${current.remaining} unique businesses.`
      };
    }

    const nextBatchNum = current.number + 1;
    const nextBatchId = `batch_${String(nextBatchNum).padStart(2, '0')}`;
    const nextBatch = batches[nextBatchId];

    if (!nextBatch) {
      return { success: false, message: 'No more batches in queue!' };
    }

    nextBatch.isLocked = false;
    nextBatch.status = 'active';
    this.saveBatches(batches);

    // Call backend
    fetch('/api/batches/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId: nextBatchId })
    }).catch(() => {});

    return { success: true, nextBatch };
  }
};

if (typeof window !== 'undefined') {
  window.BatchManager = BatchManager;
}
