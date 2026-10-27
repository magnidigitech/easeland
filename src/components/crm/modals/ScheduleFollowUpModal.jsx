import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X, CheckCircle2, MessageSquare, PhoneCall, Tag } from 'lucide-react';

export default function ScheduleFollowUpModal({
  isOpen,
  onClose,
  deal,
  onSave,
  agentName = 'EaseLand Admin'
}) {
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('11:00 AM');
  const [followUpAction, setFollowUpAction] = useState('');
  const [logActivity, setLogActivity] = useState(false);
  const [callOutcome, setCallOutcome] = useState('CONNECTED_INTERESTED');
  const [activityNote, setActivityNote] = useState('');

  useEffect(() => {
    if (deal && isOpen) {
      const todayIso = new Date().toISOString().split('T')[0];
      setFollowUpDate(deal.nextFollowUpDate || todayIso);
      setFollowUpTime(deal.nextFollowUpTime || '11:00 AM');
      setFollowUpAction(deal.nextFollowUpAction || 'Follow up with client regarding transaction next steps');
      setLogActivity(false);
      setCallOutcome('CONNECTED_INTERESTED');
      setActivityNote('');
    }
  }, [deal, isOpen]);

  if (!isOpen || !deal) return null;

  // Quick Date Presets
  const applyPreset = (daysOffset, defaultTime = '11:00 AM') => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    setFollowUpDate(target.toISOString().split('T')[0]);
    setFollowUpTime(defaultTime);
  };

  const QUICK_ACTION_TAGS = [
    'Link Documents & Title Audit',
    'Schedule Physical Site Visit',
    'Price Negotiation & Counter Offer',
    'Token Advance Payment Reminder',
    'Draft Sale Agreement Review',
    'Sub-Registrar Office Slot Booking'
  ];

  const CALL_OUTCOMES = [
    { id: 'CONNECTED_INTERESTED', label: 'Connected & Interested' },
    { id: 'PRICE_COUNTER', label: 'Counter-Offer Discussed' },
    { id: 'DOCS_REQUESTED', label: 'Land Docs Requested' },
    { id: 'BUSY_CALLBACK', label: 'Busy / Callback Requested' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    let combinedLogNote = '';
    if (logActivity) {
      const outcomeLabel = CALL_OUTCOMES.find(o => o.id === callOutcome)?.label || callOutcome;
      combinedLogNote = 'Call Logged: ' + outcomeLabel + (activityNote ? ' - ' + activityNote : '');
    }

    onSave(deal.id || deal.dealId, {
      followUpDate,
      followUpTime,
      followUpAction: followUpAction.trim(),
      logNote: combinedLogNote,
      agentName
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">

        {/* MODAL HEADER */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Calendar className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-black text-base">Schedule Client Follow-up</h4>
              <span className="text-[11px] text-amber-400 font-bold block truncate max-w-xs">
                {deal.customerName} • {deal.propertyTitle}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* DATE & TIME PRESETS */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Quick Presets</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => applyPreset(0, '03:00 PM')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                Today (3 PM)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(1, '10:30 AM')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                Tomorrow (10:30 AM)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(3, '11:00 AM')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                In 3 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset(7, '11:00 AM')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer"
              >
                Next Week
              </button>
            </div>
          </div>

          {/* DATE & TIME INPUTS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Scheduled Time</label>
              <input
                type="text"
                placeholder="e.g. 11:30 AM"
                value={followUpTime}
                onChange={(e) => setFollowUpTime(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* ACTION / AGENDA TAGS */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-500" />
              <span>Recommended Agenda Tags</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {QUICK_ACTION_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFollowUpAction(tag)}
                  className={'px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ' +
                    (followUpAction === tag
                      ? 'bg-amber-400 border-amber-400 text-slate-950 font-black'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-400 hover:bg-white'
                    )
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* ACTION DESCRIPTION */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Follow-up Action Note *</label>
            <input
              type="text"
              required
              placeholder="e.g. Contact buyer to confirm token deposit date"
              value={followUpAction}
              onChange={(e) => setFollowUpAction(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
          </div>

          {/* OPTIONAL CALL LOGGING TOGGLE */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-slate-800">
              <input
                type="checkbox"
                checked={logActivity}
                onChange={(e) => setLogActivity(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
              />
              <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
              <span>Also log a completed call note for today</span>
            </label>

            {logActivity && (
              <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in duration-150">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Call Outcome:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {CALL_OUTCOMES.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setCallOutcome(o.id)}
                      className={'p-1.5 rounded-lg text-[10px] font-bold border text-left transition-colors cursor-pointer truncate ' +
                        (callOutcome === o.id
                          ? 'bg-amber-100 border-amber-400 text-amber-950 font-black'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        )
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Notes from call (e.g. Buyer asked for 10% discount on plot)"
                  value={activityNote}
                  onChange={(e) => setActivityNote(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Save Follow-up</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
