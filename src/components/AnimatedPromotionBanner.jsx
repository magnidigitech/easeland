import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, ShieldCheck, TrendingUp, MapPin } from 'lucide-react';

export default function AnimatedPromotionBanner({ onPostProperty, onExploreMap }) {
  const animatedPhrases = [
    {
      badge: 'DIRECT BUYER SPOTLIGHT',
      highlight: '10x Faster Inquiries',
      title: 'Feature Your Land Plot or Home in EaseLand Verified Spotlight',
      subtitle: 'Connect directly with verified buyers across India with zero brokerage commissions and 100% legal document verification.'
    },
    {
      badge: 'ZERO BROKERAGE COMMISSION',
      highlight: 'Direct Owner Connect',
      title: 'Sell or Rent Your Verified Property Directly to Real Buyers',
      subtitle: 'Get your plot boundaries delineated on satellite maps and your title deeds audited within 24 hours.'
    },
    {
      badge: 'PAN-INDIA GEOSPATIAL SEARCH',
      highlight: 'Verified Map Discovery',
      title: 'Target Buyers Searching in Guntur, Amaravathi, Hyderabad & Beyond',
      subtitle: 'Showcase your property with drone footage, verified boundary coordinates, and direct WhatsApp inquiries.'
    }
  ];

  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % animatedPhrases.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [animatedPhrases.length]);

  const current = animatedPhrases[phraseIndex];

  const tickerItems = [
    '⭐ Verified Spotlight Placement',
    '📍 Leaflet Satellite Boundary Polygons',
    '⚡ 10x More Direct Buyer Enquiries',
    '🛡️ 100% Legal Document Audits',
    '📞 Direct Phone & WhatsApp Connections',
    '🤝 Zero Brokerage Commissions',
    '🏡 Residential Plots, Villas, Flats & Farmlands'
  ];

  return (
    <section className="px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl py-8 sm:py-12 transition-all duration-500 ease-in-out">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-charcoal via-slate-900 to-brand-charcoal text-white p-6 sm:p-10 border border-amber-400/40 shadow-xl">
        {/* Ambient Animated Glow Spots */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.5s' }}></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-400/20 border border-amber-400/40 text-amber-300 mb-3 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
              <span>{current.badge}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight transition-all duration-500 min-h-[5rem] sm:min-h-[4rem] flex items-center">
              <span className="bg-gradient-to-r from-white via-amber-200 to-amber-400 bg-clip-text text-transparent animate-text-shimmer">
                {current.title}
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed max-w-xl transition-all duration-500">
              {current.subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 self-start md:self-center">
            <button
              type="button"
              onClick={onPostProperty}
              className="bg-brand-yellow hover:bg-amber-400 text-brand-charcoal font-black text-xs px-5 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-brand-charcoal fill-brand-charcoal" />
              <span>Promote Your Property</span>
            </button>
            <button
              type="button"
              onClick={onExploreMap}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-5 py-3 rounded-xl border border-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore All on Map</span>
              <ChevronRight className="w-4 h-4 text-brand-yellow" />
            </button>
          </div>
        </div>

        {/* Animated Infinite Ticker / Marquee */}
        <div className="relative mt-6 overflow-hidden pt-1">
          <div className="animate-marquee-infinite gap-4 items-center">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-200 whitespace-nowrap shadow-xs"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
