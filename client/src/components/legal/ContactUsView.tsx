import React, { useState } from 'react';
import { ArrowLeft, Mail, Send, CheckCircle2, AlertCircle, MessageSquare, Clock, Shield, HelpCircle, User, PhoneCall } from 'lucide-react';
import axios from 'axios';

interface ContactUsViewProps {
  onBack?: () => void;
}

export const ContactUsView: React.FC<ContactUsViewProps> = ({ onBack }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Support');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const verifiedSupportEmail = 'karthikarthiswaran50@gmail.com';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const navigateTo = (route: string) => {
    window.history.pushState({}, '', `/${route}`);
    window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: route }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setFeedback({ type: 'error', text: 'Please fill out all required fields.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await axios.post('/api/contact', {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });

      setFeedback({
        type: 'success',
        text: res.data?.message || 'Thank you! Your inquiry has been sent to our support team.',
      });
      setName('');
      setEmail('');
      setMessage('');
      setSubject('General Support');
    } catch (err: any) {
      const errMsg = err.response?.data?.error || `Failed to submit. Please send your email directly to ${verifiedSupportEmail}.`;
      setFeedback({ type: 'error', text: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-gold-500/30 selection:text-gold-200">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-dark-900/90 backdrop-blur-xl border-b border-gold-500/20 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-xs font-bold text-dark-300 hover:text-white px-3 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 border border-gold-500/20 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Nexus</span>
          </button>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-gold-400" />
            <span className="text-sm font-black gold-gradient-text">CONTACT SUPPORT</span>
          </div>
          <span className="text-[11px] text-dark-400 font-mono hidden sm:inline-block">Live Support</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 leading-relaxed">
        {/* Hero Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-dark-900 border border-gold-500/30 royal-card shadow-2xl relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 bg-gold-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2.5 mb-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gold-500/20 text-gold-300 border border-gold-500/30">
              Direct Support
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Verified Developer
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Get in Touch with Nexus Royal Support
          </h1>
          <p className="text-xs sm:text-sm text-dark-300 max-w-2xl leading-normal">
            Have a question, technical issue, feature recommendation, or abuse report? Use the verified contact form below or email our support desk directly.
          </p>
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-5 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <Mail className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-sm">Verified Support Email</div>
            <a
              href={`mailto:${verifiedSupportEmail}`}
              className="text-amber-300 hover:underline break-all font-mono font-semibold block"
            >
              {verifiedSupportEmail}
            </a>
            <p className="text-[11px] text-dark-400">Response time: Usually within 24-48 business hours.</p>
          </div>

          <div className="p-5 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-sm">Abuse & Security Reports</div>
            <p className="text-dark-300">
              To report spam, harassment, or security vulnerabilities, select "Report Abuse" below or use the in-app user report button.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-dark-900/80 border border-gold-500/15 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <User className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-sm">Account & Data Removal</div>
            <p className="text-dark-300">
              Want to delete your account and messages? Visit our self-service{' '}
              <button
                type="button"
                onClick={() => navigateTo('delete-account')}
                className="text-amber-300 underline font-semibold cursor-pointer"
              >
                Data Deletion Portal
              </button>.
            </p>
          </div>
        </div>

        {/* Working Contact Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-dark-900/90 border border-gold-500/25 royal-card shadow-2xl space-y-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Send a Message</h2>
            <p className="text-xs text-dark-400">Fill out this form and we'll reply to your provided email address.</p>
          </div>

          {feedback && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{feedback.text}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-dark-200">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-dark-200">Your Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-dark-200">Subject / Category *</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
              >
                <option value="General Support">General Support & Inquiries</option>
                <option value="Audio / Video Call Quality">Audio / Video Call Quality</option>
                <option value="Account & Login Assistance">Account & Login Assistance</option>
                <option value="Report Abuse / Harassment">Report Abuse / Harassment</option>
                <option value="Feature Suggestion">Feature Suggestion & Feedback</option>
                <option value="Data Privacy Question">Data Privacy Question</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-dark-200">Message Content *</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue, feedback, or inquiry in detail..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:border-amber-400 transition-colors resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-dark-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Message...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Message to Support</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-gold-500/15 flex flex-wrap gap-4 text-xs text-dark-300 justify-center">
          <button type="button" onClick={() => navigateTo('about')} className="hover:text-amber-300 underline cursor-pointer">
            About Us
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('privacy')} className="hover:text-amber-300 underline cursor-pointer">
            Privacy Policy
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('terms')} className="hover:text-amber-300 underline cursor-pointer">
            Terms & Conditions
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('community-guidelines')} className="hover:text-amber-300 underline cursor-pointer">
            Community Guidelines
          </button>
          <span>•</span>
          <button type="button" onClick={() => navigateTo('delete-account')} className="hover:text-rose-400 underline cursor-pointer">
            Account Deletion
          </button>
        </div>
      </main>
    </div>
  );
};
