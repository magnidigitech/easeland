import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import {
  DEFAULT_CRM_AGENTS,
  getActiveCrmAgents,
  getAvailableLocations
} from '../../../firebase/crmService.js';
import DynamicLocationAutofill from '../../common/DynamicLocationAutofill.jsx';

export default function ScheduleVisitModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  agents = [],
  availableLocations = []
}) {
  const agentList = (Array.isArray(agents) && agents.length > 0) ? agents : getActiveCrmAgents();
  const locationList = (Array.isArray(availableLocations) && availableLocations.length > 0) ? availableLocations : getAvailableLocations();

  const [formData, setFormData] = useState({
    dealId: '',
    propertyTitle: '',
    propertyLocation: locationList[0] || 'Andhra Pradesh',
    customerName: '',
    customerPhone: '',
    visitDate: new Date().toISOString().split('T')[0],
    visitTime: '10:30 AM',
    agentAssigned: agentList[0]?.name || 'EaseLand Admin',
    customerNotes: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        propertyLocation: initialData.propertyLocation || prev.propertyLocation || locationList[0] || 'Andhra Pradesh',
        agentAssigned: initialData.agentAssigned || prev.agentAssigned || agentList[0]?.name || 'EaseLand Admin'
      }));
    } else if (isOpen) {
      setFormData(prev => ({
        ...prev,
        propertyLocation: prev.propertyLocation || locationList[0] || 'Andhra Pradesh',
        agentAssigned: prev.agentAssigned || agentList[0]?.name || 'EaseLand Admin'
      }));
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">

        {/* MODAL HEADER */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Calendar className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <h4 className="font-black text-base">Schedule Physical Land Inspection</h4>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Buyer Name *</label>
              <input
                type="text"
                required
                placeholder="Enter Customer Name"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer Phone *</label>
              <input
                type="text"
                required
                placeholder="10-digit mobile number"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Property Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Plot No 42, CRDA Layout, Tulluru"
                value={formData.propertyTitle}
                onChange={(e) => setFormData({ ...formData, propertyTitle: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Property Location</label>
              <DynamicLocationAutofill
                id="schedule-visit-property-location"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Date *</label>
              <input
                type="date"
                required
                value={formData.visitDate}
                onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Time *</label>
              <input
                type="text"
                required
                placeholder="e.g. 11:00 AM"
                value={formData.visitTime}
                onChange={(e) => setFormData({ ...formData, visitTime: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Field Executive Assigned</label>
            <select
              value={formData.agentAssigned}
              onChange={(e) => setFormData({ ...formData, agentAssigned: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer"
            >
              {agentList.map(ag => (
                <option key={ag.id} value={ag.name}>{ag.name} ({ag.role})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Point & Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Meet buyer at Mangalagiri bypass junction with boundary survey maps..."
              value={formData.customerNotes}
              onChange={(e) => setFormData({ ...formData, customerNotes: e.target.value })}
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
              Confirm & Dispatch Visit
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
