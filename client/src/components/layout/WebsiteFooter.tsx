import React from 'react';
import { Shield, Sparkles, Mail, Heart, ExternalLink } from 'lucide-react';

interface WebsiteFooterProps {
  className?: string;
}

export const WebsiteFooter: React.FC<WebsiteFooterProps> = ({ className = '' }) => {
  const navigateTo = (route: string) => {
    window.history.pushState({}, '', `/${route}`);
    window.dispatchEvent(new CustomEvent('nexus_navigate', { detail: route }));
  };

  return (
    <footer className={`w-full mt-auto pt-6 pb-4 border-t border-gold-500/15 bg-dark-950/90 text-dark-400 text-xs ${className}`}>
      <div className="max-w-4xl mx-auto px-4 flex flex-col items-center gap-3">
        {/* Brand & Purpose */}
        <div className="flex items-center gap-2 text-dark-300">
          <Sparkles className="w-3.5 h-3.5 text-gold-400" />
          <span className="font-extrabold text-white text-xs">Nexus Royal</span>
          <span className="text-[11px] text-dark-500">— WebRTC Audio & Video Calling Platform</span>
        </div>

        {/* Legal & Policy Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          <button
            type="button"
            onClick={() => navigateTo('about')}
            className="text-dark-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            About Us
          </button>
          <span className="text-dark-600 hidden xs:inline">•</span>

          <button
            type="button"
            onClick={() => navigateTo('contact')}
            className="text-dark-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            Contact Us
          </button>
          <span className="text-dark-600 hidden xs:inline">•</span>

          <button
            type="button"
            onClick={() => navigateTo('privacy')}
            className="text-dark-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          <span className="text-dark-600 hidden xs:inline">•</span>

          <button
            type="button"
            onClick={() => navigateTo('terms')}
            className="text-dark-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            Terms & Conditions
          </button>
          <span className="text-dark-600 hidden xs:inline">•</span>

          <button
            type="button"
            onClick={() => navigateTo('community-guidelines')}
            className="text-dark-300 hover:text-amber-300 transition-colors cursor-pointer"
          >
            Community Guidelines
          </button>
          <span className="text-dark-600 hidden xs:inline">•</span>

          <button
            type="button"
            onClick={() => navigateTo('delete-account')}
            className="text-dark-300 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Account Deletion
          </button>
        </div>

        {/* Contact info and copyright */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-dark-500 text-center">
          <span>Support: <a href="mailto:karthikarthiswaran50@gmail.com" className="text-dark-400 hover:text-amber-300 underline font-mono">karthikarthiswaran50@gmail.com</a></span>
          <span>•</span>
          <span>© {new Date().getFullYear()} Nexus Royal. Built by Karthik Arthiswaran.</span>
        </div>
      </div>
    </footer>
  );
};
export default WebsiteFooter;
