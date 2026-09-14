import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Users,
  MessageSquare,
  User,
  ArrowRight,
} from 'lucide-react';
import axios from 'axios';
import { User as UserType, Group, Message } from '../../types';
import { Avatar } from './Avatar';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserType) => void;
  onSelectGroup: (group: Group) => void;
}

type FilterType = 'all' | 'users' | 'groups' | 'messages';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  onSelectGroup,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setUsers([]);
      setGroups([]);
      setMessages([]);
    }
  }, [isOpen]);

  // Debounced Search
  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setGroups([]);
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/chat/search?q=${encodeURIComponent(query.trim())}`);
        setUsers(res.data.users || []);
        setGroups(res.data.groups || []);
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalResults =
    (filter === 'all' || filter === 'users' ? users.length : 0) +
    (filter === 'all' || filter === 'groups' ? groups.length : 0) +
    (filter === 'all' || filter === 'messages' ? messages.length : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 pt-12 sm:pt-20 bg-dark-950/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-2xl bg-dark-900 border border-gold-500/25 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] royal-card">
        
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-gold-500/15 bg-dark-950/90 flex items-center gap-3">
          <Search className="w-5 h-5 text-gold-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, groups, or messages..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-dark-500 focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 rounded-full border-2 border-gold-400 border-t-transparent animate-spin shrink-0" />
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-dark-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 px-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-dark-300 hover:text-white text-xs font-bold transition-all ml-1 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 p-3 px-5 border-b border-white/5 bg-dark-950/40 text-xs font-bold overflow-x-auto">
          {(['all', 'users', 'groups', 'messages'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl capitalize transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20 text-amber-300 border border-gold-400/40 shadow-sm'
                  : 'text-dark-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {f === 'all'
                ? 'All Results'
                : f === 'users'
                ? `People (${users.length})`
                : f === 'groups'
                ? `Groups (${groups.length})`
                : `Messages (${messages.length})`}
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {!query.trim() ? (
            <div className="py-12 text-center space-y-2">
              <Search className="w-8 h-8 text-gold-500/40 mx-auto" />
              <p className="text-xs text-dark-300 font-bold">Search Nexus Universal Realm</p>
              <p className="text-[11px] text-dark-500">
                Find members by name or @username, search group channels, or locate message keywords.
              </p>
            </div>
          ) : totalResults === 0 && !loading ? (
            <div className="py-12 text-center space-y-2">
              <Users className="w-8 h-8 text-dark-600 mx-auto" />
              <p className="text-xs text-dark-300 font-bold">No results found for "{query}"</p>
              <p className="text-[11px] text-dark-500">Try a different spelling or keyword.</p>
            </div>
          ) : (
            <>
              {/* Users Section */}
              {(filter === 'all' || filter === 'users') && users.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>People ({users.length})</span>
                  </h4>
                  <div className="space-y-1">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          onSelectUser(u);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded-2xl bg-dark-950/60 hover:bg-dark-850/80 border border-white/5 hover:border-gold-500/20 transition-all flex items-center justify-between text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={u.avatar_url} name={u.full_name} size="sm" planId={u.plan_id} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate group-hover:text-amber-200">
                              {u.full_name}
                            </p>
                            <p className="text-[10px] text-dark-400 font-mono">@{u.username}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-dark-500 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Groups Section */}
              {(filter === 'all' || filter === 'groups') && groups.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Groups ({groups.length})</span>
                  </h4>
                  <div className="space-y-1">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          onSelectGroup(g);
                          onClose();
                        }}
                        className="w-full p-2.5 rounded-2xl bg-dark-950/60 hover:bg-dark-850/80 border border-white/5 hover:border-gold-500/20 transition-all flex items-center justify-between text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 border border-gold-500/30 flex items-center justify-center text-amber-300 shrink-0">
                            {g.avatar_url ? (
                              <img src={g.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate group-hover:text-amber-200">
                              {g.name}
                            </p>
                            <p className="text-[10px] text-dark-400 truncate">
                              {g.description || `${g.member_count || 1} members`}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-dark-500 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Section */}
              {(filter === 'all' || filter === 'messages') && messages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Messages ({messages.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-dark-950/60 border border-white/5 space-y-1 hover:border-gold-500/20 transition-all"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-amber-300">
                            {m.sender?.full_name || `@${m.sender?.username || 'user'}`}
                          </span>
                          <span className="text-[10px] text-dark-500 font-mono">
                            {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-dark-200 leading-relaxed truncate">
                          {m.type === 'audio' ? '🎤 Voice Note' : m.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
