import React, { useState, useEffect } from 'react';
import { X, Send, Search, Check, Users } from 'lucide-react';
import axios from 'axios';
import { User, Group, Message } from '../../types';
import { Avatar } from '../common/Avatar';

interface ForwardMessageModalProps {
  isOpen: boolean;
  message: Message | null;
  onClose: () => void;
  onForwardSuccess: () => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  message,
  onClose,
  onForwardSuccess,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserIds([]);
      setSelectedGroupIds([]);
      setError(null);
      fetchRecipients();
    }
  }, [isOpen]);

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const [uRes, gRes] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/groups').catch(() => ({ data: { groups: [] } })),
      ]);
      setUsers(uRes.data.users || []);
      setGroups(gRes.data?.groups || []);
    } catch (err: any) {
      console.error('Failed to load recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (!message) return;
    if (selectedUserIds.length === 0 && selectedGroupIds.length === 0) {
      setError('Please select at least one recipient.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await axios.post('/api/chat/messages/forward', {
        messageId: message.id,
        targetUserIds: selectedUserIds,
        targetGroupIds: selectedGroupIds,
      });
      onForwardSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to forward message.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !message) return null;

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
  });

  const filteredGroups = groups.filter((g) => {
    const q = search.toLowerCase();
    return g.name.toLowerCase().includes(q);
  });

  const totalSelected = selectedUserIds.length + selectedGroupIds.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-gold-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-dark-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Forward Message</h3>
            <p className="text-[11px] text-dark-400">Select contacts or groups</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3 bg-dark-850 border-b border-dark-800 text-xs text-dark-300 flex items-center gap-2">
          <span className="text-amber-400 font-bold">Preview:</span>
          <span className="truncate italic">
            {message.type === 'audio' ? '🎤 Voice Message' : message.type === 'image' ? '📷 Photo' : message.content}
          </span>
        </div>

        <div className="p-3 border-b border-dark-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-dark-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people or groups..."
              className="w-full pl-8 pr-3 py-1.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Groups list */}
          {filteredGroups.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider mb-2">Groups</p>
              <div className="space-y-1">
                {filteredGroups.map((g) => {
                  const isSelected = selectedGroupIds.includes(g.id);
                  return (
                    <div
                      key={g.id}
                      onClick={() => toggleGroup(g.id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/15 border border-amber-500/30'
                          : 'hover:bg-dark-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{g.name}</p>
                          <p className="text-[10px] text-dark-400 truncate">{g.members_count || 1} members</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-400 border-amber-400 text-dark-950'
                            : 'border-dark-600 bg-dark-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contacts list */}
          <div>
            <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider mb-2">Contacts</p>
            {loading ? (
              <p className="text-xs text-dark-500 text-center py-4">Loading contacts...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-xs text-dark-500 text-center py-4">No contacts found</p>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/15 border border-amber-500/30'
                          : 'hover:bg-dark-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={u.avatar_url} name={u.full_name} size="xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{u.full_name}</p>
                          <p className="text-[10px] text-dark-400 truncate">@{u.username}</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-400 border-amber-400 text-dark-950'
                            : 'border-dark-600 bg-dark-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-dark-800 flex items-center justify-between">
          <span className="text-xs text-dark-400">
            {totalSelected > 0 ? `${totalSelected} recipient(s) selected` : 'Select recipients'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-dark-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || totalSelected === 0}
              onClick={handleForward}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-dark-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Sending...' : 'Forward'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
