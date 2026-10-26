import React, { useState, useEffect } from 'react';
import { Briefcase, X } from 'lucide-react';
import {
  CrmDealStages,
  CrmStageLabels,
  DEFAULT_CRM_AGENTS,
  getActiveCrmAgents,
  getAvailableLocations,
  formatAmountInWords,
  numToWordsIndian
} from '../../../firebase/crmService.js';
import DynamicLocationAutofill from '../../common/DynamicLocationAutofill.jsx';

export default function NewDealModal({
  isOpen,
  onClose,
  onSubmit,
  kanbanStages,
  agents = [],
  availableLocations = []
}) {
  const agentList = (Array.isArray(agents) && agents.length > 0) ? agents : getActiveCrmAgents();
  const locationList = (Array.isArray(availableLocations) && availableLocations.length > 0) ? availableLocations : getAvailableLocations();

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    propertyTitle: '',
    propertyLocation: locationList[0] || 'Andhra Pradesh',
    ownerName: '',
    ownerPhone: '',
    dealValue: '',
    commissionRate: 1.5,
    stage: CrmDealStages.NEW,
    expectedClosingDate: '',
    assignedAgent: agentList[0]?.name || 'EaseLand Admin',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        propertyLocation: prev.propertyLocation || locationList[0] || 'Andhra Pradesh',
        assignedAgent: prev.assignedAgent || agentList[0]?.name || 'EaseLand Admin'
      }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      dealValue: Number(formData.dealValue) || 0
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">

        {/* MODAL HEADER */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Briefcase className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <h4 className="font-black text-base">Initiate Transaction Deal</h4>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Buyer Name *</label>
              <input
                type="text"
                required
                placeholder="Enter Buyer Name"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Buyer Phone</label>
              <input
                type="text"
                placeholder="Enter 10-digit number"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Property Listing Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. 500 Sq Yd East Facing Commercial Plot"
                value={formData.propertyTitle}
                onChange={(e) => setFormData({ ...formData, propertyTitle: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Property Location</label>
              <DynamicLocationAutofill
                id="new-deal-property-location"
                value={formData.propertyLocation}
                onChange={(val) => setFormData({ ...formData, propertyLocation: val })}
                onSelect={(item) => setFormData({
                  ...formData,
                  propertyLocation: item.title,
                  propertyDistrict: item.district || '',
                  propertyState: item.state || ''
                })}
                placeholder="Search village, mandal, district or landmark throughout India..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Agreed Deal Value (Rs) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 4500000"
                value={formData.dealValue}
                onChange={(e) => setFormData({ ...formData, dealValue: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all shadow-xs"
              />

              {/* 1-TAP BUDGET SPEED PRESETS */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {[
                  { label: '25 L', val: 2500000 },
                  { label: '50 L', val: 5000000 },
                  { label: '75 L', val: 7500000 },
                  { label: '1 Cr', val: 10000000 },
                  { label: '2.5 Cr', val: 25000000 },
                  { label: '5 Cr', val: 50000000 }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setFormData({ ...formData, dealValue: p.val })}
                    className={'px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer ' +
                      (Number(formData.dealValue) === p.val
                        ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      )
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {Number(formData.dealValue) > 0 && (
                <div className="mt-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-0.5 animate-fade-in shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-black text-slate-900">
                    <span className="text-slate-500 font-extrabold uppercase text-[10px]">Formatted Value:</span>
                    <span className="text-emerald-700 font-black">{formatAmountInWords(Number(formData.dealValue))}</span>
                  </div>
                  <p className="text-[11px] font-extrabold text-amber-900 tracking-tight">
                    {numToWordsIndian(Number(formData.dealValue))} Rupees
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Initial Stage</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
              >
                {kanbanStages.map(st => (
                  <option key={st} value={st}>{CrmStageLabels[st] || st}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Closing Date</label>
              <input
                type="date"
                value={formData.expectedClosingDate}
                onChange={(e) => setFormData({ ...formData, expectedClosingDate: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Commission Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Broker</label>
              <select
                value={formData.assignedAgent}
                onChange={(e) => setFormData({ ...formData, assignedAgent: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
              >
                {agentList.map(ag => (
                  <option key={ag.id} value={ag.name}>{ag.name}</option>
                ))}
              </select>
            </div>
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
              Initiate Deal in Pipeline
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
