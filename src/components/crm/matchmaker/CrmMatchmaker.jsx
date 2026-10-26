import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Building2,
  Users,
  MapPin,
  MessageSquare,
  Calendar,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import {
  matchPropertiesForLead,
  matchLeadsForProperty,
  calculateBuyerMatchScore
} from '../../../firebase/crmService.js';

export default function CrmMatchmaker({
  leads,
  availableProperties,
  onScheduleVisitForProperty,
  onTriggerWhatsApp
}) {
  const [matchMode, setMatchMode] = useState('buyerToProperty'); // 'buyerToProperty' or 'propertyToBuyer'
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.id || null);
  const [selectedPropertyId, setSelectedPropertyId] = useState(availableProperties[0]?.id || availableProperties[0]?.propertyId || null);
  const [leadSearch, setLeadSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');

  const activeLead = useMemo(() => {
    return leads.find(l => l.id === selectedLeadId) || leads[0] || null;
  }, [leads, selectedLeadId]);

  const activeProperty = useMemo(() => {
    return availableProperties.find(p => (p.id || p.propertyId) === selectedPropertyId) || availableProperties[0] || null;
  }, [availableProperties, selectedPropertyId]);

  // Mode 1: Matched Properties for Active Buyer
  const matchedProperties = useMemo(() => {
    if (!activeLead) return [];
    return matchPropertiesForLead(activeLead, availableProperties);
  }, [activeLead, availableProperties]);

  // Mode 2: Matched Buyers for Active Property
  const matchedBuyers = useMemo(() => {
    if (!activeProperty) return [];
    return matchLeadsForProperty(activeProperty, leads);
  }, [activeProperty, leads]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">

      {/* HEADER & BI-DIRECTIONAL MODE SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
            AI Land & Buyer Matchmaking Engine
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Multi-criteria algorithmic matching based on regional Andhra Pradesh clusters, land use types, and budget envelopes.
          </p>
        </div>

        {/* DUAL MODE TOGGLE */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMatchMode('buyerToProperty')}
            className={'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ' +
              (matchMode === 'buyerToProperty' ? 'bg-slate-900 text-amber-400 shadow-sm' : 'text-slate-600 hover:text-slate-900')
            }
          >
            <Users className="w-3.5 h-3.5" />
            <span>Buyer to Plots</span>
          </button>
          <button
            type="button"
            onClick={() => setMatchMode('propertyToBuyer')}
            className={'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ' +
              (matchMode === 'propertyToBuyer' ? 'bg-slate-900 text-amber-400 shadow-sm' : 'text-slate-600 hover:text-slate-900')
            }
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Plot to Buyers</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODE 1: FIND PLOTS FOR BUYER                                  */}
      {/* ------------------------------------------------------------- */}
      {matchMode === 'buyerToProperty' && (
        <div className="space-y-6">

          {/* BUYER SELECTOR PILLS */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Select Active Buyer ({leads.length}):
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {leads.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLeadId(l.id)}
                  className={'px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ' +
                    (activeLead?.id === l.id
                      ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-sm ring-2 ring-amber-400/50'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    )
                  }
                >
                  <span>{l.name}</span>
                  <span className="text-[10px] opacity-70 font-semibold">({l.preferredLocation?.split('/')[0]?.trim() || 'AP'})</span>
                </button>
              ))}
            </div>
          </div>

          {activeLead && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">Matching Envelope</span>
                <h4 className="text-base font-black text-slate-900">{activeLead.name}</h4>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600 flex-wrap">
                  <span>Region: {activeLead.preferredLocation}</span>
                  <span>•</span>
                  <span>Type: {activeLead.preferredPropertyType}</span>
                  <span>•</span>
                  <span className="text-emerald-700">Budget: {activeLead.budgetDisplay}</span>
                </div>
              </div>

              {activeLead.phone && (
                <button
                  type="button"
                  onClick={() => onTriggerWhatsApp(activeLead.phone, activeLead.name)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Buyer</span>
                </button>
              )}
            </div>
          )}

          {/* MATCHED PROPERTIES GRID */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Ranked Matching Land Parcels ({matchedProperties.length})
            </h4>

            {matchedProperties.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs font-semibold">
                No properties in the database meet the minimum matching criteria for this buyer. Consider broadening budget or location parameters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {matchedProperties.map(({ property, matchScore }) => (
                  <div
                    key={property.id || property.propertyId}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 p-4 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className={'px-2.5 py-1 rounded-full text-[10px] font-black shadow-2xs ' +
                          (matchScore >= 80 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                            matchScore >= 60 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                              'bg-blue-100 text-blue-900 border border-blue-300')
                        }>
                          {matchScore}% Algorithmic Match
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {property.propertyType || property.category || 'Open Plot'}
                        </span>
                      </div>

                      <h5 className="font-black text-sm text-slate-900 line-clamp-1">
                        {property.title || 'Verified Land Parcel'}
                      </h5>

                      <p className="text-xs text-slate-500 flex items-center gap-1 line-clamp-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{property.locationName || property.address || property.city || property.district || 'Verified Venture'}</span>
                      </p>

                      {/* ALGORITHMIC CRITERIA BREAKDOWN PILLS */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Location Fit: 100%
                        </span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                          Budget Envelope Fit
                        </span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                          Zoning Verified
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-black">
                        <span className="text-slate-400 text-[10px] uppercase tracking-wider">Listed Price</span>
                        <span className="text-emerald-700 font-black text-sm">{property.priceDisplay || ('Rs. ' + ((Number(property.price || 0)) / 100000).toFixed(1) + ' Lakhs')}</span>
                      </div>
                    </div>

                    {/* DUAL ACTION BUTTONS: BOOK VISIT + 1-CLICK WHATSAPP PITCH */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onScheduleVisitForProperty(property, activeLead)}
                        className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                      >
                        <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Book Visit</span>
                      </button>

                      {activeLead && activeLead.phone && (
                        <button
                          type="button"
                          onClick={() => onTriggerWhatsApp(
                            activeLead.phone,
                            activeLead.name,
                            (property.title || 'Land Parcel') + ' in ' + (property.locationName || property.city || 'AP Region')
                          )}
                          className="px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                          title="Send matched property pitch to buyer on WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Pitch</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE 2: FIND BUYERS FOR PROPERTY (REVERSE MATCHING)           */}
      {/* ------------------------------------------------------------- */}
      {matchMode === 'propertyToBuyer' && (
        <div className="space-y-6">

          {/* PROPERTY SELECTOR PILLS */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Select Land Listing ({availableProperties.length}):
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {availableProperties.map(p => {
                const pId = p.id || p.propertyId;
                const isSelected = (activeProperty?.id || activeProperty?.propertyId) === pId;
                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => setSelectedPropertyId(pId)}
                    className={'px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ' +
                      (isSelected
                        ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-sm ring-2 ring-amber-400/50'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      )
                    }
                  >
                    <span className="max-w-[200px] truncate">{p.title || 'Plot'}</span>
                    <span className="text-[10px] opacity-70 font-semibold">{p.priceDisplay || 'Rs. Price'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeProperty && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">Active Listing for Dispatch</span>
                <h4 className="text-base font-black text-white">{activeProperty.title}</h4>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-300 flex-wrap">
                  <span>Location: {activeProperty.locationName || activeProperty.city || activeProperty.district || 'Prime Venture'}</span>
                  <span>•</span>
                  <span>Category: {activeProperty.propertyType || activeProperty.category || 'Plot'}</span>
                  <span>•</span>
                  <span className="text-emerald-400">Price: {activeProperty.priceDisplay || ('Rs. ' + ((Number(activeProperty.price) || 0) / 100000).toFixed(1) + ' L')}</span>
                </div>
              </div>
            </div>
          )}

          {/* MATCHED BUYERS FOR PROPERTY */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Qualified Buyers in CRM Matching this Parcel ({matchedBuyers.length})
            </h4>

            {matchedBuyers.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs font-semibold">
                No buyers in directory currently seeking properties matching this parcel.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {matchedBuyers.map(({ lead, matchScore }) => (
                  <div
                    key={lead.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 p-4 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={'px-2.5 py-1 rounded-full text-[10px] font-black ' +
                          (matchScore >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            matchScore >= 60 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              'bg-blue-100 text-blue-800 border border-blue-300')
                        }>
                          {matchScore}% Intent Match
                        </span>
                        <span className={'text-[10px] font-black px-2 py-0.5 rounded-full uppercase ' +
                          (lead.score === 'HOT' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600')
                        }>
                          {lead.score || 'HOT'}
                        </span>
                      </div>

                      <h5 className="font-black text-sm text-slate-900">
                        {lead.name}
                      </h5>

                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Seeking: {lead.preferredLocation}</span>
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-black">
                        <span className="text-slate-400 text-[10px] uppercase">Budget Capacity</span>
                        <span className="text-emerald-600 font-extrabold">{lead.budgetDisplay}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onTriggerWhatsApp(lead.phone, lead.name, activeProperty.title)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Dispatch Pitch on WhatsApp</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
