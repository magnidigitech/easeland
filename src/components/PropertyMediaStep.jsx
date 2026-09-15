import React, { useState, useEffect } from 'react';
import { Camera, Video, Upload, Trash2, Star, ArrowUp, ArrowDown, RefreshCw, CheckCircle2, AlertCircle, Film, Link as LinkIcon, PlusCircle, ExternalLink, Youtube } from 'lucide-react';
import { MediaType, MediaStatus } from '../firebase/schema.js';
import { uploadPropertyMediaFile, removePropertyMediaFile, setPrimaryPropertyPhoto, updatePropertyMediaOrder, addPropertyVideoLink } from '../firebase/mediaService.js';

export default function PropertyMediaStep({ propertyId, ownerId, mediaList = [], onUpdateMedia }) {
  const [internalMedia, setInternalMedia] = useState(mediaList || []);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideoCategory, setSelectedVideoCategory] = useState(MediaType.WALKTHROUGH_VIDEO);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [linkingVideo, setLinkingVideo] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Sync internal state when parent props update
  useEffect(() => {
    if (Array.isArray(mediaList)) {
      setInternalMedia(mediaList);
    }
  }, [mediaList]);

  // Filter photos and videos from internal state
  const photos = internalMedia.filter(item => item && item.type === MediaType.PHOTO);
  const videos = internalMedia.filter(item => item && (item.type === MediaType.WALKTHROUGH_VIDEO || item.type === MediaType.DRONE_VIDEO));

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
      setSuccessMsg('Photo(s) uploaded successfully. Saved for listing preview.');
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
      setSuccessMsg('Video uploaded successfully. Saved for listing preview.');
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

  // Move Photo Order Handler
  const handleMovePhoto = async (index, direction) => {
    const newPhotos = [...photos];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newPhotos.length) return;

    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[targetIndex];
    newPhotos[targetIndex] = temp;

    const nonPhotos = internalMedia.filter(m => m.type !== MediaType.PHOTO);
    const combined = [...newPhotos, ...nonPhotos];
    setInternalMedia(combined);
    if (onUpdateMedia) onUpdateMedia(combined);

    const res = await updatePropertyMediaOrder(propertyId, ownerId, combined);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-brand-charcoal flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-yellow" />
            <span>Property Photos & Walkthrough Videos</span>
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Attach high-quality photos, walkthrough videos, or drone aerial footage.
          </p>
        </div>
      </div>

      {/* ALERT & SUCCESS MESSAGES */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* UPLOADING PROGRESS BAR */}
      {uploading && (
        <div className="p-4 bg-brand-yellow/10 border border-brand-yellow/30 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-brand-charcoal">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-brand-yellow animate-spin" />
              <span>Processing and uploading media item...</span>
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
              Max 10MB per photo (JPEG, PNG, WebP). Designated primary photo serves as cover.
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

        {/* PHOTO GRID */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
            {photos.map((photo, idx) => (
              <div key={photo.mediaId || idx} className="relative group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col justify-between">
                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                  <img
                    src={photo.publicUrl || photo.url}
                    alt={photo.fileName || `Photo #${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {photo.isPrimary && (
                    <span className="absolute top-2 left-2 bg-brand-yellow text-brand-charcoal text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" /> Cover Photo
                    </span>
                  )}

                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                </div>

                <div className="p-2 bg-white flex items-center justify-between gap-1 border-t border-gray-100">
                  {!photo.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(photo.mediaId)}
                      className="text-[10px] font-bold text-gray-600 hover:text-brand-charcoal hover:bg-gray-100 px-2 py-1 rounded"
                    >
                      Set Cover
                    </button>
                  )}

                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMovePhoto(idx, -1)}
                      className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === photos.length - 1}
                      onClick={() => handleMovePhoto(idx, 1)}
                      className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(photo.mediaId)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
              Attach YouTube / Google Drive links or upload MP4/WebM video files.
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
              <span>Upload File</span>
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
        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
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

        {/* VIDEO GRID */}
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {videos.map((vid, idx) => (
              <div key={vid.mediaId || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-brand-yellow" />
                    <span>{vid.type === MediaType.DRONE_VIDEO ? 'Drone Aerial Footage' : 'Walkthrough Video'}</span>
                    {vid.provider === 'youtube' && (
                      <span className="text-[10px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Youtube className="w-3 h-3" /> YouTube
                      </span>
                    )}
                    {vid.provider === 'gdrive' && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded">
                        Google Drive
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(vid.mediaId)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="aspect-video bg-black rounded-lg overflow-hidden">
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

                <div className="text-[11px] font-mono text-gray-500 flex items-center justify-between">
                  <span className="truncate max-w-[200px]">{vid.fileName}</span>
                  {vid.publicUrl && (
                    <a
                      href={vid.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-charcoal hover:underline font-bold text-[10px] flex items-center gap-1"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
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
