/**
 * EaseLand Dynamic Price Range Utility
 * Computes dynamic minimum and maximum price bounds from actual property listings
 * Provides adaptive slider bounds, scale markers, and compact Indian currency formatting.
 */

export function formatPriceCompact(price) {
  const p = Number(price);
  if (!p || isNaN(p) || p <= 0) return 'Rs. 0';
  if (p >= 10000000) {
    const cr = p / 10000000;
    return 'Rs. ' + (cr % 1 === 0 ? String(cr) : cr.toFixed(1)) + ' Cr';
  }
  if (p >= 100000) {
    const lk = p / 100000;
    return 'Rs. ' + (lk % 1 === 0 ? String(lk) : lk.toFixed(1)) + ' L';
  }
  if (p >= 1000) {
    const th = p / 1000;
    return 'Rs. ' + (th % 1 === 0 ? String(th) : th.toFixed(0)) + 'k';
  }
  return 'Rs. ' + p.toLocaleString('en-IN');
}

export function calculateDynamicPriceBounds({
  properties = [],
  purpose = 'SALE',
  customMin = null,
  customMax = null,
  defaultSaleMax = 100000000,
  defaultRentMax = 200000
} = {}) {
  const isRent = String(purpose).toUpperCase() === 'RENT';
  const defaultMax = isRent ? defaultRentMax : defaultSaleMax;
  const defaultMin = 0;

  // Extract valid prices from property list
  const validPrices = [];
  if (Array.isArray(properties)) {
    for (const p of properties) {
      if (!p) continue;
      const rawPrice = p.price ?? p.pricing?.totalPrice ?? p.pricing?.price ?? p.totalPrice;
      const num = Number(rawPrice);
      if (!isNaN(num) && num > 0) {
        validPrices.push(num);
      }
    }
  }

  let rawMin = (customMin != null && !isNaN(Number(customMin)) && Number(customMin) > 0)
    ? Number(customMin)
    : (validPrices.length > 0 ? Math.min(...validPrices) : defaultMin);

  let rawMax = (customMax != null && !isNaN(Number(customMax)) && Number(customMax) > rawMin)
    ? Number(customMax)
    : (validPrices.length > 0 ? Math.max(...validPrices) : defaultMax);

  // If min and max are equal (e.g. only 1 property), pad bounds by 20%
  if (rawMin === rawMax && rawMin > 0) {
    rawMin = isRent
      ? Math.max(0, Math.floor(rawMin * 0.8 / 1000) * 1000)
      : Math.max(0, Math.floor(rawMin * 0.8 / 100000) * 100000);
    rawMax = isRent
      ? Math.ceil(rawMax * 1.2 / 5000) * 5000
      : Math.ceil(rawMax * 1.2 / 100000) * 100000;
  }

  // Round bounds cleanly for smooth slider usability
  let sliderMin = rawMin;
  let sliderMax = rawMax;

  if (isRent) {
    sliderMin = Math.max(0, Math.floor(rawMin / 1000) * 1000);
    sliderMax = Math.ceil(rawMax / 5000) * 5000;
  } else {
    if (rawMin >= 100000) {
      sliderMin = Math.max(0, Math.floor(rawMin / 100000) * 100000);
    } else if (rawMin > 0) {
      sliderMin = Math.max(0, Math.floor(rawMin / 50000) * 50000);
    } else {
      sliderMin = 0;
    }

    if (rawMax >= 5000000) {
      sliderMax = Math.ceil(rawMax / 500000) * 500000;
    } else {
      sliderMax = Math.ceil(rawMax / 100000) * 100000;
    }
  }

  // Ensure max strictly exceeds min
  if (sliderMax <= sliderMin) {
    sliderMin = defaultMin;
    sliderMax = defaultMax;
  }

  const span = sliderMax - sliderMin;
  let step = 100000;
  if (isRent) {
    step = span > 50000 ? 5000 : 1000;
  } else {
    if (span <= 5000000) step = 50000;
    else if (span <= 20000000) step = 100000;
    else step = 500000;
  }

  return {
    min: sliderMin,
    max: sliderMax,
    rawMin,
    rawMax,
    step,
    hasPropertiesWithPrice: validPrices.length > 0,
    count: validPrices.length
  };
}

export function getScaleMarkers(min, max) {
  const span = max - min;
  const p1 = min;
  const p2 = Math.round(min + span * 0.33);
  const p3 = Math.round(min + span * 0.66);
  const p4 = max;

  return [
    { value: p1, label: formatPriceCompact(p1) },
    { value: p2, label: formatPriceCompact(p2) },
    { value: p3, label: formatPriceCompact(p3) },
    { value: p4, label: formatPriceCompact(p4) }
  ];
}

export function filterBudgetPresets(presets = [], minBound = 0, maxBound = Infinity) {
  if (!Array.isArray(presets)) return [];
  return presets.filter(preset => {
    const pMin = preset.min ? Number(preset.min) : 0;
    const pMax = preset.max ? Number(preset.max) : Infinity;
    return pMin <= maxBound && pMax >= minBound;
  });
}
