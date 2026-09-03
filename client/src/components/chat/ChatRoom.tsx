import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { User, Message, CallType } from '../../types';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import {
  Phone,
  Video,
  Send,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Clock,
  PhoneCall,
  PhoneMissed,
  Image as ImageIcon,
  User as UserIcon,
  Info,
} from 'lucide-react';
import axios from 'axios';

interface ChatRoomProps {
  otherUser: User;
  onViewProfile?: (user: User) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ otherUser, onViewProfile }) => {
  const { user } = useAuth();
  const { socket, onlineUserIds, startCall, latestMessage, typingMap, sendTyping } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  const isOnline = onlineUserIds.has(otherUser.id);
  const isPeerTyping = !!typingMap[otherUser.id];

  const emojis = ['😀', '🔥', '👍', '❤️', '🚀', '🎉', '👋', '✨', '💻', '🙌', '☕', '💯'];

  // Load message history
  const fetchMessages = async () => {
    try {
      const res = await axios.get(`/api/chat/messages/${otherUser.id}`);
      setMessages(res.data.messages);
      // Mark read
      if (socket) {
        socket.emit('chat:read', { senderId: otherUser.id });
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [otherUser.id]);

  // Handle incoming real-time messages
  useEffect(() => {
    if (!latestMessage) return;

    if (
      (latestMessage.sender_id === otherUser.id && latestMessage.receiver_id === user?.id) ||
      (latestMessage.sender_id === user?.id && latestMessage.receiver_id === otherUser.id)
    ) {
      setMessages(prev => {
        // avoid duplicates
        if (prev.some(m => m.id === latestMessage.id)) return prev;
        return [...prev, latestMessage];
      });

      if (latestMessage.sender_id === otherUser.id && socket) {
        socket.emit('chat:read', { senderId: otherUser.id });
      }
    }
  }, [latestMessage, otherUser.id, user?.id, socket]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Typing signal
    sendTyping(otherUser.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(otherUser.id, false);
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !user) return;

    socket.emit('chat:send_message', {
      receiverId: otherUser.id,
      content: inputText.trim(),
      type: 'text',
    });

    setInputText('');
    sendTyping(otherUser.id, false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await axios.post('/api/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const isImage = file.type.startsWith('image/');
      socket.emit('chat:send_message', {
        receiverId: otherUser.id,
        content: isImage ? 'Sent an image' : `Sent file: ${file.name}`,
        type: isImage ? 'image' : 'text',
        mediaUrl: res.data.url,
      });
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartCall = (callType: CallType) => {
    // Check if user has video call permission if on free tier
    if (callType === 'video' && user?.plan_id === 'free') {
      // Prompt upgrade or allow demo
    }
    startCall(otherUser, callType);
  };

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden shadow-xl">
      
      {/* Chat Header */}
      <div className="p-4 px-6 bg-dark-900/90 border-b border-dark-800 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3.5">
          <Avatar
            src={otherUser.avatar_url}
            name={otherUser.full_name}
            size="md"
            isOnline={isOnline}
            showOnlineStatus
            planId={otherUser.plan_id}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">{otherUser.full_name}</h2>
              <PlanBadge planId={otherUser.plan_id} size="sm" />
            </div>
            <p className="text-xs text-dark-400 flex items-center gap-1.5">
              {isPeerTyping ? (
                <span className="text-brand-400 font-medium animate-pulse">Typing...</span>
              ) : isOnline ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active Now
                </span>
              ) : (
                <span>@{otherUser.username} • {otherUser.country || 'Global'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons: Audio Call, Video Call, Profile info */}
        <div className="flex items-center gap-2">
          {/* Audio Call Button */}
          <button
            type="button"
            onClick={() => handleStartCall('audio')}
            className="p-2.5 rounded-xl bg-dark-800 hover:bg-emerald-500/20 text-dark-300 hover:text-emerald-400 border border-dark-700 hover:border-emerald-500/40 transition-all shadow-sm"
            title="Start HD Audio Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call Button */}
          <button
            type="button"
            onClick={() => handleStartCall('video')}
            className="p-2.5 rounded-xl bg-dark-800 hover:bg-brand-500/20 text-dark-300 hover:text-brand-400 border border-dark-700 hover:border-brand-500/40 transition-all shadow-sm"
            title="Start HD Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* View Profile */}
          {onViewProfile && (
            <button
              type="button"
              onClick={() => onViewProfile(otherUser)}
              className="p-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-700 transition-all"
              title="View Profile"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-gradient-to-b from-dark-950 via-dark-900/30 to-dark-950">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Avatar src={otherUser.avatar_url} name={otherUser.full_name} size="xl" planId={otherUser.plan_id} />
            <h3 className="text-lg font-bold text-white mt-4">{otherUser.full_name}</h3>
            <p className="text-xs text-dark-400 max-w-xs mt-1">{otherUser.bio || 'Say hello and start connecting!'}</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => handleStartCall('video')}
                className="px-4 py-2 rounded-xl bg-brand-600/20 border border-brand-500/40 text-brand-300 hover:bg-brand-600 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Video className="w-3.5 h-3.5" /> Start Video Call
              </button>
              <button
                onClick={() => handleStartCall('audio')}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Phone className="w-3.5 h-3.5" /> Start Audio Call
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-in fade-in duration-150`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 text-sm shadow-md transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-br-xs'
                      : 'bg-dark-900 border border-dark-800 text-dark-100 rounded-bl-xs'
                  }`}
                >
                  {/* Image Attachment */}
                  {msg.type === 'image' && msg.media_url && (
                    <div className="mb-2 rounded-xl overflow-hidden max-h-72 bg-dark-950">
                      <img
                        src={msg.media_url}
                        alt="attachment"
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all"
                        onClick={() => window.open(msg.media_url, '_blank')}
                      />
                    </div>
                  )}

                  {/* Message Content */}
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>

                  {/* Timestamp & status */}
                  <div
                    className={`flex items-center gap-1 text-[10px] mt-1.5 ${
                      isMe ? 'text-indigo-200 justify-end' : 'text-dark-400 justify-start'
                    }`}
                  >
                    <span>{formatTime(msg.created_at)}</span>
                    {isMe && (
                      msg.is_read ? (
                        <CheckCheck className="w-3 h-3 text-cyan-300" />
                      ) : (
                        <Check className="w-3 h-3 text-indigo-300" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs text-dark-400 italic animate-in fade-in">
            <Avatar src={otherUser.avatar_url} name={otherUser.full_name} size="xs" />
            <span>{otherUser.full_name} is typing...</span>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker Flyout */}
      {showEmojis && (
        <div className="p-2.5 bg-dark-900 border-t border-dark-800 flex items-center gap-2 overflow-x-auto">
          {emojis.map((em, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => { setInputText(prev => prev + em); setShowEmojis(false); }}
              className="text-lg p-1.5 rounded-lg hover:bg-dark-800 transition-all hover:scale-125"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Chat Composer Input */}
      <form onSubmit={handleSendMessage} className="p-3.5 bg-dark-900/90 border-t border-dark-800 backdrop-blur-md flex items-center gap-2.5 shrink-0">
        
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,video/*,audio/*,.pdf,.doc"
          className="hidden"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-400 hover:text-white border border-dark-700 transition-all"
          title="Upload image or file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojis(!showEmojis)}
          className={`p-2.5 rounded-xl border transition-all ${
            showEmojis ? 'bg-brand-600 text-white border-brand-500' : 'bg-dark-800 hover:bg-dark-700 text-dark-400 hover:text-white border-dark-700'
          }`}
          title="Insert Emoji"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={`Message ${otherUser.full_name}...`}
          className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || uploading}
          className="p-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-lg shadow-brand-500/25 flex items-center justify-center transition-all disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
