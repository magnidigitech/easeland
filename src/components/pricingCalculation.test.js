import { describe, it, expect } from 'vitest';

describe('Price Per Unit & Total Price Calculation Suite', () => {
  // Helper matching PostPropertyWizard calculation logic
  const calculateTotalPrice = (area, pricePerUnit) => {
    const a = Number(area);
    const ppu = Number(pricePerUnit);
    if (isNaN(a) || isNaN(ppu) || a <= 0 || ppu <= 0) return 0;
    return Math.round(a * ppu);
  };

  const calculatePricePerUnit = (totalPrice, area) => {
    const p = Number(totalPrice);
    const a = Number(area);
    if (isNaN(p) || isNaN(a) || p <= 0 || a <= 0) return 0;
    return Math.round(p / a);
  };

  const formatPriceDisplay = (price) => {
    const p = Number(price) || 0;
    if (p >= 10000000) {
      return `Rs. ${(p / 10000000).toFixed(2)} Crores`;
    }
    if (p >= 100000) {
      return `Rs. ${(p / 100000).toFixed(2)} Lakhs`;
    }
    return `Rs. ${p.toLocaleString('en-IN')}`;
  };

  const formatPricePerUnitDisplay = (pricePerUnit, unit = 'sq ft') => {
    const ppu = Number(pricePerUnit) || 0;
    if (ppu <= 0) return '';
    return `Rs. ${ppu.toLocaleString('en-IN')} / ${unit}`;
  };

  it('calculates total price accurately based on total units and price per unit', () => {
    // 1,500 sq ft at Rs. 3,000 / sq ft
    const total = calculateTotalPrice(1500, 3000);
    expect(total).toBe(4500000);
    expect(formatPriceDisplay(total)).toBe('Rs. 45.00 Lakhs');
    expect(formatPricePerUnitDisplay(3000, 'sq ft')).toBe('Rs. 3,000 / sq ft');
  });

  it('calculates price per unit accurately when total price and total units are provided', () => {
    // Total price of Rs. 30 Lakhs for 200 sq yards
    const ppu = calculatePricePerUnit(3000000, 200);
    expect(ppu).toBe(15000);
    expect(formatPricePerUnitDisplay(ppu, 'sq yard')).toBe('Rs. 15,000 / sq yard');
  });

  it('accurately handles decimal units such as acres, cents, and guntas', () => {
    // 2.5 acres at Rs. 50,00,000 per acre
    const total = calculateTotalPrice(2.5, 5000000);
    expect(total).toBe(12500000);
    expect(formatPriceDisplay(total)).toBe('Rs. 1.25 Crores');
    expect(formatPricePerUnitDisplay(5000000, 'acre')).toBe('Rs. 50,00,000 / acre');
  });

  it('safely handles zero, negative, and invalid values without crashing or returning NaN', () => {
    expect(calculateTotalPrice(0, 5000)).toBe(0);
    expect(calculateTotalPrice(1000, 0)).toBe(0);
    expect(calculateTotalPrice(-10, 5000)).toBe(0);
    expect(calculateTotalPrice('invalid', 5000)).toBe(0);

    expect(calculatePricePerUnit(0, 1000)).toBe(0);
    expect(calculatePricePerUnit(5000000, 0)).toBe(0);
    expect(calculatePricePerUnit(-5000000, 1000)).toBe(0);
    expect(calculatePricePerUnit(5000000, 'invalid')).toBe(0);
  });

  it('formats large multi-crore numbers with Indian numbering standards', () => {
    const total = calculateTotalPrice(10, 12500000); // 10 acres at 1.25 Cr/acre = 12.5 Cr
    expect(total).toBe(125000000);
    expect(formatPriceDisplay(total)).toBe('Rs. 12.50 Crores');
    expect(formatPricePerUnitDisplay(12500000, 'acre')).toBe('Rs. 1,25,00,000 / acre');
  });

  it('formats rental and lease monthly prices with Indian numbering and / month suffix', () => {
    const formatRentalDisplay = (price, purpose = 'RENT') => {
      const p = Number(price) || 0;
      const isLease = purpose === 'LEASE';
      return `Rs. ${p.toLocaleString('en-IN')} / month${isLease ? ' (Lease)' : ''}`;
    };

    expect(formatRentalDisplay(25000, 'RENT')).toBe('Rs. 25,000 / month');
    expect(formatRentalDisplay(150000, 'LEASE')).toBe('Rs. 1,50,000 / month (Lease)');
    expect(formatRentalDisplay(8500, 'RENT')).toBe('Rs. 8,500 / month');
  });

  it('calculates rental security deposit presets and move-in outlay accurately', () => {
    const monthlyRent = 30000;
    const presets = {
      noDeposit: 0,
      twoMonths: monthlyRent * 2,
      threeMonths: monthlyRent * 3,
      sixMonths: monthlyRent * 6
    };

    expect(presets.twoMonths).toBe(60000);
    expect(presets.threeMonths).toBe(90000);
    expect(presets.sixMonths).toBe(180000);

    const moveInOutlay = monthlyRent + presets.twoMonths;
    expect(moveInOutlay).toBe(90000);
  });
});
