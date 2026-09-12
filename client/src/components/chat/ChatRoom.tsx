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
  Info,
  X,
  Mic,
  Trash2,
  ArrowLeft,
  Reply,
  MoreVertical,
  CornerDownRight,
  Copy,
  Palette,
  Search,
  Pin,
  PinOff,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react';
import axios from 'axios';
import { trackUserActivity } from '../../config/firebase';
import { VoicePlayer } from './VoicePlayer';
import { MediaViewerModal } from './MediaViewerModal';
import { ChatMediaGalleryModal } from './ChatMediaGalleryModal';

interface ChatRoomProps {
  otherUser: User;
  onBack?: () => void;
  onViewProfile?: (user: User) => void;
  onNavigateToSubscription?: () => void;
}

const QUICK_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🙏', '🎉'];

export const ChatRoom: React.FC<ChatRoomProps> = ({ otherUser, onBack, onViewProfile, onNavigateToSubscription }) => {
  const { user } = useAuth();
  const {
    socket,
    onlineUserIds,
    reachableUserIds,
    lastSeenMap,
    startCall,
    latestMessage,
    reactionUpdate,
    deletedMessage,
    sendReaction,
    deleteMessage: socketDeleteMessage,
    typingMap,
    sendTyping,
  } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  // Quoted Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Reaction popover & action menu state
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Chat Wallpaper state
  const [chatWallpaper, setChatWallpaper] = useState<string>(() => {
    return localStorage.getItem(`nexus_wallpaper_${otherUser.id}`) || 'default';
  });
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);

  // Fullscreen Media Viewer state
  const [viewingMediaUrl, setViewingMediaUrl] = useState<string | null>(null);
  const [viewingMediaSender, setViewingMediaSender] = useState<string | undefined>(undefined);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3500); };

  // In-Chat Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // Shared Media Gallery state
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  // Pinned Message state
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(() => {
    try {
      const saved = localStorage.getItem(`nexus_pinned_${otherUser.id}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleTogglePin = (msg: Message) => {
    if (pinnedMessage?.id === msg.id) {
      setPinnedMessage(null);
      localStorage.removeItem(`nexus_pinned_${otherUser.id}`);
      showToast('Message unpinned');
    } else {
      setPinnedMessage(msg);
      localStorage.setItem(`nexus_pinned_${otherUser.id}`, JSON.stringify(msg));
      showToast('Message pinned to chat top');
    }
    setActiveMenuMessageId(null);
  };

  // Search matching logic
  const matchingMessageIds = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages
      .filter((m) => !m.is_deleted_for_all && m.content && m.content.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2500);
    }
  };

  const handleNextMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % matchingMessageIds.length;
    setActiveMatchIndex(nextIdx);
    scrollToMessage(matchingMessageIds[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + matchingMessageIds.length) % matchingMessageIds.length;
    setActiveMatchIndex(prevIdx);
    scrollToMessage(matchingMessageIds[prevIdx]);
  };

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup on unmount: stop any active recording, release mic, clear typing timeout
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  const isOnline = onlineUserIds.has(otherUser.id);
  const isReachable = reachableUserIds.has(otherUser.id);
  const isPeerTyping = !!typingMap[otherUser.id];
  const userLastSeen = lastSeenMap[otherUser.id] || otherUser.last_seen;

  const emojis = ['😀', '🔥', '👍', '❤️', '🚀', '🎉', '👋', '✨', '💻', '🙌', '☕', '💯'];

  // Format last seen into human readable string
  const formatLastSeen = (isoString?: string) => {
    if (!isoString) return `@${otherUser.username}`;
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Last seen just now';
      if (diffMins < 60) return `Last seen ${diffMins}m ago`;
      if (diffHours < 24 && date.getDate() === now.getDate()) {
        return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return `Last seen on ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } catch {
      return `@${otherUser.username}`;
    }
  };

  // Load message history
  const fetchMessages = async () => {
    try {
      const res = await axios.get(`/api/chat/messages/${otherUser.id}`);
      setMessages(res.data.messages);
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
    setMessages([]); // Clear messages immediately to prevent stale flash when switching chats
    setReplyingTo(null);
    fetchMessages();
  }, [otherUser.id]);

  // Re-send read receipt if socket reconnects mid-conversation
  useEffect(() => {
    if (socket && !loading) {
      socket.emit('chat:read', { senderId: otherUser.id });
    }
  }, [socket, otherUser.id]);

  // Real-time new message
  useEffect(() => {
    if (!latestMessage) return;

    if (
      (latestMessage.sender_id === otherUser.id && latestMessage.receiver_id === user?.id) ||
      (latestMessage.sender_id === user?.id && latestMessage.receiver_id === otherUser.id)
    ) {
      setMessages(prev => {
        if (prev.some(m => m.id === latestMessage.id)) return prev;
        return [...prev, latestMessage];
      });

      if (latestMessage.sender_id === otherUser.id && socket) {
        socket.emit('chat:read', { senderId: otherUser.id });
      }
    }
  }, [latestMessage, otherUser.id, user?.id, socket]);

  // Real-time reaction update
  useEffect(() => {
    if (!reactionUpdate) return;
    setMessages(prev =>
      prev.map(m => (m.id === reactionUpdate.messageId ? { ...m, reactions: reactionUpdate.reactions } : m))
    );
  }, [reactionUpdate]);

  // Real-time message deletion
  useEffect(() => {
    if (!deletedMessage) return;
    setMessages(prev => {
      if (deletedMessage.isDeletedForAll) {
        return prev.map(m =>
          m.id === deletedMessage.messageId
            ? { ...m, content: '🚫 This message was deleted', type: 'system', media_url: undefined, is_deleted_for_all: true }
            : m
        );
      } else {
        if (deletedMessage.deletedForUsers?.includes(user?.id || '')) {
          return prev.filter(m => m.id !== deletedMessage.messageId);
        }
        return prev;
      }
    });
  }, [deletedMessage, user?.id]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
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
      replyToId: replyingTo?.id,
      replyToContent: replyingTo ? (replyingTo.type === 'audio' ? '🎤 Voice note' : replyingTo.type === 'image' ? '📷 Photo' : replyingTo.content) : undefined,
      replyToSender: replyingTo ? (replyingTo.sender_id === user.id ? 'You' : otherUser.full_name) : undefined,
    });

    trackUserActivity({
      userId: user.id,
      username: user.username,
      action: 'chat_sent',
      details: {
        type: 'text',
        recipientId: otherUser.id,
        recipientUsername: otherUser.username,
      },
    });

    setInputText('');
    setReplyingTo(null);
    sendTyping(otherUser.id, false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !user) return;

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
        replyToId: replyingTo?.id,
        replyToContent: replyingTo ? replyingTo.content : undefined,
        replyToSender: replyingTo ? (replyingTo.sender_id === user.id ? 'You' : otherUser.full_name) : undefined,
      });

      setReplyingTo(null);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mimeType = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const options = mimeType ? { mimeType } : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      showToast('Microphone permission is required to record voice messages.');
    }
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !socket || !user) return;

    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);

    const activeRecorder = mediaRecorderRef.current;

    activeRecorder.onstop = async () => {
      const selectedMime = activeRecorder.mimeType || 'audio/webm';
      const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: selectedMime });
      if (audioBlob.size < 100) return;

      const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: selectedMime });
      const formData = new FormData();
      formData.append('file', audioFile);

      setUploading(true);
      try {
        const res = await axios.post('/api/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        socket.emit('chat:send_message', {
          receiverId: otherUser.id,
          content: '🎤 Voice message',
          type: 'audio',
          mediaUrl: res.data.url,
          replyToId: replyingTo?.id,
          replyToContent: replyingTo ? replyingTo.content : undefined,
          replyToSender: replyingTo ? (replyingTo.sender_id === user.id ? 'You' : otherUser.full_name) : undefined,
        });

        setReplyingTo(null);
      } catch (err) {
        console.error('Voice upload failed:', err);
      } finally {
        setUploading(false);
      }

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
  };

  const handleStartCall = (callType: CallType) => {
    startCall(otherUser, callType);
  };

  const handleReact = (messageId: string, emoji: string) => {
    sendReaction(messageId, emoji, otherUser.id);
    setActiveMenuMessageId(null);
  };

  const handleDelete = (messageId: string, deleteType: 'for_everyone' | 'for_me') => {
    socketDeleteMessage(messageId, deleteType, otherUser.id);
    setActiveMenuMessageId(null);
  };

  const handleStartReply = (msg: Message) => {
    setReplyingTo(msg);
    setActiveMenuMessageId(null);
    inputRef.current?.focus();
  };

  const handleCopyText = (content: string) => {
    const copyText = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content)
          .then(() => showToast('Message copied!'))
          .catch(() => {
            // Fallback for mobile Safari / old browsers
            const el = document.createElement('textarea');
            el.value = content;
            el.style.position = 'fixed';
            el.style.top = '-9999px';
            document.body.appendChild(el);
            el.focus();
            el.select();
            try {
              document.execCommand('copy');
              showToast('Message copied!');
            } catch {
              showToast('Copy not supported on this browser');
            }
            document.body.removeChild(el);
          });
      } else {
        // Legacy fallback
        const el = document.createElement('textarea');
        el.value = content;
        el.style.position = 'fixed';
        el.style.top = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        try {
          document.execCommand('copy');
          showToast('Message copied!');
        } catch {
          showToast('Copy not supported on this browser');
        }
        document.body.removeChild(el);
      }
    };
    copyText();
    setActiveMenuMessageId(null);
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
    <div className="h-full flex flex-col bg-dark-950 border-0 sm:border border-dark-800 rounded-none sm:rounded-2xl overflow-hidden shadow-xl font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-xl bg-dark-900/95 border border-gold-500/30 text-amber-200 text-xs font-semibold shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {/* 👑 Chat Header */}
      <div className="p-3 sm:p-4 px-4 sm:px-6 bg-dark-900/90 border-b border-dark-800 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden p-2 -ml-1.5 rounded-xl text-dark-300 hover:text-white hover:bg-dark-800 transition-all active:scale-95"
              title="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5 text-brand-400" />
            </button>
          )}
          <Avatar
            src={otherUser.avatar_url}
            name={otherUser.full_name}
            size="md"
            isOnline={isOnline}
            isReachable={isReachable}
            showOnlineStatus
            planId={otherUser.plan_id}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[140px] sm:max-w-[220px]">{otherUser.full_name}</h2>
              <PlanBadge planId={otherUser.plan_id} size="sm" />
            </div>
            <p className="text-xs text-dark-400 flex items-center gap-1.5">
              {isPeerTyping ? (
                <span className="text-brand-400 font-medium animate-pulse">Typing...</span>
              ) : isOnline ? (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Now
                </span>
              ) : isReachable ? (
                <span className="text-amber-300 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Available on Mobile
                </span>
              ) : (
                <span className="text-dark-400">{formatLastSeen(userLastSeen)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons: Search, Gallery, Audio Call, Video Call, Wallpaper, Profile info */}
        <div className="flex items-center gap-2 relative">
          {/* In-Chat Search Button */}
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery('');
            }}
            className={`p-2.5 rounded-xl border transition-all shadow-sm ${
              isSearchOpen
                ? 'bg-amber-500/20 text-amber-300 border-gold-500/40'
                : 'bg-dark-800 hover:bg-gold-500/20 text-dark-300 hover:text-amber-300 border-dark-700 hover:border-gold-500/40'
            }`}
            title="Search Messages"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Shared Media Gallery Button */}
          <button
            type="button"
            onClick={() => setShowMediaGallery(true)}
            className="p-2.5 rounded-xl bg-dark-800 hover:bg-gold-500/20 text-dark-300 hover:text-amber-300 border border-dark-700 hover:border-gold-500/40 transition-all shadow-sm"
            title="Shared Media & Files"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
            className="p-2.5 rounded-xl bg-dark-800 hover:bg-gold-500/20 text-dark-300 hover:text-amber-300 border border-dark-700 hover:border-gold-500/40 transition-all shadow-sm"
            title="Chat Theme Wallpaper"
          >
            <Palette className="w-4 h-4" />
          </button>

          {showWallpaperMenu && (
            <div className="absolute right-0 top-12 z-50 w-52 p-3 bg-dark-900 border border-gold-500/30 rounded-2xl shadow-2xl space-y-2 backdrop-blur-xl">
              <span className="text-[11px] font-bold text-amber-300">Choose Chat Wallpaper</span>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[
                  { id: 'default', color: '#090d16' },
                  { id: 'royal_gold', color: 'linear-gradient(135deg, #181206 0%, #0c0a09 100%)' },
                  { id: 'midnight_blue', color: 'linear-gradient(135deg, #0b1528 0%, #030712 100%)' },
                  { id: 'emerald_velvet', color: 'linear-gradient(135deg, #062419 0%, #02120b 100%)' },
                  { id: 'crimson_ruby', color: 'linear-gradient(135deg, #280a0a 0%, #090202 100%)' },
                  { id: 'purple_galaxy', color: 'linear-gradient(135deg, #1f0d3d 0%, #080214 100%)' },
                  { id: 'cyber_neon', color: 'linear-gradient(135deg, #022026 0%, #050a12 100%)' },
                ].map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => {
                      setChatWallpaper(wp.id);
                      localStorage.setItem(`nexus_wallpaper_${otherUser.id}`, wp.id);
                      setShowWallpaperMenu(false);
                    }}
                    style={{ background: wp.color }}
                    className={`w-8 h-8 rounded-xl border-2 transition-transform hover:scale-110 ${
                      chatWallpaper === wp.id ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleStartCall('audio')}
            className="p-2.5 rounded-xl bg-dark-800 hover:bg-emerald-500/20 text-dark-300 hover:text-emerald-400 border border-dark-700 hover:border-emerald-500/40 transition-all shadow-sm"
            title="Start HD Audio Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleStartCall('video')}
            className="p-2.5 rounded-xl bg-dark-800 hover:bg-brand-500/20 text-dark-300 hover:text-brand-400 border border-dark-700 hover:border-brand-500/40 transition-all shadow-sm"
            title="Start HD Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

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

      {/* 🔍 In-Chat Search Toolbar */}
      {isSearchOpen && (
        <div className="p-2.5 px-4 bg-dark-900 border-b border-gold-500/20 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200 z-10">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-gold-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveMatchIndex(0);
              }}
              placeholder="Search in conversation..."
              className="w-full bg-dark-850 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-dark-400">
              {searchQuery.trim() ? (
                matchingMessageIds.length > 0 ? (
                  <span className="text-amber-300 font-bold">
                    {activeMatchIndex + 1} of {matchingMessageIds.length}
                  </span>
                ) : (
                  <span className="text-dark-500">No matches</span>
                )
              ) : null}
            </span>

            {matchingMessageIds.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMatch}
                  className="p-1 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white"
                  title="Previous match"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMatch}
                  className="p-1 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white"
                  title="Next match"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 📌 Pinned Message Bar */}
      {pinnedMessage && (
        <div
          onClick={() => scrollToMessage(pinnedMessage.id)}
          className="p-2.5 px-4 bg-dark-900/95 border-b border-gold-500/25 flex items-center justify-between gap-3 cursor-pointer hover:bg-dark-850 transition-colors backdrop-blur-md z-10"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400/20" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Pinned Message</span>
              <p className="text-xs text-dark-200 truncate">
                {pinnedMessage.type === 'audio'
                  ? '🎤 Voice Message'
                  : pinnedMessage.type === 'image'
                  ? '📷 Photo'
                  : pinnedMessage.content}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePin(pinnedMessage);
            }}
            className="p-1 rounded-lg text-dark-400 hover:text-rose-400 hover:bg-dark-800 transition-colors"
            title="Unpin message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 👑 Messages Thread Container with Custom Wallpaper */}
      <div 
        className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 royal-watermark transition-all duration-300"
        style={{
          background:
            chatWallpaper === 'royal_gold'
              ? 'linear-gradient(135deg, #161006 0%, #0c0a09 100%)'
              : chatWallpaper === 'midnight_blue'
              ? 'linear-gradient(135deg, #091325 0%, #030712 100%)'
              : chatWallpaper === 'emerald_velvet'
              ? 'linear-gradient(135deg, #051f15 0%, #02120b 100%)'
              : chatWallpaper === 'crimson_ruby'
              ? 'linear-gradient(135deg, #220909 0%, #090202 100%)'
              : chatWallpaper === 'purple_galaxy'
              ? 'linear-gradient(135deg, #1b0c36 0%, #080214 100%)'
              : chatWallpaper === 'cyber_neon'
              ? 'linear-gradient(135deg, #021a1f 0%, #050a12 100%)'
              : '#080c14',
        }}
        onClick={() => { setActiveMenuMessageId(null); setShowWallpaperMenu(false); }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Avatar src={otherUser.avatar_url} name={otherUser.full_name} size="xl" planId={otherUser.plan_id} />
            <h3 className="text-lg font-extrabold text-white mt-4">{otherUser.full_name}</h3>
            <p className="text-xs text-dark-400 max-w-xs mt-1">{otherUser.bio || 'Say hello and start a Royal conversation!'}</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => handleStartCall('video')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-gold-400/40 text-amber-300 hover:bg-gold-500 hover:text-dark-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-gold-500/10"
              >
                <Video className="w-3.5 h-3.5" /> Start Royal Video Call
              </button>
              <button
                onClick={() => handleStartCall('audio')}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/10"
              >
                <Phone className="w-3.5 h-3.5" /> Start Audio Call
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const isDeleted = msg.is_deleted_for_all;
            const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
            const isMenuOpen = activeMenuMessageId === msg.id;

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group animate-in fade-in duration-150`}
              >
                {/* Horizontal message row: Action toolbar sits directly next to the bubble */}
                <div className={`relative flex items-center gap-2 max-w-[90%] sm:max-w-[75%] ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                  
                  {/* Floating Action Menu Button (Always right beside the bubble) */}
                  {!isDeleted && (
                    <div
                      className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-20`}
                    >
                      {/* Quick Reaction Pill */}
                      <div className="flex items-center bg-dark-900 border border-gold-500/30 rounded-full px-1.5 py-0.5 shadow-lg shadow-black/60 backdrop-blur-md">
                        {QUICK_REACTION_EMOJIS.slice(0, 4).map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReact(msg.id, em);
                            }}
                            className="hover:scale-135 transition-transform p-1 text-xs"
                            title={`React with ${em}`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>

                      {/* 3-dot dropdown trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                        }}
                        className="p-1.5 rounded-full bg-dark-900 hover:bg-dark-800 text-dark-300 hover:text-white border border-dark-700 shadow-md transition-all"
                        title="More message actions"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Dropdown Menu Modal */}
                  {isMenuOpen && !isDeleted && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute top-10 ${isMe ? 'right-0' : 'left-0'} z-30 w-44 bg-dark-900 border border-gold-500/30 rounded-2xl shadow-2xl p-1.5 backdrop-blur-2xl animate-in zoom-in-95 duration-150 space-y-1`}
                    >
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5">
                        {QUICK_REACTION_EMOJIS.map((em) => (
                          <button
                            key={em}
                            onClick={() => handleReact(msg.id, em)}
                            className="hover:scale-130 transition-transform text-sm"
                          >
                            {em}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => handleStartReply(msg)}
                        className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-dark-200 hover:text-white hover:bg-dark-800 flex items-center gap-2 transition-all"
                      >
                        <Reply className="w-3.5 h-3.5 text-brand-400" />
                        <span>Reply</span>
                      </button>

                      {msg.type === 'text' && (
                        <button
                          onClick={() => handleCopyText(msg.content)}
                          className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-dark-200 hover:text-white hover:bg-dark-800 flex items-center gap-2 transition-all"
                        >
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Copy Message</span>
                        </button>
                      )}

                      {/* Pin / Unpin Message */}
                      <button
                        onClick={() => handleTogglePin(msg)}
                        className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-dark-200 hover:text-white hover:bg-dark-800 flex items-center gap-2 transition-all"
                      >
                        {pinnedMessage?.id === msg.id ? (
                          <>
                            <PinOff className="w-3.5 h-3.5 text-amber-400" />
                            <span>Unpin Message</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-3.5 h-3.5 text-amber-400" />
                            <span>Pin Message</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(msg.id, 'for_me')}
                        className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete for Me</span>
                      </button>

                      {isMe && (
                        <button
                          onClick={() => handleDelete(msg.id, 'for_everyone')}
                          className="w-full px-2.5 py-2 rounded-xl text-left text-xs text-rose-500 font-semibold hover:bg-rose-500/15 flex items-center gap-2 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete for Everyone</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    id={`msg-${msg.id}`}
                    className={`relative flex-1 rounded-2xl p-3.5 text-sm shadow-xl transition-all ${
                      matchingMessageIds.includes(msg.id)
                        ? 'ring-2 ring-amber-400 shadow-amber-500/30'
                        : ''
                    } ${
                      isDeleted
                        ? 'bg-dark-900/60 text-dark-500 italic border border-white/5 rounded-2xl'
                        : isMe
                        ? 'bg-gradient-to-r from-indigo-700 via-indigo-600 to-brand-600 text-white rounded-br-xs border border-indigo-400/30 shadow-indigo-950/60'
                        : 'royal-card bg-dark-900/90 text-dark-100 rounded-bl-xs border border-gold-500/20'
                    }`}
                  >
                    {/* Quoted Reply Preview */}
                    {msg.reply_to_content && !isDeleted && (
                      <div
                        className={`mb-2.5 p-2 rounded-xl text-xs border-l-3 border-amber-400 ${
                          isMe ? 'bg-indigo-950/60 text-indigo-100' : 'bg-dark-800/80 text-dark-300'
                        }`}
                      >
                        <div className="font-bold text-amber-300 flex items-center gap-1 text-[11px]">
                          <CornerDownRight className="w-3 h-3" />
                          <span>{msg.reply_to_sender || 'Replied Message'}</span>
                        </div>
                        <p className="truncate line-clamp-1 mt-0.5 opacity-90">{msg.reply_to_content}</p>
                      </div>
                    )}

                    {/* Voice Note Player or Image Attachment */}
                    {msg.type === 'audio' && msg.media_url && !isDeleted ? (
                      <VoicePlayer audioUrl={msg.media_url} isMe={isMe} />
                    ) : msg.type === 'image' && msg.media_url && !isDeleted ? (
                      <div className="mb-2 rounded-xl overflow-hidden max-h-72 bg-dark-950 border border-white/10 group/img relative cursor-pointer">
                        <img
                          src={msg.media_url}
                          alt="attachment"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                          onClick={() => {
                            setViewingMediaUrl(msg.media_url!);
                            setViewingMediaSender(isMe ? 'You' : otherUser.full_name);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-bold backdrop-blur-xs">
                          Click to Zoom & Download
                        </div>
                      </div>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                    )}

                    {/* Timestamp & status */}
                    <div
                      className={`flex items-center gap-1 text-[10px] mt-1.5 ${
                        isMe ? 'text-indigo-200 justify-end' : 'text-dark-400 justify-start'
                      }`}
                    >
                      <span>{formatTime(msg.created_at)}</span>
                      {isMe && !isDeleted && (
                        msg.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-indigo-200 stroke-[2]" />
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Emoji Reactions Badges (Sticks neatly to the bottom edge of bubble) */}
                {hasReactions && !isDeleted && (
                  <div
                    className={`flex items-center gap-1 -mt-2.5 z-10 ${
                      isMe ? 'mr-3 justify-end' : 'ml-3 justify-start'
                    }`}
                  >
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dark-900 border border-gold-500/30 text-xs shadow-md backdrop-blur-md">
                      {Object.entries(msg.reactions!).map(([em, usersList]) => {
                        const hasReacted = usersList.includes(user?.id || '');
                        return (
                          <button
                            key={em}
                            onClick={() => handleReact(msg.id, em)}
                            className={`flex items-center gap-0.5 hover:scale-115 transition-transform ${
                              hasReacted ? 'bg-amber-500/20 px-1 rounded-md' : ''
                            }`}
                            title={`Reacted by ${usersList.length} user(s)`}
                          >
                            <span>{em}</span>
                            {usersList.length > 1 && (
                              <span className="text-[10px] font-bold text-amber-300">{usersList.length}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

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
              onClick={() => {
                setInputText((prev) => prev + em);
                setShowEmojis(false);
                inputRef.current?.focus();
              }}
              className="text-lg p-1.5 rounded-lg hover:bg-dark-800 transition-all hover:scale-125"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Quoted Message Preview Bar */}
      {replyingTo && (
        <div className="p-2.5 px-4 bg-dark-900 border-t border-gold-500/20 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 min-w-0 border-l-2 border-gold-400 pl-3">
            <Reply className="w-4 h-4 text-gold-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-amber-300">
                Replying to {replyingTo.sender_id === user?.id ? 'Yourself' : otherUser.full_name}
              </span>
              <p className="truncate text-dark-400 text-[11px]">
                {replyingTo.type === 'audio'
                  ? '🎤 Voice note'
                  : replyingTo.type === 'image'
                  ? '📷 Photo'
                  : replyingTo.content}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-dark-400 hover:text-white hover:bg-dark-800"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Audio Recording Bar or Composer Input */}
      {isRecording ? (
        <div className="p-3.5 bg-dark-900/95 border-t border-dark-800 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="text-xs font-mono font-bold text-rose-400">
              {Math.floor(recordingDuration / 60)}:{recordingDuration % 60 < 10 ? '0' : ''}{recordingDuration % 60}
            </span>
            <span className="text-xs text-dark-400 hidden sm:inline font-medium">Recording voice note...</span>
          </div>

          <div className="flex items-center gap-1 h-5">
            {[40, 80, 100, 60, 90, 50, 75, 100, 60, 45, 85, 30].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} className="w-1 bg-rose-500/80 rounded-full animate-pulse" />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2.5 rounded-xl bg-dark-800 hover:bg-rose-500/20 text-dark-400 hover:text-rose-400 border border-dark-700 transition-all active:scale-95"
              title="Discard recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              disabled={uploading}
              className="p-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="p-3.5 bg-dark-900/95 border-t border-gold-500/15 backdrop-blur-2xl flex items-center gap-2.5 shrink-0 shadow-2xl">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*,audio/*,.pdf,.doc"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-dark-400 hover:text-amber-200 border border-gold-500/15 transition-all shadow-xs"
            title="Upload image or file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowEmojis(!showEmojis)}
            className={`p-2.5 rounded-xl border transition-all ${
              showEmojis
                ? 'bg-gold-500 text-dark-950 border-gold-400 font-bold shadow-md shadow-gold-500/20'
                : 'bg-dark-850 hover:bg-dark-800 text-dark-400 hover:text-amber-200 border-gold-500/15'
            }`}
            title="Insert Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          <input
            type="text"
            ref={inputRef}
            value={inputText}
            onChange={handleInputChange}
            placeholder={`Message ${otherUser.full_name}...`}
            className="flex-1 bg-dark-850 border border-gold-500/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400/80 focus:ring-1 focus:ring-gold-400/50 transition-all shadow-inner"
          />

          {inputText.trim() ? (
            <button
              type="submit"
              disabled={uploading}
              className="p-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black shadow-lg shadow-gold-500/25 flex items-center justify-center transition-all active:scale-95"
            >
              <Send className="w-4 h-4 text-dark-950 stroke-[2.5]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={uploading}
              className="p-2.5 px-3.5 rounded-xl bg-dark-850 hover:bg-gradient-to-tr hover:from-amber-500 hover:to-yellow-400 text-gold-400 hover:text-dark-950 border border-gold-500/20 hover:border-gold-400 shadow-md flex items-center justify-center transition-all active:scale-95 group"
              title="Record Voice Message"
            >
              <Mic className="w-4 h-4 group-hover:scale-110 transition-all" />
            </button>
          )}
        </form>
      )}

      {/* Fullscreen HD Media Viewer Modal */}
      {viewingMediaUrl && (
        <MediaViewerModal
          mediaUrl={viewingMediaUrl}
          senderName={viewingMediaSender}
          onClose={() => setViewingMediaUrl(null)}
        />
      )}

      {/* Shared Media & Files Gallery Modal */}
      <ChatMediaGalleryModal
        isOpen={showMediaGallery}
        onClose={() => setShowMediaGallery(false)}
        messages={messages}
        otherUser={otherUser}
        onSelectMedia={(url, senderName) => {
          setShowMediaGallery(false);
          setViewingMediaUrl(url);
          setViewingMediaSender(senderName);
        }}
      />
    </div>
  );
};
