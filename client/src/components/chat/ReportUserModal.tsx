import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { User } from '../../types';

interface ReportUserModalProps {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onReportSuccess: () => void;
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or unsolicited advertising' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate or explicit content' },
  { id: 'scam', label: 'Scam, fraud, or phishing' },
  { id: 'impersonation', label: 'Impersonation of someone else' },
  { id: 'other', label: 'Other violation of community guidelines' },
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onReportSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].id);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fullReason = details.trim()
      ? `${selectedReason}: ${details.trim()}`
      : selectedReason;

    try {
      await axios.post('/api/users/report', {
        reportedUserId: user.id,
        reason: fullReason,
      });
      onReportSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-gold-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Report User</h3>
              <p className="text-[11px] text-dark-400">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-dark-200 mb-2">
              Why are you reporting this user?
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-colors ${
                    selectedReason === r.id
                      ? 'bg-rose-500/15 border-rose-500/40 text-white'
                      : 'bg-dark-800/60 border-dark-700/60 text-dark-300 hover:bg-dark-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r.id}
                    checked={selectedReason === r.id}
                    onChange={() => setSelectedReason(r.id)}
                    className="accent-rose-500"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-200 mb-1">
              Additional Details (Optional)
            </label>
            <textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context or incident specifics..."
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-rose-400 resize-none"
            />
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/80 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Reports are reviewed by platform administrators. False reports may result in account restrictions.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-dark-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
