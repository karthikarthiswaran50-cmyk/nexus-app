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
  Sparkles,
  X,
  Mic,
  Trash2,
  ArrowLeft,
  Reply,
  MoreVertical,
  CornerDownRight,
  Copy,
} from 'lucide-react';
import axios from 'axios';
import { trackUserActivity } from '../../config/firebase';
import { VoicePlayer } from './VoicePlayer';
import { MediaViewerModal } from './MediaViewerModal';

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Quoted Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Reaction popover & action menu state
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Fullscreen Media Viewer state
  const [viewingMediaUrl, setViewingMediaUrl] = useState<string | null>(null);
  const [viewingMediaSender, setViewingMediaSender] = useState<string | undefined>(undefined);

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
    setReplyingTo(null);
    fetchMessages();
  }, [otherUser.id]);

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
      const mediaRecorder = new MediaRecorder(stream);
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
      alert('Microphone permission is required to record and send voice messages.');
    }
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !socket || !user) return;

    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size < 100) return;

      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
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
    if (callType === 'video' && user?.plan_id === 'free') {
      setShowUpgradeModal(true);
      return;
    }
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
    navigator.clipboard.writeText(content);
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

        {/* Action Buttons: Audio Call, Video Call, Profile info */}
        <div className="flex items-center gap-2">
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

      {/* 👑 Messages Thread Container */}
      <div 
        className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 royal-watermark bg-dark-950"
        onClick={() => setActiveMenuMessageId(null)}
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
                    className={`relative flex-1 rounded-2xl p-3.5 text-sm shadow-xl transition-all ${
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

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-sm bg-dark-900 border border-dark-700 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-dark-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-brand-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/20">
              <Sparkles className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-1">Unlock HD Video Calling</h3>
              <p className="text-xs text-dark-300 leading-relaxed">
                Video calling and screen sharing are locked on the Free tier. Upgrade to <span className="text-emerald-400 font-bold">Nexus Pro for just ₹99/month</span> to start unlimited HD calls.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-dark-800/80 border border-dark-700/80 text-left space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Unlimited 1-on-1 HD Video & Audio Calls</span>
              </div>
              <div className="flex items-center gap-2 text-dark-300">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-brand-400" />
                <span>Crystal-Clear Screen Sharing & Pro Badge</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowUpgradeModal(false);
                  if (onNavigateToSubscription) onNavigateToSubscription();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all"
              >
                Upgrade to Pro (₹99/Month)
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-2 text-xs text-dark-400 hover:text-white transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
