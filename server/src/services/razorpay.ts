import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { SUBSCRIPTION_PLANS } from '../controllers/subscriptions.js';
import { SubscriptionPlanId } from '../types.js';

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// Initialize Razorpay SDK if valid credentials provided
export const razorpay =
  RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_ID.includes('replace_with')
    ? new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
      })
    : null;

export async function createOrder(params: {
  userId: string;
  planId: SubscriptionPlanId;
  billingCycle: 'monthly' | 'yearly';
}): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  planName: string;
  isMock: boolean;
}> {
  const { userId, planId, billingCycle } = params;

  const targetPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  if (!targetPlan || planId === 'free') {
    throw new Error('Invalid plan selected for checkout');
  }

  const priceINR = billingCycle === 'yearly' ? targetPlan.priceYearly : targetPlan.priceMonthly;
  const amountInPaise = Math.round(priceINR * 100);

  // If live or test Razorpay keys configured, create real Razorpay Order
  if (razorpay) {
    try {
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now().toString().slice(-8)}`,
        notes: {
          userId,
          planId,
          billingCycle,
        },
      });

      return {
        orderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        keyId: RAZORPAY_KEY_ID,
        planName: targetPlan.name,
        isMock: false,
      };
    } catch (err: any) {
      console.warn('Razorpay order creation failed, falling back to simulated order:', err.message);
    }
  }

  // Demo / Test Mode order (works out-of-the-box before user pastes their keys)
  const mockOrderId = `order_mock_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  return {
    orderId: mockOrderId,
    amount: amountInPaise,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    planName: targetPlan.name,
    isMock: true,
  };
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature?: string;
}): boolean {
  const { orderId, paymentId, signature } = params;

  // If mock order, bypass signature verification
  if (orderId.startsWith('order_mock_')) {
    return true;
  }

  if (!signature || !RAZORPAY_KEY_SECRET) {
    return false;
  }

  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

export function activateSubscription(params: {
  userId: string;
  planId: SubscriptionPlanId;
  billingCycle: 'monthly' | 'yearly';
  paymentId: string;
  orderId: string;
}) {
  const { userId, planId, billingCycle, paymentId, orderId } = params;
  const targetPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) || SUBSCRIPTION_PLANS[1];
  const priceINR = billingCycle === 'yearly' ? targetPlan.priceYearly : targetPlan.priceMonthly;

  const now = new Date().toISOString();
  const periodDays = billingCycle === 'yearly' ? 365 : 30;
  const expiresAt = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

  // Update or insert subscription
  const existingSub = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(userId);
  if (existingSub) {
    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?, status = 'active', current_period_end = ?, billing_cycle = ?
      WHERE user_id = ?
    `).run(planId, expiresAt, billingCycle, userId);
  } else {
    db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle, created_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?)
    `).run(`sub_${userId}`, userId, planId, expiresAt, billingCycle, now);
  }

  // Insert invoice record
  const invoiceNumber = `INV-RZP-${Date.now().toString().slice(-6)}`;
  db.prepare(`
    INSERT INTO subscription_invoices (id, user_id, plan_id, amount, currency, status, invoice_number, created_at)
    VALUES (?, ?, ?, ?, 'INR', 'paid', ?, ?)
  `).run(`inv_${Date.now()}`, userId, planId, priceINR, invoiceNumber, now);
}

export async function processRazorpayWebhook(payload: any, signature: string): Promise<{ received: boolean }> {
  if (RAZORPAY_WEBHOOK_SECRET && signature) {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new Error('Invalid Razorpay webhook signature');
    }
  }

  const event = typeof payload === 'string' ? JSON.parse(payload) : payload;

  if (event.event === 'order.paid' || event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const orderNotes = event.payload?.order?.entity?.notes || payment?.notes;

    if (orderNotes?.userId && orderNotes?.planId) {
      activateSubscription({
        userId: orderNotes.userId,
        planId: orderNotes.planId as SubscriptionPlanId,
        billingCycle: (orderNotes.billingCycle as 'monthly' | 'yearly') || 'monthly',
        paymentId: payment?.id || `pay_${Date.now()}`,
        orderId: event.payload?.order?.entity?.id || `order_${Date.now()}`,
      });
    }
  }

  return { received: true };
}
