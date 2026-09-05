import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, RotateCw, Maximize } from 'lucide-react';

interface MediaViewerModalProps {
  mediaUrl: string;
  senderName?: string;
  timestamp?: string;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  mediaUrl,
  senderName,
  timestamp,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `nexus_media_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(mediaUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-dark-950/95 backdrop-blur-2xl animate-in fade-in duration-200">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-b from-dark-950/90 to-transparent z-10 border-b border-white/5">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white tracking-wide">
            {senderName ? `${senderName}'s Media` : 'Media Viewer'}
          </span>
          {timestamp && <span className="text-[11px] text-dark-400">{timestamp}</span>}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-dark-800 text-dark-300 hover:text-white border border-white/10 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-dark-800 text-dark-300 hover:text-white border border-white/10 transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Rotate */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-dark-800 text-dark-300 hover:text-white border border-white/10 transition-all"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={handleReset}
            className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-dark-800 text-dark-300 hover:text-white border border-white/10 transition-all"
            title="Reset Fit"
          >
            <Maximize className="w-4 h-4" />
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-gold-500/20 hover:scale-105 active:scale-95 transition-all"
            title="Download Image"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all ml-1"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Canvas */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={mediaUrl}
          alt="Full screen preview"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          draggable={false}
        />
      </div>
    </div>
  );
};
