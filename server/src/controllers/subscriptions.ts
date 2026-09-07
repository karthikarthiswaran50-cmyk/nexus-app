import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { SubscriptionPlan, SubscriptionInvoice } from '../types.js';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Nexus Royal Member',
    tagline: '100% Free Lifetime Access to all messaging, audio & HD video calling features',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Unlimited 1-on-1 HD Video & Audio Calls (100% Free)',
      'Real-time Instant Messaging & High-Speed Media Sharing',
      'Crystal-Clear Screen Sharing',
      'Community Public Directory & Stories',
      'Lifetime Free Access to all Royal features',
    ],
    limits: {
      maxCallDurationMins: 0, // unlimited
      hasVideoCalls: true,
      hasScreenShare: true,
      hasHdVideo: true,
      hasPriorityBadge: true,
      hasCustomThemes: true,
      hasRecordedNotes: true,
    },
  },
];

export async function getPlans(_req: Request, res: Response): Promise<void> {
  res.json({
    plans: SUBSCRIPTION_PLANS,
    razorpayKeyId: '',
    currency: 'INR',
    message: 'All features on Nexus Royal are 100% Free for all members.',
  });
}

export async function getCurrentSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const plan = SUBSCRIPTION_PLANS[0];

    res.json({
      subscription: {
        id: `sub_${userId}`,
        user_id: userId,
        plan_id: 'free',
        status: 'active',
        current_period_end: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
        billing_cycle: 'lifetime_free',
      },
      plan,
      invoices: [],
    });
  } catch (error) {
    console.error('getCurrentSubscription error:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription info.' });
  }
}

// Order Creation disabled - Everything is 100% Free
export async function createRazorpayOrderHttp(_req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({
    success: true,
    free: true,
    message: 'Nexus Royal is 100% Free for everyone. No payment required!',
  });
}

// Verification disabled - Everything is 100% Free
export async function verifyRazorpayPaymentHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const user = userId ? getUserWithPlan(userId) : null;
  res.json({
    message: 'Nexus Royal is 100% Free for everyone. No payment required!',
    user,
  });
}

export async function subscribePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const user = userId ? getUserWithPlan(userId) : null;
  res.json({
    message: 'All features are already 100% free and active for your account.',
    user,
  });
}

export async function cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const user = userId ? getUserWithPlan(userId) : null;
  res.json({ message: 'Nexus Royal is permanently free.', user });
}

export async function razorpayWebhook(_req: Request, res: Response): Promise<void> {
  res.json({ received: true, message: 'Payments disabled. All features free.' });
}
