import React, { useState, useEffect } from 'react';
import { LandPlot, Home, Building2, Store, Key, ArrowRight } from 'lucide-react';
import { mockApi } from '../services/mockApi';

export default function PropertyCategoryCards({ onSelectCategory }) {
  const [siteConfig, setSiteConfig] = useState(mockApi.getSiteConfig());

  useEffect(() => {
    const handleConfigUpdated = (e) => setSiteConfig(e.detail || mockApi.getSiteConfig());
    window.addEventListener('easeland-site-config-updated', handleConfigUpdated);
    return () => window.removeEventListener('easeland-site-config-updated', handleConfigUpdated);
  }, []);

  const categories = [
    {
      id: 'open-plots',
      name: 'Open Plots',
      category: 'Open Plots',
      count: 'DTCP & HMDA Approved Plots',
      icon: LandPlot,
      description: 'Gated residential plots, corner plots, and layouts across AP, TS & Pan-India.',
      badge: 'High Demand'
    },
    {
      id: 'houses',
      name: 'Houses & Villas',
      category: 'Houses',
      count: 'Independent Villas & Houses',
      icon: Home,
      description: 'Standalone G+1/G+2 houses, duplex villas, and family homes.',
      badge: 'Direct Owner'
    },
    {
      id: 'apartments',
      name: 'Apartments',
      category: 'Apartments',
      count: 'Multi-storey Flats',
      icon: Building2,
      description: '2 BHK, 3 BHK luxury flats in modern residential towers with amenities.',
      badge: 'Khata Verified'
    },
    {
      id: 'commercial',
      name: 'Commercial',
      category: 'Commercial',
      count: 'Shops & Office Spaces',
      icon: Store,
      description: 'Commercial plots, main-road shop spaces, and office floors.',
      badge: 'High ROI'
    },
    {
      id: 'rentals',
      name: 'Rentals',
      category: 'Rentals',
      count: 'Rental Homes & Offices',
      icon: Key,
      description: 'Fully-furnished rental apartments, independent houses, and PG rooms.',
      badge: 'Zero Brokerage'
    }
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-950 bg-metallic-gold px-3.5 py-1.5 rounded-md shadow-md border border-amber-300 inline-block">
            Property Categories
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
            Explore Properties by Category
          </h2>
        </div>
        <p className="text-sm text-slate-600 font-medium max-w-md mt-2 md:mt-0 leading-relaxed">
          All property categories utilize our single Universal Map Discovery Engine with verified listings and direct owner contacts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {categories.map((cat) => {
          const IconComponent = cat.icon;
          return (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat.category)}
              className="group bg-white rounded-2xl p-6 border border-slate-200 shadow-lg hover:shadow-2xl hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between transform hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 group-hover:bg-metallic-gold group-hover:text-slate-950 flex items-center justify-center transition-all shadow-md border border-slate-800">
                    <IconComponent className="w-6 h-6 stroke-[2]" />
                  </div>
                  <span className="text-[11px] font-extrabold bg-slate-950 text-white group-hover:bg-amber-500 group-hover:text-slate-950 px-3 py-1 rounded-full shadow-sm border border-slate-800 transition-colors tracking-wide">
                    {cat.badge}
                  </span>
                </div>

                <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-amber-600 mb-2 transition-colors">
                  {cat.name}
                </h3>
                
                <p className="text-xs text-slate-700 font-semibold mb-4 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs font-extrabold text-slate-900 group-hover:text-amber-600 transition-colors">
                <span>Explore Map</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}
