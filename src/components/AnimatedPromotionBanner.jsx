import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, ShieldCheck, TrendingUp, MapPin } from 'lucide-react';

export default function AnimatedPromotionBanner({ onPostProperty, onExploreMap }) {
  const animatedPhrases = [
    {
      badge: 'PRE-SCREENED BUYER NETWORK',
      highlight: '10x Faster Inquiries',
      title: 'Feature Your Land Plot or Home in EaseLand Verified Spotlight',
      subtitle: 'Connect directly with serious, pre-screened buyers across India. Enjoy assisted deal facilitation, verified boundaries, and 100% legal audit peace of mind.'
    },
    {
      badge: 'ASSISTED DEAL FACILITATION',
      highlight: 'Direct Deal Table',
      title: 'Sell or Rent Your Verified Property Directly to Real Decision Makers',
      subtitle: 'Sit together at the deal table with complete legal backing. Delineated plot boundaries, verified title deeds, and smooth, protected closing.'
    },
    {
      badge: 'PAN-INDIA GEOSPATIAL SEARCH',
      highlight: 'Verified Map Discovery',
      title: 'Target Buyers Searching in Guntur, Amaravati, Hyderabad & Beyond',
      subtitle: 'Showcase your property with drone footage, verified boundary coordinates, and direct high-intent inquiries.'
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
    '⚡ 10x More High-Intent Inquiries',
    '🛡️ 100% Legal Document Audits',
    '📞 Direct Phone & WhatsApp Connections',
    '🤝 Assisted Deal Facilitation & Mediation',
    '🏡 Residential Plots, Villas, Flats & Farmlands'
  ];

  return (
    <section className="px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl py-8 sm:py-12 transition-all duration-500 ease-in-out">
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 bg-gradient-to-br from-slate-950 via-slate-900 to-[#071026] text-white p-6 sm:p-10 border border-amber-400/40 shadow-2xl">
        {/* Ambient Animated Glow Spots */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.5s' }}></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/15">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase bg-amber-400/20 border border-amber-400/40 text-amber-300 mb-3 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="font-extrabold text-amber-300 tracking-wider">{current.badge}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight transition-all duration-500 min-h-[5rem] sm:min-h-[4rem] flex items-center text-white drop-shadow-sm">
              <span className="text-white drop-shadow-sm font-black">
                {current.title}
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed max-w-xl transition-all duration-500 mt-2">
              {current.subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 self-start md:self-center">
            <button
              type="button"
              onClick={onPostProperty}
              className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-black text-xs px-6 py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5 border border-amber-300"
            >
              <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span className="font-black text-slate-950">Promote Your Property</span>
            </button>
            <button
              type="button"
              onClick={onExploreMap}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-6 py-3.5 rounded-xl border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:border-amber-300/60"
            >
              <span className="text-white font-bold">Explore All on Map</span>
              <ChevronRight className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Animated Infinite Ticker / Marquee */}
        <div className="relative mt-6 overflow-hidden pt-1">
          <div className="animate-marquee-infinite gap-4 items-center">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-white whitespace-nowrap shadow-sm"
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
