import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  CrmDealStages,
  CrmLeadScores,
  REGIONAL_CLUSTERS,
  fetchCrmBootstrap,
  createCrmLead,
  deleteCrmLead,
  createCrmDeal,
  updateCrmDealStage,
  updateCrmDealFollowUp,
  deleteCrmDeal,
  scheduleCrmVisit,
  updateCrmVisitStatus,
  deleteCrmVisit,
  calculateBuyerMatchScore,
  matchPropertiesForLead,
  matchLeadsForProperty,
  formatAmountInWords,
  numToWordsIndian,
  deduplicateLeads,
  deduplicateDeals,
  deduplicateVisits,
  clearAllCrmData,
  calculateCrmAnalytics
} from './crmService.js';

test('EaseLand CRM Studio Enterprise & Zero-Fallback Suite', async (t) => {
  beforeEach(async () => {
    await clearAllCrmData();
  });

  await t.test('1. fetchCrmBootstrap returns structured leads, deals, visits, and calculated analytics', async () => {
    const data = await fetchCrmBootstrap();
    assert.ok(data.success);
    assert.ok(Array.isArray(data.leads));
    assert.ok(Array.isArray(data.deals));
    assert.ok(Array.isArray(data.visits));
    assert.ok(data.analytics);
    assert.strictEqual(typeof data.analytics.totalPipelineValue, 'number');
    assert.strictEqual(typeof data.analytics.conversionRate, 'number');
  });

  await t.test('2. Lead creation, retrieval, and deletion lifecycle operates reliably', async () => {
    const leadRes = await createCrmLead({
      name: 'Dr. K. Srinivas Rao',
      phone: '+91 98480 12345',
      email: 'srinivas.rao@health.org',
      preferredLocation: 'Mangalagiri, Amaravati',
      preferredPropertyType: 'Commercial Venture Plots',
      budgetMin: 5000000,
      budgetMax: 12000000,
      score: CrmLeadScores.HOT
    });

    assert.ok(leadRes.success);
    assert.ok(leadRes.lead);
    assert.strictEqual(leadRes.lead.name, 'Dr. K. Srinivas Rao');
    assert.strictEqual(leadRes.lead.score, 'HOT');

    const bootstrap = await fetchCrmBootstrap();
    const found = bootstrap.leads.find(l => l.id === leadRes.lead.id);
    assert.ok(found);

    const delRes = await deleteCrmLead(leadRes.lead.id);
    assert.ok(delRes.success);

    const afterDel = await fetchCrmBootstrap();
    const stillThere = afterDel.leads.find(l => l.id === leadRes.lead.id);
    assert.strictEqual(stillThere, undefined);
  });

  await t.test('3. Deal initiation computes commission and initializes audit timeline', async () => {
    const dealRes = await createCrmDeal({
      customerName: 'Smt. Lakshmi Devi',
      customerPhone: '+91 99887 66554',
      propertyTitle: 'Amaravati Capital Premium Villa Plot 350 Sq Yds',
      propertyLocation: 'Velagapudi, Amaravati Capital Region',
      dealValue: 8500000,
      commissionRate: 2.0,
      assignedAgent: 'EaseLand Admin'
    });

    assert.ok(dealRes.success);
    assert.strictEqual(dealRes.deal.dealValue, 8500000);
    assert.strictEqual(dealRes.deal.commissionRate, 2.0);
    assert.strictEqual(dealRes.deal.expectedCommission, 170000);
    assert.strictEqual(dealRes.deal.stage, 'NEW');
    assert.ok(dealRes.deal.timeline.length >= 1);
  });

  await t.test('4. Stage advancement cascades win probability dynamically', async () => {
    const dealRes = await createCrmDeal({
      customerName: 'Venkata Ramana',
      dealValue: 4000000
    });

    const dId = dealRes.deal.id;
    await updateCrmDealStage(dId, CrmDealStages.PRICE_NEGOTIATION, 'Agreed on token terms');

    const data = await fetchCrmBootstrap();
    const updated = data.deals.find(d => d.id === dId);
    assert.ok(updated);
    assert.strictEqual(updated.stage, 'PRICE_NEGOTIATION');
    assert.strictEqual(updated.probability, 80);

    await updateCrmDealStage(dId, CrmDealStages.CLOSED_WON, 'Full consideration deposited');
    const closed = (await fetchCrmBootstrap()).deals.find(d => d.id === dId);
    assert.strictEqual(closed.stage, 'CLOSED_WON');
    assert.strictEqual(closed.probability, 100);
  });

  await t.test('5. Site inspection scheduling and status feedback completion flow', async () => {
    const visitRes = await scheduleCrmVisit({
      customerName: 'Ramesh Naidu',
      customerPhone: '+91 94401 22334',
      propertyTitle: 'Guntur Highway NH16 Commercial Acreage',
      propertyLocation: 'Pedakakani, Guntur',
      visitDate: '2026-11-05',
      visitTime: '10:30 AM',
      customerNotes: 'Wants physical boundary survey verification'
    });

    assert.ok(visitRes.success);
    assert.strictEqual(visitRes.visit.status, 'SCHEDULED');

    await updateCrmVisitStatus(visitRes.visit.id, 'COMPLETED', 'Inspected 4 boundary stones; buyer satisfied');
    const data = await fetchCrmBootstrap();
    const visit = data.visits.find(v => v.id === visitRes.visit.id);
    assert.strictEqual(visit.status, 'COMPLETED');
    assert.strictEqual(visit.customerFeedback, 'Inspected 4 boundary stones; buyer satisfied');
  });

  await t.test('6. Matchmaking algorithm eliminates bargain penalty (sub-budget plots get max score)', () => {
    const lead = {
      preferredLocation: 'Amaravati',
      preferredPropertyType: 'Plot Ventures',
      budgetMin: 3000000,
      budgetMax: 7000000
    };

    const bargainPlot = {
      locationName: 'Amaravati Core Capital Sector 4',
      propertyType: 'Plot Ventures',
      price: 4500000
    };

    const expensivePlot = {
      locationName: 'Amaravati Core Capital Sector 4',
      propertyType: 'Plot Ventures',
      price: 15000000
    };

    const bargainScore = calculateBuyerMatchScore(lead, bargainPlot);
    const expensiveScore = calculateBuyerMatchScore(lead, expensivePlot);

    assert.ok(bargainScore >= 95, 'Bargain plot within budget should receive top score without penalty');
    assert.ok(expensiveScore <= 75, 'Over-budget plot should score lower than budget-fitting plot');
    assert.ok(bargainScore > expensiveScore, 'Bargain under max budget must outscore unaffordable plot');
  });

  await t.test('7. Proximity matching resolves Amaravati, Mangalagiri, and Tulluru cluster associations', () => {
    const lead = {
      preferredLocation: 'Amaravati Capital',
      preferredPropertyType: 'Land',
      budgetMax: 5000000
    };

    const mangalagiriPlot = {
      locationName: 'Mangalagiri IT Park Corridor',
      propertyType: 'Land',
      price: 4800000
    };

    const farAwayPlot = {
      locationName: 'Tirupati Alipiri Bypass',
      propertyType: 'Land',
      price: 4800000
    };

    const clusterScore = calculateBuyerMatchScore(lead, mangalagiriPlot);
    const farScore = calculateBuyerMatchScore(lead, farAwayPlot);

    assert.ok(clusterScore >= 80, 'Mangalagiri should resolve as part of Amaravati cluster');
    assert.ok(farScore < 60, 'Unrelated district should receive lower score');
    assert.ok(clusterScore > farScore);
  });

  await t.test('8. Bi-directional matchmaking produces ordered lists for buyers and properties', () => {
    const leadA = { id: 'lead-a', name: 'Buyer A', preferredLocation: 'Amaravati', preferredPropertyType: 'Plot', budgetMax: 6000000 };
    const leadB = { id: 'lead-b', name: 'Buyer B', preferredLocation: 'Nellore', preferredPropertyType: 'Apartment', budgetMax: 2000000 };

    const plot1 = { id: 'plot-1', title: 'Plot 1', locationName: 'Amaravati Seed Access', propertyType: 'Plot', price: 5500000 };
    const plot2 = { id: 'plot-2', title: 'Plot 2', locationName: 'Kurnool City', propertyType: 'Commercial', price: 9000000 };

    const plotsForLeadA = matchPropertiesForLead(leadA, [plot1, plot2]);
    assert.ok(plotsForLeadA.length >= 1);
    assert.strictEqual(plotsForLeadA[0].property.id, 'plot-1');

    const leadsForPlot1 = matchLeadsForProperty(plot1, [leadA, leadB]);
    assert.ok(leadsForPlot1.length >= 1);
    assert.strictEqual(leadsForPlot1[0].lead.id, 'lead-a');
  });

  await t.test('9. Indian currency formatting and number-to-words conversion', () => {
    assert.strictEqual(formatAmountInWords(4500000), 'Rs. 45 Lakhs');
    assert.strictEqual(formatAmountInWords(15000000), 'Rs. 1.50 Crores');
    assert.strictEqual(formatAmountInWords(20000000), 'Rs. 2 Crores');
    assert.strictEqual(formatAmountInWords(75000), 'Rs. 75 Thousand');

    const words = numToWordsIndian(4500000);
    assert.ok(words.includes('Forty Five Lakh'));
    assert.ok(words.includes('Rupees Only'));
  });

  await t.test('10. Deduplication filters prevent redundant records across telephone and identity keys', () => {
    const rawLeads = [
      { id: '1', phone: '+91 98480 11223', name: 'Raju' },
      { id: '2', phone: '9848011223', name: 'Raju G' },
      { id: '3', phone: '9988776655', name: 'Kiran' }
    ];

    const cleanLeads = deduplicateLeads(rawLeads);
    assert.strictEqual(cleanLeads.length, 2, 'Should deduplicate leads with matching normalized 10-digit phone');

    const rawDeals = [
      { id: 'd1', customerPhone: '9848011223', propertyTitle: 'Plot 101' },
      { id: 'd2', customerPhone: '+91 98480 11223', propertyTitle: 'Plot 101' },
      { id: 'd3', customerPhone: '9848011223', propertyTitle: 'Plot 202' }
    ];

    const cleanDeals = deduplicateDeals(rawDeals);
    assert.strictEqual(cleanDeals.length, 2, 'Should deduplicate deals with same phone and property parcel');
  });

  await t.test('11. Empty pipeline yields strictly 0% conversion rate and mathematically sound win rate calculation', () => {
    // 0 finished deals must yield 0% (never 100%)
    const emptyStats = calculateCrmAnalytics([], [], []);
    assert.strictEqual(emptyStats.conversionRate, 0, 'Conversion rate must be 0% when no deals exist');
    assert.strictEqual(emptyStats.totalFinishedDealsCount, 0);

    // Active in-progress deals without finished deals must also be 0%
    const inProgressDeals = [
      { id: '1', stage: CrmDealStages.NEW, dealValue: 5000000 },
      { id: '2', stage: CrmDealStages.SITE_VISIT, dealValue: 8000000 }
    ];
    const inProgressStats = calculateCrmAnalytics(inProgressDeals, [], []);
    assert.strictEqual(inProgressStats.conversionRate, 0, 'Conversion rate must be 0% when no deals have concluded');
    assert.strictEqual(inProgressStats.activeDealsCount, 2);
    assert.strictEqual(inProgressStats.totalFinishedDealsCount, 0);

    // When deals conclude, accurate win rate must be computed
    const concludedDeals = [
      { id: '1', stage: CrmDealStages.CLOSED_WON, dealValue: 5000000 },
      { id: '2', stage: CrmDealStages.CLOSED_LOST, dealValue: 8000000 }
    ];
    const concludedStats = calculateCrmAnalytics(concludedDeals, [], []);
    assert.strictEqual(concludedStats.conversionRate, 50, '1 won of 2 concluded deals must equal 50%');
    assert.strictEqual(concludedStats.totalFinishedDealsCount, 2);
  });

  await t.test('12. Deal creation preserves follow-up schedule and updateCrmDealFollowUp records call activity', async () => {
    const todayIso = new Date().toISOString().split('T')[0];
    const dealRes = await createCrmDeal({
      customerName: 'Y. V. Subba Reddy',
      customerPhone: '+91 99887 66554',
      propertyTitle: 'Amaravati Highway Commercial Venture',
      dealValue: 15000000,
      nextFollowUpDate: todayIso,
      nextFollowUpTime: '02:30 PM',
      nextFollowUpAction: 'Send audited revenue sketch to buyer'
    });

    assert.ok(dealRes.success);
    assert.strictEqual(dealRes.deal.nextFollowUpDate, todayIso);
    assert.strictEqual(dealRes.deal.nextFollowUpTime, '02:30 PM');
    assert.strictEqual(dealRes.deal.nextFollowUpAction, 'Send audited revenue sketch to buyer');

    // Reschedule and log completed activity
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().split('T')[0];

    const updateRes = await updateCrmDealFollowUp(dealRes.deal.id, {
      followUpDate: tomorrowIso,
      followUpTime: '11:00 AM',
      followUpAction: 'Confirm token advance bank transfer',
      logNote: 'Call Logged: Connected & Interested - Buyer agreed to sign MOU tomorrow morning',
      agentName: 'EaseLand Senior Broker'
    });

    assert.ok(updateRes.success);
    assert.strictEqual(updateRes.deal.nextFollowUpDate, tomorrowIso);
    assert.strictEqual(updateRes.deal.nextFollowUpTime, '11:00 AM');
    assert.strictEqual(updateRes.deal.nextFollowUpAction, 'Confirm token advance bank transfer');

    const timeline = updateRes.deal.timeline || [];
    assert.ok(timeline.some(e => e.event.includes('Connected & Interested')));
    assert.ok(timeline.some(e => e.event.includes('Confirm token advance bank transfer')));
  });

  await t.test('13. calculateCrmAnalytics accurately calculates followUpsDueTodayCount including overdue items', () => {
    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString().split('T')[0];

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekIso = nextWeek.toISOString().split('T')[0];

    const testDeals = [
      { id: 'd1', stage: CrmDealStages.NEW, nextFollowUpDate: yesterdayIso, dealValue: 1000000 }, // Overdue (counts)
      { id: 'd2', stage: CrmDealStages.CONTACTED, nextFollowUpDate: todayIso, dealValue: 2000000 }, // Today (counts)
      { id: 'd3', stage: CrmDealStages.PRICE_NEGOTIATION, nextFollowUpDate: nextWeekIso, dealValue: 3000000 }, // Future (does not count)
      { id: 'd4', stage: CrmDealStages.CLOSED_WON, nextFollowUpDate: todayIso, dealValue: 4000000 }, // Won/Closed (does not count)
      { id: 'd5', stage: CrmDealStages.CLOSED_LOST, nextFollowUpDate: yesterdayIso, dealValue: 5000000 } // Lost/Closed (does not count)
    ];

    const stats = calculateCrmAnalytics(testDeals, [], []);
    assert.strictEqual(stats.followUpsDueTodayCount, 2, 'Should count 1 overdue and 1 due today, ignoring future and closed deals');
  });
});
