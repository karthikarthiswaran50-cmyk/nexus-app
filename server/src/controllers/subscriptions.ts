import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { SubscriptionPlan, SubscriptionPlanId, SubscriptionInvoice } from '../types.js';
import {
  createOrder,
  verifyPaymentSignature,
  activateSubscription,
  processRazorpayWebhook,
  RAZORPAY_KEY_ID,
} from '../services/razorpay.js';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Starter',
    tagline: 'Essential messaging and standard audio calling',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Real-time 1-on-1 Instant Messaging',
      'High-Definition Audio Calling (up to 15 mins/call)',
      'Basic Profile Customization',
      'Message & Media History (30 days)',
      'Community Public Directory',
    ],
    limits: {
      maxCallDurationMins: 15,
      hasVideoCalls: false,
      hasScreenShare: false,
      hasHdVideo: false,
      hasPriorityBadge: false,
      hasCustomThemes: false,
      hasRecordedNotes: false,
    },
  },
  {
    id: 'pro',
    name: 'Nexus Pro',
    tagline: 'High-definition video calling, screen sharing, & unlimited chat',
    priceMonthly: 99, // ₹99/month
    priceYearly: 999, // ₹999/year
    features: [
      'Unlimited 1-on-1 HD Video & Audio Calls',
      'Crystal-Clear Screen Sharing',
      'Pro Verified Profile Badge ✨',
      'Custom Profile Accent Themes',
      'Read Receipts & Advanced Privacy Controls',
      'Unlimited Cloud Message History',
      'High-Speed Media Uploads (up to 50MB)',
      'Instant UPI (Google Pay, PhonePe, Paytm) & Cards',
    ],
    limits: {
      maxCallDurationMins: 0, // unlimited
      hasVideoCalls: true,
      hasScreenShare: true,
      hasHdVideo: true,
      hasPriorityBadge: true,
      hasCustomThemes: true,
      hasRecordedNotes: false,
    },
  },
  {
    id: 'vip',
    name: 'Nexus Ultra VIP',
    tagline: 'The ultimate suite for creators, teams, and power communicators',
    priceMonthly: 199, // ₹199/month
    priceYearly: 1999, // ₹1,999/year
    features: [
      'Everything in Nexus Pro included',
      'Ultra VIP Gold Profile Badge 👑',
      '4K Ultra-HD WebRTC Video Bitrate Mode',
      'Interactive Live Call Notes & AI Summary',
      'Priority Connection Routing & 0-Latency Audio',
      'Custom Profile Video & Animated Avatars',
      'Dedicated 24/7 Concierge Support',
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

export async function getPlans(req: Request, res: Response): Promise<void> {
  res.json({
    plans: SUBSCRIPTION_PLANS,
    razorpayKeyId: RAZORPAY_KEY_ID,
    currency: 'INR',
  });
}

export async function getCurrentSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as any;
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === (sub?.plan_id || 'free')) || SUBSCRIPTION_PLANS[0];

    const invoices = (db.prepare(`
      SELECT * FROM subscription_invoices
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as unknown) as SubscriptionInvoice[];

    res.json({
      subscription: sub || {
        id: `sub_${userId}`,
        user_id: userId,
        plan_id: 'free',
        status: 'active',
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        billing_cycle: 'monthly',
      },
      plan,
      invoices,
    });
  } catch (error) {
    console.error('getCurrentSubscription error:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription info.' });
  }
}

// 1. Create Razorpay Order
export async function createRazorpayOrderHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { planId, billingCycle = 'monthly' } = req.body;

    if (!userId || !planId) {
      res.status(400).json({ error: 'Missing plan ID' });
      return;
    }

    const user = getUserWithPlan(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const orderData = await createOrder({
      userId,
      planId,
      billingCycle,
    });

    res.json({
      ...orderData,
      user: {
        name: user.full_name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('createRazorpayOrder error:', error);
    res.status(500).json({ error: error?.message || 'Failed to create payment order' });
  }
}

// 2. Verify Razorpay Payment Signature and Activate Tier
export async function verifyRazorpayPaymentHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { orderId, paymentId, signature, planId, billingCycle = 'monthly' } = req.body;

    if (!userId || !orderId || !paymentId) {
      res.status(400).json({ error: 'Missing payment details' });
      return;
    }

    const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
    if (!isValid) {
      res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
      return;
    }

    activateSubscription({
      userId,
      planId,
      billingCycle,
      paymentId,
      orderId,
    });

    const user = getUserWithPlan(userId);
    res.json({
      message: 'Payment verified and subscription activated successfully!',
      user,
    });
  } catch (error: any) {
    console.error('verifyRazorpayPayment error:', error);
    res.status(500).json({ error: error?.message || 'Payment verification failed' });
  }
}

// 3. Strict Subscription Upgrade Gate (Requires payment verification)
export async function subscribePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(403).json({
    error: 'Direct subscription upgrade is disabled. Please pay ₹99 for Pro or ₹199 for VIP via Razorpay.',
  });
}

// 4. Cancel Subscription
export async function cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    db.prepare(`
      UPDATE subscriptions
      SET plan_id = 'free', status = 'cancelled'
      WHERE user_id = ?
    `).run(userId);

    const user = getUserWithPlan(userId);
    res.json({ message: 'Subscription cancelled. Reverted to Starter tier.', user });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
}

// 5. Razorpay Webhook Endpoint
export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-razorpay-signature'] as string;
  try {
    await processRazorpayWebhook(req.body, signature);
    res.json({ received: true });
  } catch (err: any) {
    console.error('Razorpay webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
