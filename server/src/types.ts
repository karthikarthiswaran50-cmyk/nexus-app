export type UserRole = 'user' | 'admin';

export type SubscriptionPlanId = 'free' | 'pro' | 'vip';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash?: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  status: string;
  country: string;
  role?: UserRole;
  is_banned?: number | boolean;
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithPlan extends User {
  plan_id: SubscriptionPlanId;
  subscription_status: SubscriptionStatus;
  subscription_expires_at?: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  allow_calls_from: 'everyone' | 'contacts' | 'subscribers';
  notification_sound: boolean;
  read_receipts: boolean;
  auto_accept_calls: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: SubscriptionPlanId;
  status: SubscriptionStatus;
  current_period_end: string;
  billing_cycle: 'monthly' | 'yearly';
  created_at: string;
}

export interface SubscriptionInvoice {
  id: string;
  user_id: string;
  plan_id: SubscriptionPlanId;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  invoice_number: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
  other_user?: UserWithPlan;
  last_message?: Message;
  unread_count?: number;
}

export type MessageType = 'text' | 'image' | 'audio' | 'system' | 'call_log';

export interface MessageReaction {
  [emoji: string]: string[]; // emoji -> array of userIds
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: MessageType;
  media_url?: string;
  is_read: boolean;
  reactions?: MessageReaction;
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_sender?: string;
  is_deleted_for_all?: boolean;
  deleted_for_users?: string[];
  created_at: string;
  sender?: UserWithPlan;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'initiated' | 'ringing' | 'connected' | 'completed' | 'missed' | 'rejected' | 'busy' | 'failed';

export interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  duration: number; // in seconds
  started_at: string;
  ended_at?: string;
  caller?: UserWithPlan;
  receiver?: UserWithPlan;
}

export interface AuthPayload {
  userId: string;
  email: string;
  username: string;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: {
    maxCallDurationMins: number; // 0 for unlimited
    hasVideoCalls: boolean;
    hasScreenShare: boolean;
    hasHdVideo: boolean;
    hasPriorityBadge: boolean;
    hasCustomThemes: boolean;
    hasRecordedNotes: boolean;
  };
}
