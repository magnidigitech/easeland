import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, ChevronLeft, ChevronRight, Maximize2, ShieldCheck, Plane, Video } from 'lucide-react';

/**
 * PropertyMediaZoomViewer
 * Provides native-feeling interactive zoom, multi-touch pinch-to-zoom, double-tap zoom,
 * and a high-resolution full-screen photo inspection modal specifically for Property media.
 * Whitelisted for the PWA mobile zoom architecture via .zoomable-property & data-allow-zoom="true".
 */
export default function PropertyMediaZoomViewer({
  activeMedia,
  mediaList = [],
  activeMediaIndex = 0,
  onSelectMediaIndex = () => {},
  propertyTitle = 'Property',
  verificationStatus = '',
  defaultFallback = '/easeland_hero_bg.jpg',
  className = ''
}) {
  // In-place inline canvas zoom state
  const [inlineScale, setInlineScale] = useState(1);
  const [inlinePosition, setInlinePosition] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);

  // Full-screen modal inspector state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalScale, setModalScale] = useState(1);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });

  const inlineCanvasRef = useRef(null);
  const touchStartRef = useRef({ dist: 0, startScale: 1, lastTap: 0, startPos: { x: 0, y: 0 }, panStart: { x: 0, y: 0 } });
  const modalTouchRef = useRef({ dist: 0, startScale: 1, lastTap: 0, startPos: { x: 0, y: 0 }, panStart: { x: 0, y: 0 } });

  // Reset inline zoom when the active photo changes
  useEffect(() => {
    setInlineScale(1);
    setInlinePosition({ x: 0, y: 0 });
  }, [activeMediaIndex, activeMedia]);

  // Reset modal zoom when opening or switching photo
  const resetModalZoom = useCallback(() => {
    setModalScale(1);
    setModalPosition({ x: 0, y: 0 });
  }, []);

  const openModal = () => {
    resetModalZoom();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModalZoom();
  };

  // Keyboard navigation for modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowRight' && mediaList.length > 1) {
        const nextIdx = (activeMediaIndex + 1) % mediaList.length;
        onSelectMediaIndex(nextIdx);
        resetModalZoom();
      }
      if (e.key === 'ArrowLeft' && mediaList.length > 1) {
        const prevIdx = (activeMediaIndex - 1 + mediaList.length) % mediaList.length;
        onSelectMediaIndex(prevIdx);
        resetModalZoom();
      }
      if (e.key === '+' || e.key === '=') {
        setModalScale((s) => Math.min(s + 0.5, 4));
      }
      if (e.key === '-') {
        setModalScale((s) => Math.max(s - 0.5, 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, activeMediaIndex, mediaList, onSelectMediaIndex, resetModalZoom]);

  // Touch handlers for In-Place Inline Canvas
  const getTouchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleInlineTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsInteracting(true);
      const dist = getTouchDistance(e.touches);
      touchStartRef.current.dist = dist;
      touchStartRef.current.startScale = inlineScale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const timeSinceLast = now - touchStartRef.current.lastTap;
      touchStartRef.current.lastTap = now;

      // Double-tap to toggle zoom
      if (timeSinceLast < 300 && timeSinceLast > 0) {
        e.preventDefault();
        if (inlineScale > 1) {
          setInlineScale(1);
          setInlinePosition({ x: 0, y: 0 });
        } else {
          setInlineScale(2.5);
        }
        return;
      }

      if (inlineScale > 1) {
        setIsInteracting(true);
        touchStartRef.current.startPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartRef.current.panStart = { ...inlinePosition };
      }
    }
  };

  const handleInlineTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      const ratio = dist / (touchStartRef.current.dist || 1);
      const newScale = Math.min(Math.max(1, touchStartRef.current.startScale * ratio), 3.5);
      setInlineScale(newScale);
    } else if (e.touches.length === 1 && inlineScale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - touchStartRef.current.startPos.x;
      const dy = e.touches[0].clientY - touchStartRef.current.startPos.y;
      setInlinePosition({
        x: touchStartRef.current.panStart.x + dx,
        y: touchStartRef.current.panStart.y + dy
      });
    }
  };

  const handleInlineTouchEnd = () => {
    setIsInteracting(false);
    if (inlineScale <= 1.05) {
      setInlineScale(1);
      setInlinePosition({ x: 0, y: 0 });
    }
  };

  // Touch handlers for Full-screen Modal Canvas
  const handleModalTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      modalTouchRef.current.dist = dist;
      modalTouchRef.current.startScale = modalScale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const timeSinceLast = now - modalTouchRef.current.lastTap;
      modalTouchRef.current.lastTap = now;

      if (timeSinceLast < 300 && timeSinceLast > 0) {
        e.preventDefault();
        if (modalScale > 1) {
          resetModalZoom();
        } else {
          setModalScale(2.5);
        }
        return;
      }

      if (modalScale > 1) {
        modalTouchRef.current.startPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        modalTouchRef.current.panStart = { ...modalPosition };
      }
    }
  };

  const handleModalTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      const ratio = dist / (modalTouchRef.current.dist || 1);
      const newScale = Math.min(Math.max(1, modalTouchRef.current.startScale * ratio), 4.5);
      setModalScale(newScale);
    } else if (e.touches.length === 1 && modalScale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - modalTouchRef.current.startPos.x;
      const dy = e.touches[0].clientY - modalTouchRef.current.startPos.y;
      setModalPosition({
        x: modalTouchRef.current.panStart.x + dx,
        y: modalTouchRef.current.panStart.y + dy
      });
    }
  };

  // Determine media details
  const isVideo = activeMedia && (activeMedia.mediaType === 'WALKTHROUGH_VIDEO' || activeMedia.mediaType === 'DRONE_VIDEO');
  const mediaUrl = (typeof activeMedia === 'string' ? activeMedia : (activeMedia?.url || activeMedia?.publicUrl)) || defaultFallback;
  const caption = (typeof activeMedia === 'object' && activeMedia?.caption) ? activeMedia.caption : propertyTitle;

  return (
    <div className={'property-zoom-container relative ' + className}>

      {/* MAIN INLINE MEDIA CANVAS */}
      <div
        ref={inlineCanvasRef}
        data-allow-zoom="true"
        className="zoomable-property property-media-canvas relative w-full h-[360px] sm:h-[480px] bg-brand-charcoal rounded-xl overflow-hidden flex items-center justify-center select-none"
        onTouchStart={handleInlineTouchStart}
        onTouchMove={handleInlineTouchMove}
        onTouchEnd={handleInlineTouchEnd}
        onTouchCancel={handleInlineTouchEnd}
      >
        {isVideo ? (
          activeMedia.embedUrl ? (
            <iframe
              src={activeMedia.embedUrl}
              title={caption}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={mediaUrl}
              controls
              className="w-full h-full object-contain"
            />
          )
        ) : (
          <div
            className="w-full h-full flex items-center justify-center cursor-zoom-in"
            onClick={() => {
              if (inlineScale === 1) openModal();
            }}
          >
            <img
              src={mediaUrl}
              alt={caption}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = defaultFallback;
              }}
              style={{
                transform: 'translate(' + inlinePosition.x + 'px, ' + inlinePosition.y + 'px) scale(' + inlineScale + ')',
                transition: isInteracting ? 'none' : 'transform 0.25s ease-out',
                touchAction: 'none'
              }}
              className="w-full h-full object-cover pointer-events-none"
            />
          </div>
        )}

        {/* TOP LEFT MEDIA TYPE / VERIFICATION BADGE */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
          {verificationStatus && (
            <div className="bg-brand-charcoal/90 backdrop-blur-md text-amber-400 text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow border border-amber-400/30">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{verificationStatus}</span>
            </div>
          )}
          {isVideo && (
            <div className="bg-brand-charcoal/85 backdrop-blur-md text-brand-yellow text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow border border-white/10">
              {activeMedia.mediaType === 'DRONE_VIDEO' ? <Plane className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              <span>{activeMedia.mediaType === 'DRONE_VIDEO' ? 'Drone View' : 'Property Video'}</span>
            </div>
          )}
        </div>

        {/* TOP RIGHT INSPECT / FULLSCREEN ZOOM BUTTON */}
        {!isVideo && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {inlineScale > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setInlineScale(1);
                  setInlinePosition({ x: 0, y: 0 });
                }}
                className="bg-brand-charcoal/85 hover:bg-brand-charcoal text-white text-xs font-bold px-2.5 py-1.5 rounded-lg backdrop-blur-md border border-white/20 shadow flex items-center gap-1.5 transition-all cursor-pointer"
                title="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset 1x</span>
              </button>
            )}

            <button
              type="button"
              onClick={openModal}
              className="bg-brand-charcoal/85 hover:bg-slate-900 text-amber-400 hover:text-white px-3 py-1.5 rounded-lg backdrop-blur-md border border-amber-400/40 shadow-lg flex items-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer group"
              title="Open Fullscreen Photo Inspector"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Inspect Photo</span>
            </button>
          </div>
        )}

        {/* BOTTOM RIGHT COUNTER BADGE */}
        {mediaList.length > 0 && (
          <div className="absolute bottom-4 right-4 z-10 bg-brand-charcoal/85 backdrop-blur-md text-white text-xs font-extrabold px-3 py-1 rounded-lg border border-white/10 shadow pointer-events-none">
            {String(activeMediaIndex + 1) + ' / ' + String(mediaList.length)}
          </div>
        )}

        {/* FLOATING ZOOM LEVEL HINT (When active) */}
        {!isVideo && inlineScale > 1 && (
          <div className="absolute bottom-4 left-4 z-10 bg-amber-400/90 text-brand-charcoal font-black text-[11px] px-2.5 py-1 rounded-lg shadow-md pointer-events-none">
            {'Zoom ' + inlineScale.toFixed(1) + 'x • Drag to pan'}
          </div>
        )}
      </div>

      {/* FULLSCREEN PROPERTY PHOTO ZOOM MODAL */}
      {isModalOpen && !isVideo && (
        <div
          data-allow-zoom="true"
          className="zoomable-property fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          {/* MODAL TOP HEADER TOOLBAR */}
          <div className="flex items-center justify-between p-4 sm:p-6 z-20 bg-gradient-to-b from-slate-950/90 to-transparent">
            <div>
              <h4 className="text-white font-extrabold text-sm sm:text-base line-clamp-1">
                {caption}
              </h4>
              <p className="text-amber-400 text-xs font-bold mt-0.5">
                {'Property Photo Inspection • ' + String(activeMediaIndex + 1) + ' of ' + String(mediaList.length || 1)}
              </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalScale((s) => Math.min(s + 0.5, 4.5))}
                className="bg-white/10 hover:bg-white/20 text-white p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Zoom In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalScale((s) => {
                    const nextS = Math.max(s - 0.5, 1);
                    if (nextS === 1) setModalPosition({ x: 0, y: 0 });
                    return nextS;
                  });
                }}
                className="bg-white/10 hover:bg-white/20 text-white p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Zoom Out</span>
              </button>

              {modalScale > 1 && (
                <button
                  type="button"
                  onClick={resetModalZoom}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  title="Reset Zoom to 1x"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reset 1x</span>
                </button>
              )}

              <button
                type="button"
                onClick={closeModal}
                className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ml-1"
                title="Close Inspector (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN MODAL CANVAS WITH PINCH AND DRAG */}
          <div
            data-allow-zoom="true"
            className="zoomable-property relative flex-1 w-full flex items-center justify-center overflow-hidden p-2 sm:p-6"
            onTouchStart={handleModalTouchStart}
            onTouchMove={handleModalTouchMove}
            style={{ touchAction: 'none' }}
          >
            <img
              src={mediaUrl}
              alt={caption}
              style={{
                transform: 'translate(' + modalPosition.x + 'px, ' + modalPosition.y + 'px) scale(' + modalScale + ')',
                transition: 'transform 0.15s ease-out',
                maxWidth: '92vw',
                maxHeight: '78vh'
              }}
              className="object-contain rounded-xl shadow-2xl pointer-events-none select-none"
            />

            {/* FLOATING PREV / NEXT BUTTONS */}
            {mediaList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const prevIdx = (activeMediaIndex - 1 + mediaList.length) % mediaList.length;
                    onSelectMediaIndex(prevIdx);
                    resetModalZoom();
                  }}
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-900 text-white p-3 rounded-2xl border border-white/20 shadow-xl cursor-pointer transition-transform hover:scale-105"
                  title="Previous Photo"
                >
                  <ChevronLeft className="w-6 h-6 text-amber-400" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextIdx = (activeMediaIndex + 1) % mediaList.length;
                    onSelectMediaIndex(nextIdx);
                    resetModalZoom();
                  }}
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-900 text-white p-3 rounded-2xl border border-white/20 shadow-xl cursor-pointer transition-transform hover:scale-105"
                  title="Next Photo"
                >
                  <ChevronRight className="w-6 h-6 text-amber-400" />
                </button>
              </>
            )}
          </div>

          {/* MODAL BOTTOM BAR WITH THUMBNAILS & HINT */}
          <div className="p-3 sm:p-5 z-20 bg-gradient-to-t from-slate-950/90 to-transparent flex flex-col items-center gap-2">
            <div className="text-gray-400 text-[11px] font-semibold">
              {'Pinch to zoom • Double-tap to toggle zoom • Drag to pan • Zoom ' + modalScale.toFixed(1) + 'x'}
            </div>

            {mediaList.length > 1 && (
              <div className="flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar py-1">
                {mediaList.map((item, idx) => {
                  const thumbUrl = (typeof item === 'string' ? item : (item.url || item.publicUrl)) || defaultFallback;
                  const isCur = idx === activeMediaIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onSelectMediaIndex(idx);
                        resetModalZoom();
                      }}
                      className={'relative w-14 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ' + (isCur ? 'border-amber-400 scale-105 ring-2 ring-amber-400/50' : 'border-white/20 opacity-60 hover:opacity-100')}
                    >
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
