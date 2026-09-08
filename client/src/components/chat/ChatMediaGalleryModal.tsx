import React, { useState } from 'react';
import { X, Image as ImageIcon, Mic, Link as LinkIcon, Download, Calendar, ExternalLink } from 'lucide-react';
import { Message, User } from '../../types';
import { VoicePlayer } from './VoicePlayer';

interface ChatMediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  otherUser: User;
  onSelectMedia: (url: string, senderName?: string) => void;
}

type GalleryTab = 'photos' | 'voice' | 'links';

export const ChatMediaGalleryModal: React.FC<ChatMediaGalleryModalProps> = ({
  isOpen,
  onClose,
  messages,
  otherUser,
  onSelectMedia,
}) => {
  const [activeTab, setActiveTab] = useState<GalleryTab>('photos');

  if (!isOpen) return null;

  // Filter messages
  const photos = messages.filter((m) => m.type === 'image' && m.media_url && !m.is_deleted_for_all);
  const voiceNotes = messages.filter((m) => m.type === 'audio' && m.media_url && !m.is_deleted_for_all);
  const links = messages.filter((m) => !m.is_deleted_for_all && (m.content?.includes('http://') || m.content?.includes('https://')));

  const extractUrls = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-dark-950/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-2xl bg-dark-900 border border-gold-500/25 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] royal-card">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-dark-950/80 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span className="gold-gradient-text">Shared Media & Files</span>
            </h3>
            <p className="text-xs text-dark-400 mt-0.5">Shared with {otherUser.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-3 bg-dark-950/50 border-b border-white/5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'photos'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 shadow-md font-black'
                : 'text-dark-400 hover:text-white hover:bg-dark-850'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos & Videos ({photos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'voice'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 shadow-md font-black'
                : 'text-dark-400 hover:text-white hover:bg-dark-850'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Notes ({voiceNotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'links'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 shadow-md font-black'
                : 'text-dark-400 hover:text-white hover:bg-dark-850'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Links ({links.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'photos' && (
            photos.length === 0 ? (
              <div className="text-center py-16 text-dark-400 space-y-2">
                <ImageIcon className="w-10 h-10 mx-auto text-dark-600" />
                <p className="text-sm font-bold text-white">No photos or media yet</p>
                <p className="text-xs text-dark-500">Photos sent in this chat will show up here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {photos.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectMedia(item.media_url!, otherUser.full_name)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-dark-950 border border-gold-500/20 cursor-pointer shadow-lg hover:border-gold-400 transition-all hover:scale-[1.02]"
                  >
                    <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                      <span className="text-[10px] text-amber-200 font-mono">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'voice' && (
            voiceNotes.length === 0 ? (
              <div className="text-center py-16 text-dark-400 space-y-2">
                <Mic className="w-10 h-10 mx-auto text-dark-600" />
                <p className="text-sm font-bold text-white">No voice notes recorded yet</p>
                <p className="text-xs text-dark-500">Recorded audio messages will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {voiceNotes.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-dark-850/80 border border-gold-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                  >
                    <VoicePlayer audioUrl={item.media_url!} />
                    <span className="text-[10px] font-mono text-dark-400 shrink-0 self-end sm:self-center">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'links' && (
            links.length === 0 ? (
              <div className="text-center py-16 text-dark-400 space-y-2">
                <LinkIcon className="w-10 h-10 mx-auto text-dark-600" />
                <p className="text-sm font-bold text-white">No web links shared</p>
                <p className="text-xs text-dark-500">Web links and URLs posted in chat will be listed here.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {links.map((item) => {
                  const urls = extractUrls(item.content);
                  return urls.map((u, i) => (
                    <a
                      key={`${item.id}-${i}`}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-2xl bg-dark-850/80 border border-gold-500/20 hover:border-gold-400 flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-gold-500/10 text-gold-400 shrink-0">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-amber-200 font-mono truncate group-hover:underline">{u}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-dark-400 group-hover:text-gold-300 shrink-0" />
                    </a>
                  ));
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
