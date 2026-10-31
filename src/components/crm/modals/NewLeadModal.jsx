import React, { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import {
  CrmLeadSources,
  CrmLeadScores,
  DEFAULT_CRM_AGENTS,
  getActiveCrmAgents,
  getCrmPropertyTypes,
  getAvailableLocations,
  formatAmountInWords,
  numToWordsIndian
} from '../../../firebase/crmService.js';
import DynamicLocationAutofill from '../../common/DynamicLocationAutofill.jsx';

export default function NewLeadModal({
  isOpen,
  onClose,
  onSubmit,
  agents = [],
  availableLocations = [],
  propertyTypes = []
}) {
  const agentList = (Array.isArray(agents) && agents.length > 0) ? agents : getActiveCrmAgents();
  const locationList = (Array.isArray(availableLocations) && availableLocations.length > 0) ? availableLocations : getAvailableLocations();
  const propTypeList = (Array.isArray(propertyTypes) && propertyTypes.length > 0) ? propertyTypes : getCrmPropertyTypes();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: CrmLeadSources.WEBSITE_ENQUIRY,
    score: CrmLeadScores.HOT,
    preferredLocation: locationList[0] || 'Andhra Pradesh',
    preferredPropertyType: propTypeList[0] || 'Open Plot Ventures',
    budgetMin: 3000000,
    budgetMax: 6000000,
    assignedAgent: agentList[0]?.name || 'EaseLand Admin',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        preferredLocation: prev.preferredLocation || locationList[0] || 'Andhra Pradesh',
        preferredPropertyType: prev.preferredPropertyType || propTypeList[0] || 'Open Plot Ventures',
        assignedAgent: prev.assignedAgent || agentList[0]?.name || 'EaseLand Admin'
      }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up max-h-[92dvh] flex flex-col">

        {/* MODAL HEADER */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Users className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <h4 className="font-black text-base">Capture New Buyer / Investor Lead</h4>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="Enter Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (10 Digits)</label>
              <input
                type="text"
                placeholder="Enter Mobile Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="buyer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lead Score Intent</label>
              <select
                value={formData.score}
                onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
              >
                <option value={CrmLeadScores.HOT}>HOT (High Intent / Ready to Buy)</option>
                <option value={CrmLeadScores.WARM}>WARM (Exploring Options)</option>
                <option value={CrmLeadScores.COLD}>COLD (Long-term Investor)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Location</label>
              <DynamicLocationAutofill
                id="new-lead-preferred-location"
                value={formData.preferredLocation}
                onChange={(val) => setFormData({ ...formData, preferredLocation: val })}
                onSelect={(item) => setFormData({
                  ...formData,
                  preferredLocation: item.title,
                  preferredDistrict: item.district || '',
                  preferredState: item.state || ''
                })}
                placeholder="Search village, mandal, district or landmark throughout India..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Property Type</label>
              <select
                value={formData.preferredPropertyType}
                onChange={(e) => setFormData({ ...formData, preferredPropertyType: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
              >
                {propTypeList.map(pt => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Max Budget Envelope (Rs)</label>
              <input
                type="number"
                placeholder="e.g. 5000000"
                value={formData.budgetMax}
                onChange={(e) => setFormData({ ...formData, budgetMax: Number(e.target.value) })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all shadow-xs"
              />

              {/* 1-TAP BUDGET SPEED PRESETS */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {[
                  { label: '25 L', val: 2500000 },
                  { label: '50 L', val: 5000000 },
                  { label: '75 L', val: 7500000 },
                  { label: '1 Cr', val: 10000000 },
                  { label: '2 Cr', val: 20000000 },
                  { label: '5 Cr', val: 50000000 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setFormData({ ...formData, budgetMax: p.val })}
                    className={'px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ' +
                      (Number(formData.budgetMax) === p.val
                        ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      )
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {Number(formData.budgetMax) > 0 && (
                <div className="mt-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-0.5 animate-fade-in shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-black text-slate-900">
                    <span className="text-slate-500 font-extrabold uppercase text-[10px]">Formatted Envelope:</span>
                    <span className="text-emerald-700 font-black">{formatAmountInWords(Number(formData.budgetMax))}</span>
                  </div>
                  <p className="text-[11px] font-extrabold text-amber-900 tracking-tight">
                    Up to {numToWordsIndian(Number(formData.budgetMax))} Rupees
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Portfolio Broker</label>
              <select
                value={formData.assignedAgent}
                onChange={(e) => setFormData({ ...formData, assignedAgent: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
              >
                {agentList.map(ag => (
                  <option key={ag.id} value={ag.name}>{ag.name} ({ag.role})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Requirements & Vastu Notes</label>
            <textarea
              rows={2}
              placeholder="Specific road width, vastu preferences, corner plot requirement..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
            ></textarea>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Save Lead to Database
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
