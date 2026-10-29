import React from 'react';
import { MapPin, Navigation, Compass, ExternalLink } from 'lucide-react';
import { GEOGRAPHIC_HUBS, REGIONAL_STATES } from '../services/geoMapping.js';

export default function RegionalHubsSection({ onSelectCity, onSelectCategory }) {
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200/80">
      <div className="bg-slate-950 bg-gradient-to-br from-slate-950 via-slate-900 to-[#071026] text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-amber-400/30">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2">
              <Compass className="w-3.5 h-3.5" />
              <span>GEOGRAPHIC INVESTMENT HUBS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Strategic Regional Property Corridors
            </h2>
            <p className="text-xs sm:text-sm text-slate-100 font-medium mt-1">
              Curated direct real estate discovery across high-velocity growth zones in Andhra Pradesh, Telangana, and Pan-India.
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-extrabold text-amber-300 block uppercase tracking-widest">Certified Geospatial Mapping</span>
            <span className="text-xs text-slate-200 font-semibold">100% On-Ground Verified Boundaries</span>
          </div>
        </div>

        {/* REGIONAL HUB TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {GEOGRAPHIC_HUBS.map((hub) => (
            <div
              key={hub.id}
              onClick={() => onSelectCity && onSelectCity(hub.shortName)}
              className="bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 hover:border-amber-400/80 rounded-2xl p-5 transition-all duration-300 cursor-pointer group flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30">
                    {hub.badge}
                  </span>
                  <span className="text-[11px] font-bold text-slate-200">{hub.state}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{hub.name}</span>
                </h3>
                <p className="text-xs text-slate-200 font-medium mt-2 leading-relaxed">
                  Key areas: <span className="text-white font-semibold">{hub.popularLocalities.slice(0, 4).join(', ')}</span>
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs font-extrabold text-amber-300 group-hover:text-amber-200">
                <span>Explore {hub.shortName} Listings</span>
                <Navigation className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}

          {/* PAN-INDIA SCOPE TILE */}
          <div
            onClick={() => onSelectCity && onSelectCity('')}
            className="bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 hover:border-emerald-400/80 rounded-2xl p-5 transition-all duration-300 cursor-pointer group flex flex-col justify-between shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300 bg-emerald-400/20 px-2 py-0.5 rounded-md border border-emerald-400/30">
                  NATIONAL SCOPE
                </span>
                <span className="text-[11px] font-bold text-slate-200">All India</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pan-India Direct Discovery</span>
              </h3>
              <p className="text-xs text-slate-100 font-medium mt-2 leading-relaxed">
                Covering Bengaluru, Chennai, Mumbai, Pune, Delhi NCR, and Tier-2 growth corridors.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs font-extrabold text-emerald-300 group-hover:text-emerald-200">
              <span>View All India Properties</span>
              <Navigation className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* STATE FOOTPRINT & INTERNAL SEO LINKS */}
        <div className="pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-200 font-bold">Priority State Footprint:</span>
            {REGIONAL_STATES.map((st) => (
              <span
                key={st.code}
                className="bg-white/15 text-white px-2.5 py-1 rounded-lg font-bold border border-white/20 text-[11px] shadow-sm"
              >
                {st.name} ({st.focalCities.slice(0, 3).join(', ')})
              </span>
            ))}
          </div>
          <div className="text-slate-300 text-[11px] font-semibold flex items-center gap-1">
            <span>RERA Compliant & Title Audited Deals</span>
          </div>
        </div>
      </div>
    </section>
  );
}
