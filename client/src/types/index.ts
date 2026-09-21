export type SubscriptionPlanId = 'free';
export type SubscriptionStatus = 'active';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  status: string;
  country: string;
  last_seen?: string;
  created_at: string;
  updated_at: string;
  plan_id?: SubscriptionPlanId;
  subscription_status?: SubscriptionStatus;
  role?: 'user' | 'admin';
  is_banned?: boolean | number;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  allow_calls_from: 'everyone' | 'contacts' | 'nobody';
  notification_sound: boolean;
  read_receipts: boolean;
  auto_accept_calls: boolean;
  who_can_call_me?: 'everyone' | 'contacts' | 'nobody';
  who_can_see_last_seen?: 'everyone' | 'nobody';
  who_can_see_online_status?: 'everyone' | 'nobody';
  who_can_see_profile_photo?: 'everyone' | 'nobody';
}

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'system' | 'call_log';

export interface MessageReaction {
  [emoji: string]: string[]; // emoji -> array of userIds
}

export interface Message {
  id: string;
  conversation_id?: string;
  group_id?: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  type: MessageType;
  media_url?: string;
  file_name?: string;
  file_size?: number;
  is_read: boolean;
  reactions?: MessageReaction;
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_sender?: string;
  edited_at?: string;
  is_deleted_for_all?: boolean;
  deleted_for_users?: string[];
  created_at: string;
  sender?: User;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  members_count?: number;
  members?: GroupMember[];
  last_message?: Message;
  last_message_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: User;
}

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at?: string;
  reporter?: User;
  reported_user?: User;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
  blocked_user?: User;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
  other_user?: User;
  last_message?: Message;
  unread_count?: number;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'initiated' | 'ringing' | 'connected' | 'completed' | 'missed' | 'rejected' | 'busy' | 'failed';

export interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  duration: number;
  started_at: string;
  ended_at?: string;
  caller?: User;
  receiver?: User;
}

export type ActiveCallRole = 'caller' | 'receiver';

export interface ActiveCallSession {
  peerUser: User;
  callType: CallType;
  role: ActiveCallRole;
  isIncoming?: boolean;
  sdpOffer?: any;
}

export interface StoryItem {
  id: string;
  user_id: string;
  media_url?: string;
  content: string;
  background_color: string;
  created_at: string;
  expires_at: string;
  views_count: number;
  has_viewed: boolean;
}

export interface UserStoryGroup {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  all_viewed: boolean;
  stories: StoryItem[];
}

