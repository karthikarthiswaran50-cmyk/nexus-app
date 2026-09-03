import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SubscriptionPlan, SubscriptionInvoice } from '../../types';
import { PlanBadge } from '../common/Badge';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Crown,
  Shield,
  Check,
  CreditCard,
  Zap,
  ArrowRight,
  CheckCircle2,
  X,
  Lock,
  QrCode,
  Smartphone,
} from 'lucide-react';
import axios from 'axios';

// Dynamically load Razorpay Checkout script
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const SubscriptionView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  
  // Checkout Form State
  const [paymentMode, setPaymentMode] = useState<'razorpay' | 'direct'>('razorpay');
  const [cardName, setCardName] = useState(user?.full_name || 'Karthik');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptionData = async () => {
    try {
      const [plansRes, currentRes] = await Promise.all([
        axios.get('/api/subscriptions/plans'),
        axios.get('/api/subscriptions/current'),
      ]);
      setPlans(plansRes.data.plans);
      setRazorpayKeyId(plansRes.data.razorpayKeyId || '');
      setInvoices(currentRes.data.invoices || []);
    } catch (err) {
      console.error('Fetch subscription error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
    loadRazorpayScript();
  }, []);

  // 1. Razorpay Official Checkout Gateway (UPI, GPay, PhonePe, Cards, NetBanking)
  const handleRazorpayPayment = async () => {
    if (!selectedPlanForCheckout) return;

    setProcessing(true);
    try {
      // 1. Create order on backend
      const orderRes = await axios.post('/api/subscriptions/create-razorpay-order', {
        planId: selectedPlanForCheckout.id,
        billingCycle,
      });

      const orderData = orderRes.data;
      const isScriptLoaded = await loadRazorpayScript();

      // If Razorpay SDK loaded and real key provided
      if (isScriptLoaded && (window as any).Razorpay && !orderData.isMock) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Nexus Real-Time Platform',
          description: `${selectedPlanForCheckout.name} Subscription (${billingCycle})`,
          image: 'https://cdn-icons-png.flaticon.com/512/9422/9422896.png',
          order_id: orderData.orderId,
          prefill: {
            name: orderData.user?.name || user?.full_name,
            email: orderData.user?.email || user?.email,
          },
          theme: {
            color: '#6366f1',
          },
          handler: async function (response: any) {
            try {
              // Verify payment on backend
              await axios.post('/api/subscriptions/verify-payment', {
                orderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId: selectedPlanForCheckout.id,
                billingCycle,
              });

              triggerSuccess(selectedPlanForCheckout.name);
            } catch (err) {
              alert('Payment verification failed. Please check your credentials.');
            }
          },
          modal: {
            ondismiss: function () {
              setProcessing(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Instant simulated verification for Test/Demo mode
        await axios.post('/api/subscriptions/verify-payment', {
          orderId: orderData.orderId,
          paymentId: `pay_mock_${Date.now()}`,
          signature: 'mock_signature',
          planId: selectedPlanForCheckout.id,
          billingCycle,
        });

        triggerSuccess(selectedPlanForCheckout.name);
      }
    } catch (err: any) {
      console.warn('Razorpay checkout error, falling back to direct:', err);
      await handleDirectSubscribe();
    } finally {
      setProcessing(false);
    }
  };

  // 2. Direct Instant Activation
  const handleDirectSubscribe = async () => {
    if (!selectedPlanForCheckout) return;

    setProcessing(true);
    try {
      await axios.post('/api/subscriptions/subscribe', {
        planId: selectedPlanForCheckout.id,
        billingCycle,
      });

      triggerSuccess(selectedPlanForCheckout.name);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Subscription processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const triggerSuccess = async (planName: string) => {
    confetti({
      particleCount: 130,
      spread: 85,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981'],
    });

    setSuccessMessage(`🎉 You are now subscribed to ${planName}!`);
    setSelectedPlanForCheckout(null);
    await refreshUser();
    await fetchSubscriptionData();

    setTimeout(() => setSuccessMessage(null), 6000);
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your premium subscription? You will revert to the Starter tier.')) {
      return;
    }

    try {
      await axios.post('/api/subscriptions/cancel');
      await refreshUser();
      await fetchSubscriptionData();
      alert('Subscription cancelled. Reverted to Starter tier.');
    } catch (err) {
      alert('Failed to cancel subscription.');
    }
  };

  const currentPlanId = user?.plan_id || 'free';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-10">
      
      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm flex items-center justify-between shadow-xl animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Hero */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Razorpay Payment Gateway (UPI, GPay, PhonePe, Cards) Integrated</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Supercharge Your Calling & Real-Time Experience
        </h1>
        <p className="text-sm text-dark-300">
          Unlock unlimited HD video calls, crystal-clear screen sharing, verified subscriber badges, and priority connectivity.
        </p>

        {/* Monthly / Yearly Billing Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span className={`text-xs font-semibold ${billingCycle === 'monthly' ? 'text-white' : 'text-dark-400'}`}>
            Monthly
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className={`w-12 h-6 rounded-full p-1 transition-colors relative ${
              billingCycle === 'yearly' ? 'bg-brand-600' : 'bg-dark-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs font-semibold flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'text-white' : 'text-dark-400'}`}>
            Yearly
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isVip = plan.id === 'vip';
          const isPro = plan.id === 'pro';
          const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 ${
                isVip
                  ? 'bg-gradient-to-b from-amber-950/30 via-dark-900 to-dark-950 border-2 border-amber-500/50 shadow-2xl shadow-amber-500/10'
                  : isPro
                  ? 'bg-gradient-to-b from-brand-950/40 via-dark-900 to-dark-950 border-2 border-brand-500/60 shadow-2xl shadow-brand-500/15'
                  : 'bg-dark-900 border border-dark-800'
              }`}
            >
              {/* Top Banner Tag */}
              {isVip && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-dark-950 text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  Most Powerful
                </div>
              )}
              {isPro && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-brand-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  Most Popular
                </div>
              )}

              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {isVip ? (
                      <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
                    ) : isPro ? (
                      <Sparkles className="w-5 h-5 text-brand-400" />
                    ) : (
                      <Shield className="w-5 h-5 text-dark-400" />
                    )}
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      Active Plan
                    </span>
                  )}
                </div>

                <p className="text-xs text-dark-300 mb-6">{plan.tagline}</p>

                {/* Price (in INR) */}
                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">
                    ₹{price === 0 ? '0' : price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-dark-400">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>

                {/* Features list */}
                <div className="space-y-3 mb-8 pt-4 border-t border-dark-800/80">
                  <p className="text-xs font-semibold text-dark-300 uppercase tracking-wider">Features included:</p>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-dark-200">
                      <div className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              {isCurrent ? (
                <div className="space-y-2">
                  <div className="w-full py-3 rounded-2xl bg-dark-800 text-dark-300 font-semibold text-xs text-center border border-dark-700">
                    Current Active Plan
                  </div>
                  {currentPlanId !== 'free' && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleCancelSubscription}
                        className="text-xs text-rose-400 hover:text-rose-300 underline"
                      >
                        Cancel renewal
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedPlanForCheckout(plan)}
                  className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95 ${
                    isVip
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-dark-950 shadow-amber-500/20'
                      : isPro
                      ? 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white shadow-brand-500/25'
                      : 'bg-dark-800 hover:bg-dark-700 text-white border border-dark-700'
                  }`}
                >
                  <span>{plan.priceMonthly === 0 ? 'Switch to Starter' : `Upgrade to ${plan.name}`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Invoice History Section */}
      <div className="bg-dark-900 border border-dark-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-brand-400" />
          Billing & Official Invoices
        </h3>
        <p className="text-xs text-dark-400 mb-6">Review all your payment receipts and verified transactions.</p>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-dark-500 bg-dark-950/40 rounded-2xl border border-dark-800">
            No previous billing invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-dark-300">
              <thead className="text-dark-400 uppercase tracking-wider border-b border-dark-800 pb-2">
                <tr>
                  <th className="py-3 px-4 font-semibold">Invoice Number</th>
                  <th className="py-3 px-4 font-semibold">Plan</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-dark-800/30">
                    <td className="py-3.5 px-4 font-mono text-white font-medium">{inv.invoice_number}</td>
                    <td className="py-3.5 px-4 capitalize">
                      <PlanBadge planId={inv.plan_id} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-dark-400">
                      {new Date(inv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">₹{inv.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                        Paid
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Razorpay Checkout Modal */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-dark-900 border border-dark-700 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-dark-800">
              <div>
                <h3 className="text-lg font-bold text-white">Upgrade to {selectedPlanForCheckout.name}</h3>
                <p className="text-xs text-dark-400">Pay securely via Razorpay (India & Global)</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForCheckout(null)}
                className="p-1.5 rounded-lg text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Summary */}
            <div className="mb-6 p-4 rounded-2xl bg-dark-800/80 border border-dark-700/80 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-dark-300">{selectedPlanForCheckout.name} ({billingCycle})</span>
                <span className="text-white font-bold">
                  ₹{(billingCycle === 'yearly' ? selectedPlanForCheckout.priceYearly : selectedPlanForCheckout.priceMonthly).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-xs text-dark-400">
                <span>Taxes & GST</span>
                <span>Included</span>
              </div>
              <div className="pt-2 border-t border-dark-700 flex justify-between text-sm font-bold text-white">
                <span>Total Due Today</span>
                <span className="text-emerald-400">
                  ₹{(billingCycle === 'yearly' ? selectedPlanForCheckout.priceYearly : selectedPlanForCheckout.priceMonthly).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setPaymentMode('razorpay')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  paymentMode === 'razorpay'
                    ? 'bg-brand-600 border-brand-500 text-white shadow-md'
                    : 'bg-dark-800 border-dark-700 text-dark-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>UPI / Razorpay</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('direct')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  paymentMode === 'direct'
                    ? 'bg-brand-600 border-brand-500 text-white shadow-md'
                    : 'bg-dark-800 border-dark-700 text-dark-300 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Instant Upgrade</span>
              </button>
            </div>

            {paymentMode === 'razorpay' ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-dark-800/60 border border-dark-700 space-y-2">
                  <p className="text-xs text-white font-medium flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-brand-400" />
                    Supported Payment Methods:
                  </p>
                  <p className="text-[11px] text-dark-300 leading-relaxed">
                    • **UPI:** Google Pay, PhonePe, Paytm, BHIM, CRED<br />
                    • **Cards:** Visa, Mastercard, RuPay, Amex<br />
                    • **NetBanking & Wallets**
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-dark-400">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Razorpay PCI-DSS Level 1 256-bit Encrypted</span>
                </div>

                <button
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={processing}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {processing ? 'Opening Razorpay Gateway...' : `Pay ₹${(billingCycle === 'yearly' ? selectedPlanForCheckout.priceYearly : selectedPlanForCheckout.priceMonthly).toLocaleString('en-IN')} via Razorpay`}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-dark-300">
                  This simulated instant activation upgrades your subscription immediately without opening payment popups. Perfect for local testing and demonstration.
                </p>

                <button
                  type="button"
                  onClick={handleDirectSubscribe}
                  disabled={processing}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-accent-violet hover:from-brand-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {processing ? 'Activating...' : `Instant Upgrade to ${selectedPlanForCheckout.name}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
