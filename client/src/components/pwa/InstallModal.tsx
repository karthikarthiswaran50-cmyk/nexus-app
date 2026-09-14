import React, { useState } from 'react';
import {
  X,
  Crown,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Share2,
  MoreVertical,
  Download,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { PWAInstallState } from '../../hooks/usePWAInstall';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  pwaState: PWAInstallState;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, pwaState }) => {
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!isOpen) return null;

  const handleOneTapInstall = async () => {
    setInstalling(true);
    const installed = await pwaState.promptInstall();
    setInstalling(false);
    if (installed) {
      onClose();
    }
  };

  const handleCopyLink = () => {
    const url = window.location.origin;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }).catch(() => {});
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-950/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-md bg-dark-900 border border-gold-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] royal-card animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-dark-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 flex items-center justify-center text-dark-950 shadow-lg shadow-gold-500/30 shrink-0">
              <Crown className="w-5 h-5 fill-dark-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Install Nexus Royal</h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Mobile App
                </span>
              </div>
              <p className="text-[11px] text-dark-400">Zero Browser Bar • Original App Experience</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Important Highlight Note */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-gold-500/30 text-xs text-amber-200 space-y-1">
            <div className="flex items-center gap-2 font-bold text-white">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>மேலே Link தெரியாமல் Original App போல் இயக்க:</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed pl-6">
              இதை மொபைலில் Install செய்தால், Chrome address bar / link மறைந்து Play Store ஆப் போலவே முழு திரையில் ரன் ஆகும்.
            </p>
          </div>

          {/* One-Tap Direct Install (if browser supports prompt) */}
          {pwaState.isInstallable && (
            <div className="p-4 rounded-2xl bg-dark-950 border border-gold-500/30 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                <Download className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Direct Installation Ready</h4>
                <p className="text-xs text-dark-300 mt-0.5">Tap below to add Nexus Royal to your Home Screen</p>
              </div>
              <button
                type="button"
                onClick={handleOneTapInstall}
                disabled={installing}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs sm:text-sm shadow-xl shadow-gold-500/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>{installing ? 'Installing App...' : '📲 Install Nexus App Now'}</span>
              </button>
            </div>
          )}

          {/* In-App Browser (WhatsApp / Telegram / Instagram) Notice */}
          {pwaState.isInAppBrowser && (
            <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-100">
                <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Open in Chrome Browser</span>
              </div>
              <p className="text-[11px] text-blue-200/90 leading-relaxed">
                நீங்கள் WhatsApp / சமூக வலைத்தளத்தின் உள்ளமைந்த browser-ல் உள்ளீர்கள். மேலே உள்ள <strong>3 புள்ளிகளை (⋮)</strong> தட்டி <strong>'Open in Chrome'</strong> என்பதைத் தேர்ந்தெடுக்கவும்.
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 font-bold text-xs flex items-center justify-center gap-2 border border-blue-400/30 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link Copied! Open Chrome & Paste' : 'Copy App Link'}</span>
              </button>
            </div>
          )}

          {/* Step-by-Step Instructions for Android / Chrome */}
          {(!pwaState.isIOS || pwaState.isAndroid) && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-dark-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>Android / Chrome Install Steps:</span>
              </h4>

              <div className="space-y-2 text-xs">
                {/* Step 1 */}
                <div className="p-3 rounded-2xl bg-dark-950/80 border border-white/5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <span>திரையின் மேல் வலது மூலையில் உள்ள</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-dark-800 text-amber-300 border border-white/10 font-mono">
                        <MoreVertical className="w-3 h-3 inline" /> 3 Dots (⋮)
                      </span>
                      <span>-ஐ தட்டவும்</span>
                    </p>
                    <p className="text-[11px] text-dark-400 mt-0.5">
                      Tap the 3 dots menu icon at the top-right corner of Chrome.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3 rounded-2xl bg-dark-950/80 border border-white/5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <span>மெனுவில்</span>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold">
                        "Install app"
                      </span>
                      <span>அல்லது "Add to Home screen"-ஐத் தட்டவும்</span>
                    </p>
                    <p className="text-[11px] text-dark-400 mt-0.5">
                      Choose <strong>"Install app"</strong> from the dropdown list.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3 rounded-2xl bg-dark-950/80 border border-white/5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>"Install" கொடுத்து முடிக்கவும்!</span>
                    </p>
                    <p className="text-[11px] text-dark-400 mt-0.5">
                      Done! Nexus Royal icon will appear on your phone screen. Open it directly without any browser address bar!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step-by-Step for iPhone / iOS */}
          {pwaState.isIOS && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-dark-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>iPhone / Safari Install Steps:</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-2xl bg-dark-950/80 border border-white/5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">1</div>
                  <div>
                    <p className="font-bold text-white">Safari-யின் கீழே உள்ள Share Icon (⬆️)-ஐ தட்டவும்</p>
                    <p className="text-[11px] text-dark-400 mt-0.5">Tap the Share button in the bottom bar.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-dark-950/80 border border-white/5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/30">2</div>
                  <div>
                    <p className="font-bold text-white">கீழே உருட்டி "Add to Home Screen" (➕)-ஐ தேர்ந்தெடுக்கவும்</p>
                    <p className="text-[11px] text-dark-400 mt-0.5">Scroll down and tap "Add to Home Screen".</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-dark-950/80 border border-white/5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">3</div>
                  <div>
                    <p className="font-bold text-emerald-300">மேலே வலதுபுறம் "Add"-ஐ தட்டவும்!</p>
                    <p className="text-[11px] text-dark-400 mt-0.5">Tap Add in the top-right corner to finish.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-white/10 bg-dark-950 flex items-center justify-between gap-3">
          <p className="text-[11px] text-dark-400">
            Nexus Royal Standalone App
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
};
