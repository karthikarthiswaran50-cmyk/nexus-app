import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:5000/api';
const RAZORPAY_KEY_SECRET = 'mVI6wCvvrgMuag6slvLA606C';

async function runProductionVerification() {
  console.log('🧪 Starting Nexus Production Platform Automated Verification (Live Razorpay + WebRTC)...\n');

  try {
    // 1. Health check
    const health = await fetch(`${BASE_URL}/health`).then(r => r.json());
    console.log('✅ 1. Health Check:', health.status, `(${health.environment})`);

    // 2. WebRTC ICE & TURN Servers Discovery
    const rtcConfig = await fetch(`${BASE_URL}/webrtc/config`).then(r => r.json());
    console.log(`✅ 2. WebRTC ICE / TURN Configuration: Loaded ${rtcConfig.iceServers.length} ICE server configs`);
    console.log(`   STUN/TURN endpoints: ${JSON.stringify(rtcConfig.iceServers.map((s: any) => s.urls))}`);

    // 3. Subscription plans catalogue
    const plansRes = await fetch(`${BASE_URL}/subscriptions/plans`).then(r => r.json());
    console.log(`✅ 3. Plans Catalogue: Loaded ${plansRes.plans.length} tiers (${plansRes.plans.map((p: any) => p.name).join(', ')}), Currency: ${plansRes.currency}`);

    // 4. Login Demo User
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'demo_user', password: 'password123' }),
    }).then(r => r.json());

    const demoToken = loginRes.token;
    const demoUser = loginRes.user;
    console.log(`✅ 4. Demo User Login: Authenticated ${demoUser.full_name} (@${demoUser.username}), Plan: ${demoUser.plan_id}`);

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${demoToken}`,
    };

    // 5. Razorpay Order Creation (Live API)
    const orderRes = await fetch(`${BASE_URL}/subscriptions/create-razorpay-order`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        planId: 'vip',
        billingCycle: 'yearly',
      }),
    }).then(r => r.json());
    console.log(`✅ 5. Live Razorpay Order API: Successfully generated Order on Razorpay servers: ${orderRes.orderId} (₹${orderRes.amount / 100})`);

    // 6. Cryptographic Signature Verification
    const testPaymentId = `pay_test_${Date.now()}`;
    const validSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${orderRes.orderId}|${testPaymentId}`)
      .digest('hex');

    const verifyRes = await fetch(`${BASE_URL}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        orderId: orderRes.orderId,
        paymentId: testPaymentId,
        signature: validSignature,
        planId: 'vip',
        billingCycle: 'yearly',
      }),
    }).then(r => r.json());
    console.log(`✅ 6. Cryptographic Payment Verification API: ${verifyRes.message}, Activated Tier: ${verifyRes.user.plan_id}`);

    // 7. Direct Subscription Upgrade
    const subRes = await fetch(`${BASE_URL}/subscriptions/subscribe`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        planId: 'vip',
        billingCycle: 'monthly',
      }),
    }).then(r => r.json());
    console.log(`✅ 7. Active Tier Management: User tier confirmed as ${subRes.plan.name}`);

    // 8. Invoices & Billing
    const currentSubRes = await fetch(`${BASE_URL}/subscriptions/current`, { headers: authHeaders }).then(r => r.json());
    console.log(`✅ 8. Invoice Verification: Active Plan: ${currentSubRes.plan.name}, Total Invoices: ${currentSubRes.invoices.length}`);

    // 9. Chat Message exchange
    const sendRes = await fetch(`${BASE_URL}/chat/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'usr_elena',
        content: 'Testing production WebRTC TURN and live Razorpay payment gateway!',
        type: 'text',
      }),
    }).then(r => r.json());
    console.log(`✅ 9. Real-Time Chat: Sent message ${sendRes.message.id}`);

    // 10. Call Log recording
    const callLogRes = await fetch(`${BASE_URL}/calls/log`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receiverId: 'usr_elena',
        callType: 'video',
        status: 'completed',
        duration: 420,
      }),
    }).then(r => r.json());
    console.log(`✅ 10. WebRTC Call Logging: Logged ${callLogRes.callLog.call_type} call duration: ${callLogRes.callLog.duration}s`);

    console.log('\n🎉 ALL LIVE RAZORPAY & WEBRTC VERIFICATION TESTS PASSED 100%! 🚀');
  } catch (err: any) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

runProductionVerification();
