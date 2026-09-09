import React, { useState, useEffect } from 'react';
import { Megaphone, AlertTriangle, X, Crown } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type?: 'alert' | 'info';
  author: string;
  created_at: string;
}

export const GlobalAnnouncementBanner: React.FC = () => {
  const { socket } = useSocket();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleAnnouncement = (data: Announcement) => {
      setAnnouncement(data);
      // Auto-dismiss after 15 seconds if user doesn't close it
      setTimeout(() => {
        setAnnouncement((curr) => (curr?.id === data.id ? null : curr));
      }, 15000);
    };

    socket.on('system:announcement', handleAnnouncement);

    return () => {
      socket.off('system:announcement', handleAnnouncement);
    };
  }, [socket]);

  if (!announcement) return null;

  const isAlert = announcement.type === 'alert';

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-xl animate-in slide-in-from-top-4 duration-300">
      <div
        className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-start gap-3.5 transition-all ${
          isAlert
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-rose-900/30'
            : 'bg-dark-900/95 border-gold-500/40 text-amber-100 shadow-gold-500/20'
        }`}
      >
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            isAlert ? 'bg-rose-500/20 text-rose-400' : 'bg-gold-500/20 text-amber-400'
          }`}
        >
          {isAlert ? <AlertTriangle className="w-5 h-5" /> : <Crown className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isAlert ? 'bg-rose-500/30 text-rose-300' : 'bg-gold-500/30 text-amber-300'
              }`}
            >
              Royal Announcement
            </span>
            <span className="text-[11px] text-dark-400 font-medium">by {announcement.author}</span>
          </div>

          <h4 className="text-sm font-bold text-white mt-1 leading-snug">{announcement.title}</h4>
          <p className="text-xs text-dark-300 mt-0.5 leading-relaxed break-words">{announcement.message}</p>
        </div>

        <button
          type="button"
          onClick={() => setAnnouncement(null)}
          className="p-1.5 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
