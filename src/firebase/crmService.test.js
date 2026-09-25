import { describe, it, expect } from 'vitest';
import {
  CrmDealStages,
  CrmLeadScores,
  CrmLeadSources,
  calculateBuyerMatchScore,
  matchPropertiesForLead,
  matchLeadsForProperty,
  getCrmLeads,
  createCrmLead,
  updateCrmLead,
  getCrmDeals,
  createCrmDeal,
  updateCrmDealStage,
  getCrmVisits,
  scheduleCrmVisit,
  getCrmAnalytics
} from './crmService.js';

describe('EaseLand CRM Studio Data & Matching Service Suite', () => {
  it('correctly calculates buyer match score for location, property type and budget', () => {
    const lead = {
      name: 'Dr. Vikram Chandra',
      preferredLocation: 'Amaravati Capital Region',
      preferredPropertyType: 'Commercial Land',
      budgetMin: 5000000,
      budgetMax: 9000000
    };

    const matchingProperty = {
      title: 'Commercial Plot in Core Amaravati Capital Region',
      locationName: 'Amaravati Capital Region, Sector 4',
      propertyType: 'Commercial Land',
      price: 7500000
    };

    const mismatchProperty = {
      title: 'Farmland in remote district',
      locationName: 'Tirupati Rural',
      propertyType: 'Agricultural Land',
      price: 1500000
    };

    const matchScore = calculateBuyerMatchScore(lead, matchingProperty);
    const mismatchScore = calculateBuyerMatchScore(lead, mismatchProperty);

    expect(matchScore).toBeGreaterThanOrEqual(80);
    expect(mismatchScore).toBeLessThan(50);
  });

  it('matches properties for a lead in ranked order', () => {
    const lead = {
      id: 'lead-test',
      preferredLocation: 'Guntur Brodipet',
      preferredPropertyType: 'Open Plots',
      budgetMin: 3000000,
      budgetMax: 5000000
    };

    const properties = [
      { id: 'p1', title: 'Plot in Brodipet Guntur', locationName: 'Brodipet Guntur', propertyType: 'Open Plots', price: 4000000 },
      { id: 'p2', title: 'Apartment in Hyderabad', locationName: 'Gachibowli', propertyType: 'Apartments', price: 9000000 }
    ];

    const results = matchPropertiesForLead(lead, properties);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].property.id).toBe('p1');
    expect(results[0].matchScore).toBeGreaterThan(60);
  });

  it('matches leads for a property in ranked order', () => {
    const property = {
      id: 'prop-farm',
      title: 'Canal Frontage Farmland',
      locationName: 'Vijayawada Highway',
      propertyType: 'Agricultural Land',
      price: 3000000
    };

    const leads = [
      { id: 'l1', name: 'Agro Investor', preferredLocation: 'Vijayawada Highway', preferredPropertyType: 'Agricultural Land', budgetMin: 2000000, budgetMax: 3500000 },
      { id: 'l2', name: 'Flat Buyer', preferredLocation: 'Bangalore East', preferredPropertyType: 'Apartments', budgetMin: 8000000, budgetMax: 12000000 }
    ];

    const results = matchLeadsForProperty(property, leads);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].lead.id).toBe('l1');
  });

  it('creates and retrieves CRM leads cleanly', async () => {
    const leadData = {
      name: 'Test Buyer Name',
      phone: '+91 99999 88888',
      email: 'buyer@test.com',
      preferredLocation: 'Guntur Ring Road',
      preferredPropertyType: 'Open Plots',
      budgetMax: 4500000,
      score: CrmLeadScores.HOT
    };

    const res = await createCrmLead(leadData);
    expect(res.success).toBe(true);
    expect(res.lead.name).toBe('Test Buyer Name');

    const allLeads = await getCrmLeads();
    expect(allLeads.some(l => l.name === 'Test Buyer Name')).toBe(true);
  });

  it('advances deal stages and generates timeline entries', async () => {
    const dealData = {
      customerName: 'Test Deal Customer',
      propertyTitle: 'East Facing Villa Plot',
      dealValue: 5000000,
      stage: CrmDealStages.NEW
    };

    const res = await createCrmDeal(dealData);
    expect(res.success).toBe(true);
    const dId = res.deal.id;

    const updateRes = await updateCrmDealStage(dId, CrmDealStages.PRICE_NEGOTIATION, 'Buyer offered 48 Lakhs');
    expect(updateRes.success).toBe(true);

    const deals = await getCrmDeals();
    const updated = deals.find(d => d.id === dId);
    expect(updated.stage).toBe(CrmDealStages.PRICE_NEGOTIATION);
    expect(updated.probability).toBe(80);
    expect(updated.timeline.length).toBeGreaterThanOrEqual(2);
  });

  it('schedules a site visit and updates metrics', async () => {
    const visitData = {
      propertyTitle: 'Highway Commercial Land',
      customerName: 'Site Visit Prospect',
      customerPhone: '+91 91234 56789',
      visitDate: '2026-09-30',
      visitTime: '02:00 PM'
    };

    const res = await scheduleCrmVisit(visitData);
    expect(res.success).toBe(true);

    const visits = await getCrmVisits();
    expect(visits.some(v => v.customerName === 'Site Visit Prospect')).toBe(true);

    const analytics = await getCrmAnalytics();
    expect(analytics.totalDealsCount).toBeGreaterThan(0);
    expect(analytics.totalPipelineValue).toBeGreaterThan(0);
  });
});
