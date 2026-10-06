import React, { useState, useEffect } from 'react';
import {
  Camera,
  Video,
  Upload,
  Trash2,
  Star,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Film,
  Link as LinkIcon,
  PlusCircle,
  ExternalLink,
  Youtube,
  GripVertical,
  Move
} from 'lucide-react';
import { MediaType } from '../firebase/schema.js';
import {
  uploadPropertyMediaFile,
  removePropertyMediaFile,
  setPrimaryPropertyPhoto,
  updatePropertyMediaOrder,
  addPropertyVideoLink
} from '../firebase/mediaService.js';

export default function PropertyMediaStep({ propertyId, ownerId, mediaList = [], onUpdateMedia }) {
  const [internalMedia, setInternalMedia] = useState(mediaList || []);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideoCategory, setSelectedVideoCategory] = useState(MediaType.WALKTHROUGH_VIDEO);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [linkingVideo, setLinkingVideo] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Drag & Drop State
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState(null);
  const [dragOverPhotoIndex, setDragOverPhotoIndex] = useState(null);
  const [draggedVideoIndex, setDraggedVideoIndex] = useState(null);
  const [dragOverVideoIndex, setDragOverVideoIndex] = useState(null);

  // Sync internal state when parent props update
  useEffect(() => {
    if (Array.isArray(mediaList)) {
      setInternalMedia(mediaList);
    }
  }, [mediaList]);

  // Filter photos and videos from internal state
  const photos = internalMedia.filter(item => item && item.type === MediaType.PHOTO);
  const videos = internalMedia.filter(
    item => item && (item.type === MediaType.WALKTHROUGH_VIDEO || item.type === MediaType.DRONE_VIDEO)
  );

  // Photo Upload Handler
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!propertyId) {
      setErrorMsg('Please complete step 1 (Basic Details) before uploading property media.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setUploadProgress(0);

    try {
      const newlyAdded = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isFirstPhoto = photos.length === 0 && i === 0;

        const result = await uploadPropertyMediaFile(propertyId, ownerId, file, {
          mediaType: MediaType.PHOTO,
          isPrimary: isFirstPhoto,
          onProgress: (pct) => setUploadProgress(pct)
        });

        if (result.success && result.mediaItem) {
          newlyAdded.push(result.mediaItem);
        } else if (!result.success) {
          setErrorMsg(`Failed to upload ${file.name}: ${result.error || 'Upload error'}`);
          return;
        }
      }

      const nextMedia = [...internalMedia, ...newlyAdded];
      setInternalMedia(nextMedia);
      setSuccessMsg('Photo(s) uploaded successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (onUpdateMedia) onUpdateMedia(nextMedia);
    } catch (err) {
      setErrorMsg(`Upload failed: ${err.message || 'Network error'}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Video Upload Handler
  const handleVideoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!propertyId) {
      setErrorMsg('Please complete step 1 (Basic Details) before uploading property media.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setUploadProgress(0);

    try {
      const newlyAdded = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const result = await uploadPropertyMediaFile(propertyId, ownerId, file, {
          mediaType: selectedVideoCategory,
          onProgress: (pct) => setUploadProgress(pct)
        });

        if (result.success && result.mediaItem) {
          newlyAdded.push(result.mediaItem);
        } else if (!result.success) {
          setErrorMsg(`Failed to upload video ${file.name}: ${result.error || 'Upload error'}`);
          return;
        }
      }

      const nextMedia = [...internalMedia, ...newlyAdded];
      setInternalMedia(nextMedia);
      setSuccessMsg('Video uploaded successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (onUpdateMedia) onUpdateMedia(nextMedia);
    } catch (err) {
      setErrorMsg(`Video upload failed: ${err.message || 'Network error'}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Video Link Handler (YouTube or Google Drive)
  const handleAddVideoLink = async () => {
    if (!videoLinkInput || !videoLinkInput.trim()) return;
    if (!propertyId) {
      setErrorMsg('Please complete step 1 (Basic Details) before attaching video links.');
      return;
    }

    setLinkingVideo(true);
    setErrorMsg(null);

    try {
      const result = await addPropertyVideoLink(propertyId, ownerId, videoLinkInput.trim(), {
        mediaType: selectedVideoCategory
      });

      if (result.success && result.mediaItem) {
        const nextMedia = [...internalMedia, result.mediaItem];
        setInternalMedia(nextMedia);
        setVideoLinkInput('');
        setSuccessMsg('Video link attached successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
        if (onUpdateMedia) onUpdateMedia(nextMedia);
      } else {
        setErrorMsg(result.error || 'Failed to attach video link.');
      }
    } catch (err) {
      setErrorMsg(`Link error: ${err.message}`);
    } finally {
      setLinkingVideo(false);
    }
  };

  // Remove Media Handler
  const handleRemoveMedia = async (mediaId) => {
    if (!propertyId || !mediaId) return;
    setErrorMsg(null);
    const nextMedia = internalMedia.filter(m => m.mediaId !== mediaId);
    setInternalMedia(nextMedia);
    if (onUpdateMedia) onUpdateMedia(nextMedia);

    const res = await removePropertyMediaFile(propertyId, ownerId, mediaId);
    if (res.success) {
      setSuccessMsg('Media item removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res.error);
    }
  };

  // Set Primary Photo Handler
  const handleSetPrimary = async (mediaId) => {
    if (!propertyId || !mediaId) return;
    setErrorMsg(null);
    const nextMedia = internalMedia.map(m => ({
      ...m,
      isPrimary: m.type === MediaType.PHOTO ? m.mediaId === mediaId : m.isPrimary
    }));
    setInternalMedia(nextMedia);
    if (onUpdateMedia) onUpdateMedia(nextMedia);

    const res = await setPrimaryPropertyPhoto(propertyId, ownerId, mediaId);
    if (res.success) {
      setSuccessMsg('Cover photo updated.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res.error);
    }
  };

  // Single-Step Move Photo Order Handler (Left / Right)
  const handleMovePhoto = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= photos.length) return;
    handlePhotoDrop(index, targetIndex);
  };

  // Drag & Drop Photo Reorder Handler
  const handlePhotoDrop = async (fromIdx, toIdx) => {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
    const newPhotos = [...photos];
    const [draggedItem] = newPhotos.splice(fromIdx, 1);
    newPhotos.splice(toIdx, 0, draggedItem);

    const nonPhotos = internalMedia.filter(m => m.type !== MediaType.PHOTO);
    const combined = [...newPhotos, ...nonPhotos];
    setInternalMedia(combined);
    if (onUpdateMedia) onUpdateMedia(combined);

    setDraggedPhotoIndex(null);
    setDragOverPhotoIndex(null);

    if (propertyId) {
      await updatePropertyMediaOrder(propertyId, ownerId, combined);
    }
  };

  // Single-Step Move Video Order Handler (Left / Right)
  const handleMoveVideo = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= videos.length) return;
    handleVideoDrop(index, targetIndex);
  };

  // Drag & Drop Video Reorder Handler
  const handleVideoDrop = async (fromIdx, toIdx) => {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
    const newVideos = [...videos];
    const [draggedItem] = newVideos.splice(fromIdx, 1);
    newVideos.splice(toIdx, 0, draggedItem);

    const nonVideos = internalMedia.filter(
      m => m.type !== MediaType.WALKTHROUGH_VIDEO && m.type !== MediaType.DRONE_VIDEO
    );
    const combined = [...nonVideos, ...newVideos];
    setInternalMedia(combined);
    if (onUpdateMedia) onUpdateMedia(combined);

    setDraggedVideoIndex(null);
    setDragOverVideoIndex(null);

    if (propertyId) {
      await updatePropertyMediaOrder(propertyId, ownerId, combined);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-brand-charcoal flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-yellow" />
            <span>Property Photos & Walkthrough Videos</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Attach high-quality photos, walkthrough videos, or drone aerial footage. Drag and drop media cards to reorder display sequence.
          </p>
        </div>
      </div>

      {/* ALERT & SUCCESS MESSAGES */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* UPLOADING PROGRESS BAR */}
      {uploading && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-brand-charcoal">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-brand-yellow animate-spin" />
              <span>Processing and uploading media file...</span>
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-yellow h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* SECTION 1: PROPERTY PHOTOS */}
      <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
              <Camera className="w-4 h-4 text-brand-yellow shrink-0" />
              <span>Property Photos</span>
              <span className="text-gray-500 font-bold font-mono">({photos.length} uploaded)</span>
            </h4>
            <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
              Max 10MB per photo (JPEG, PNG, WebP). Drag cards or use arrows to reposition. Designated primary photo serves as cover.
            </span>
          </div>

          <label className="cursor-pointer bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 shrink-0 transition-all">
            <Upload className="w-4 h-4" />
            <span>Upload Photos</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* EXPLICIT COVER PHOTO SELECTION BAR */}
        {photos.length > 1 && (
          <div className="p-3.5 bg-amber-50/90 border border-amber-300/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Star className="w-4.5 h-4.5 text-amber-600 fill-amber-500 shrink-0" />
              <div>
                <span className="block text-xs font-extrabold text-amber-950">Cover Photo Selection</span>
                <span className="block text-[11px] text-amber-800 font-medium">
                  Choose which image appears as the main thumbnail on property cards and search results.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-amber-900 shrink-0">Selected Cover:</span>
              <select
                value={photos.find(p => p.isPrimary)?.mediaId || (photos[0] && photos[0].mediaId) || ''}
                onChange={(e) => handleSetPrimary(e.target.value)}
                className="w-full sm:w-auto p-2 bg-white border border-amber-300 rounded-lg text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer shadow-sm"
              >
                {photos.map((photo, idx) => (
                  <option key={photo.mediaId || idx} value={photo.mediaId}>
                    Photo #{idx + 1} {photo.isPrimary ? '★ (Cover Photo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* PHOTO GRID WITH DRAG & DROP REPOSITIONING */}
        {photos.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 px-1">
              <span className="flex items-center gap-1">
                <Move className="w-3.5 h-3.5 text-amber-500" />
                <span>Drag photo cards to reorder display sequence</span>
              </span>
              <span>{photos.length} item{photos.length === 1 ? '' : 's'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((photo, idx) => {
                const isDragging = draggedPhotoIndex === idx;
                const isDragOver = dragOverPhotoIndex === idx;

                return (
                  <div
                    key={photo.mediaId || idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      setDraggedPhotoIndex(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverPhotoIndex !== idx) setDragOverPhotoIndex(idx);
                    }}
                    onDragLeave={() => setDragOverPhotoIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                      handlePhotoDrop(fromIdx, idx);
                    }}
                    className={`relative group bg-white rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing overflow-hidden flex flex-col justify-between ${
                      isDragging
                        ? 'opacity-40 border-dashed border-amber-500 scale-95'
                        : isDragOver
                        ? 'border-amber-500 ring-4 ring-amber-200 bg-amber-50 scale-[1.02] shadow-lg'
                        : photo.isPrimary
                        ? 'border-amber-400 ring-2 ring-amber-100 shadow-md'
                        : 'border-gray-200 hover:border-amber-300 hover:shadow-md'
                    }`}
                  >
                    {/* Top Drag Handle & Cover Badge Overlay */}
                    <div className="relative aspect-video bg-gray-100 overflow-hidden group/img">
                      <img
                        src={photo.publicUrl || photo.url}
                        alt={photo.fileName || `Photo #${idx + 1}`}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300 pointer-events-none"
                      />

                      {/* Drag Handle Icon */}
                      <div
                        className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white p-1 rounded-md shadow opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-grab"
                        title="Drag to reposition"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-amber-400" />
                      </div>

                      {/* Cover Photo Badge */}
                      {photo.isPrimary ? (
                        <span className="absolute top-1.5 left-1.5 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded shadow flex items-center gap-1">
                          <Star className="w-3 h-3 fill-slate-950" /> Cover Photo
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(photo.mediaId)}
                          className="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-sm text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1"
                        >
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Set Cover
                        </button>
                      )}

                      <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Bottom Action & Reorder Controls */}
                    <div className="p-2 bg-white flex items-center justify-between gap-1 border-t border-gray-100">
                      {photo.isPrimary ? (
                        <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Primary Cover
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(photo.mediaId)}
                          className="text-[10px] font-extrabold text-slate-700 hover:text-amber-900 bg-slate-100 hover:bg-amber-100 border border-slate-200 hover:border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
                        >
                          <Star className="w-3 h-3 text-amber-500" /> Set Cover
                        </button>
                      )}

                      {/* Reposition Arrows & Delete */}
                      <div className="flex items-center gap-0.5 ml-auto">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMovePhoto(idx, -1)}
                          title="Move Left"
                          className="p-1 text-gray-500 hover:text-amber-700 disabled:opacity-30 rounded hover:bg-amber-50"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={idx === photos.length - 1}
                          onClick={() => handleMovePhoto(idx, 1)}
                          title="Move Right"
                          className="p-1 text-gray-500 hover:text-amber-700 disabled:opacity-30 rounded hover:bg-amber-50"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(photo.mediaId)}
                          title="Delete Photo"
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded ml-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-white rounded-xl border border-gray-200 text-xs text-gray-500 text-center font-medium">
            No photos uploaded yet. Select high-resolution property photos to upload.
          </div>
        )}
      </div>

      {/* SECTION 2: WALKTHROUGH & DRONE VIDEOS */}
      <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2 flex-wrap">
              <Video className="w-4 h-4 text-brand-yellow shrink-0" />
              <span>Walkthrough & Drone Videos</span>
              <span className="text-gray-500 font-bold font-mono">({videos.length} added)</span>
            </h4>
            <p className="text-[11px] text-gray-500 font-medium">
              Attach YouTube / Google Drive links or upload MP4/WebM video files. Drag cards or use arrows to reposition.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={selectedVideoCategory}
              onChange={(e) => setSelectedVideoCategory(e.target.value)}
              className="p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-yellow focus:outline-none shadow-sm"
            >
              <option value={MediaType.WALKTHROUGH_VIDEO}>Walkthrough Video</option>
              <option value={MediaType.DRONE_VIDEO}>Drone / Aerial Video</option>
            </select>

            <label className="cursor-pointer bg-brand-charcoal hover:bg-black text-brand-yellow font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 shrink-0 transition-all">
              <Film className="w-4 h-4" />
              <span>Upload Video File</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                disabled={uploading}
                onChange={handleVideoUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* YOUTUBE / GOOGLE DRIVE LINK ATTACHMENT BOX */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2 shadow-sm">
          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <LinkIcon className="w-4 h-4 text-brand-yellow" />
            <span>Add YouTube or Google Drive Video Link</span>
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="url"
              placeholder="Paste YouTube link (e.g. https://youtu.be/...) or Google Drive preview link..."
              value={videoLinkInput}
              onChange={(e) => setVideoLinkInput(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-yellow focus:outline-none"
            />
            <button
              type="button"
              disabled={linkingVideo || !videoLinkInput.trim()}
              onClick={handleAddVideoLink}
              className="w-full sm:w-auto px-4 py-2.5 bg-brand-yellow hover:bg-brand-yellowHover text-brand-charcoal font-bold text-xs rounded-xl shadow-sm shrink-0 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{linkingVideo ? 'Attaching...' : 'Add Link'}</span>
            </button>
          </div>
        </div>

        {/* VIDEO GRID WITH DRAG & DROP REPOSITIONING */}
        {videos.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 px-1">
              <span className="flex items-center gap-1">
                <Move className="w-3.5 h-3.5 text-amber-500" />
                <span>Drag video cards to reorder display sequence</span>
              </span>
              <span>{videos.length} video{videos.length === 1 ? '' : 's'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videos.map((vid, idx) => {
                const isDragging = draggedVideoIndex === idx;
                const isDragOver = dragOverVideoIndex === idx;

                return (
                  <div
                    key={vid.mediaId || idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      setDraggedVideoIndex(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverVideoIndex !== idx) setDragOverVideoIndex(idx);
                    }}
                    onDragLeave={() => setDragOverVideoIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                      handleVideoDrop(fromIdx, idx);
                    }}
                    className={`bg-white rounded-xl border-2 transition-all p-3 space-y-2 cursor-grab active:cursor-grabbing ${
                      isDragging
                        ? 'opacity-40 border-dashed border-amber-500 scale-95'
                        : isDragOver
                        ? 'border-amber-500 ring-4 ring-amber-200 bg-amber-50 scale-[1.01] shadow-lg'
                        : 'border-gray-200 hover:border-amber-300 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Header Bar with Reorder Controls */}
                    <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="w-4 h-4 text-amber-500 shrink-0 cursor-grab" title="Drag to reorder" />
                        <Video className="w-4 h-4 text-brand-yellow shrink-0" />
                        <span className="truncate">{vid.type === MediaType.DRONE_VIDEO ? 'Drone Aerial Footage' : 'Walkthrough Video'}</span>
                        {vid.provider === 'youtube' && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                            <Youtube className="w-3 h-3" /> YouTube
                          </span>
                        )}
                        {vid.provider === 'gdrive' && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded shrink-0">
                            Google Drive
                          </span>
                        )}
                      </span>

                      {/* Reposition Buttons & Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveVideo(idx, -1)}
                          title="Move Left"
                          className="p-1 text-gray-500 hover:text-amber-700 disabled:opacity-30 rounded hover:bg-amber-50"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={idx === videos.length - 1}
                          onClick={() => handleMoveVideo(idx, 1)}
                          title="Move Right"
                          className="p-1 text-gray-500 hover:text-amber-700 disabled:opacity-30 rounded hover:bg-amber-50"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(vid.mediaId)}
                          title="Remove Video"
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded ml-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Embed Video Preview Canvas */}
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                      {vid.embedUrl ? (
                        <iframe
                          src={vid.embedUrl}
                          title={vid.fileName || 'Embedded Video'}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={vid.publicUrl || vid.url}
                          controls
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>

                    {/* Footer Info */}
                    <div className="text-[11px] font-mono text-gray-500 flex items-center justify-between pt-1">
                      <span className="truncate max-w-[200px] font-sans font-semibold text-gray-700">{vid.fileName || `Video #${idx + 1}`}</span>
                      {vid.publicUrl && (
                        <a
                          href={vid.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-charcoal hover:underline font-bold text-[10px] flex items-center gap-1 shrink-0"
                        >
                          <span>Open Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-white rounded-xl border border-gray-200 text-xs text-gray-500 text-center font-medium">
            No videos added yet. Paste a YouTube / Google Drive link above or upload a video file.
          </div>
        )}
      </div>
    </div>
  );
}
