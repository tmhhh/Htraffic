const FAVORITE_CAMERA_IDS = [
    '662b57471afb9c00172d9095',
    '63ae7759bfd3d90017e8f162',
    '63ae777cbfd3d90017e8f177',
    '63ae7893bfd3d90017e8f1e1',
    '5b19d34faf4ff60011d6ea52'
];

let allCameras = [];
let filteredCameras = [];
let refreshInterval = null;
let currentModalCamera = null;

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('camera-grid-container');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const districtSelect = document.getElementById('district-select');
    const btnFavorites = document.getElementById('btn-favorites');
    const countBadge = document.getElementById('camera-count-badge');
    const autoRefreshToggle = document.getElementById('auto-refresh');

    try {
        // Fetch cameras.json
        const res = await fetch('cameras.json');
        if (!res.ok) throw new Error('Không thể tải file cameras.json');
        
        allCameras = await res.json();
        
        if (allCameras.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Không tìm thấy camera nào.</p></div>';
            return;
        }

        // Initialize District Options
        populateDistricts(allCameras, districtSelect);

        // Set default filter to FAVORITES as requested
        districtSelect.value = 'FAVORITES';
        if (btnFavorites) btnFavorites.classList.add('active');
        applyFilter();

        // Setup Auto-refresh
        setupAutoRefresh(autoRefreshToggle.checked);
        autoRefreshToggle.addEventListener('change', (e) => {
            setupAutoRefresh(e.target.checked);
        });

        // Shortcut button for favorites
        if (btnFavorites) {
            btnFavorites.addEventListener('click', () => {
                if (districtSelect.value === 'FAVORITES') {
                    // Toggle off to show all
                    districtSelect.value = 'ALL';
                    btnFavorites.classList.remove('active');
                } else {
                    districtSelect.value = 'FAVORITES';
                    btnFavorites.classList.add('active');
                }
                applyFilter();
            });
        }

        // Search Input listener
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            clearSearchBtn.style.display = query ? 'block' : 'none';
            applyFilter();
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            applyFilter();
            searchInput.focus();
        });

        // District Select listener
        districtSelect.addEventListener('change', () => {
            if (btnFavorites) {
                btnFavorites.classList.toggle('active', districtSelect.value === 'FAVORITES');
            }
            applyFilter();
        });

    } catch (err) {
        console.error('Error loading cameras:', err);
        container.innerHTML = `<div class="empty-state" style="color: var(--accent-red);"><p>Lỗi tải dữ liệu camera: ${err.message}</p></div>`;
    }

    // Apply combined search & district filter
    function applyFilter() {
        const query = searchInput.value.trim().toLowerCase();
        const selectedDistrict = districtSelect.value;

        filteredCameras = allCameras.filter(cam => {
            let matchesDistrict = false;
            if (selectedDistrict === 'FAVORITES') {
                matchesDistrict = FAVORITE_CAMERA_IDS.includes(cam.id);
            } else if (selectedDistrict === 'ALL') {
                matchesDistrict = true;
            } else {
                matchesDistrict = (cam.district === selectedDistrict);
            }

            const matchesQuery = !query || 
                (cam.name && cam.name.toLowerCase().includes(query)) ||
                (cam.district && cam.district.toLowerCase().includes(query));
            return matchesDistrict && matchesQuery;
        });

        renderCameras(filteredCameras);
        updateCountBadge(filteredCameras.length, allCameras.length, selectedDistrict);
    }

    function updateCountBadge(visibleCount, totalCount, selectedDistrict) {
        if (selectedDistrict === 'FAVORITES') {
            countBadge.textContent = `Đang hiển thị ${visibleCount} camera yêu thích`;
        } else if (visibleCount === totalCount) {
            countBadge.textContent = `Hiển thị tất cả ${totalCount} camera`;
        } else {
            countBadge.textContent = `Đang hiển thị ${visibleCount} / ${totalCount} camera`;
        }
    }
});

// Populate district dropdown with camera counts
function populateDistricts(cameras, selectEl) {
    const counts = {};
    cameras.forEach(c => {
        const d = c.district || 'Khác';
        counts[d] = (counts[d] || 0) + 1;
    });

    const sortedDistricts = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'vi'));

    selectEl.innerHTML = `
        <option value="FAVORITES">⭐ Camera yêu thích (${FAVORITE_CAMERA_IDS.length} camera)</option>
        <option value="ALL">Tất cả quận huyện (${cameras.length} camera)</option>
    `;
    sortedDistricts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${d} (${counts[d]})`;
        selectEl.appendChild(opt);
    });
}

// Render cameras grouped by district
function renderCameras(cameras) {
    const container = document.getElementById('camera-grid-container');

    if (cameras.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Không có camera nào phù hợp với bộ lọc tìm kiếm.</p>
            </div>
        `;
        return;
    }

    // Group cameras by district
    const groups = {};
    cameras.forEach(cam => {
        const dist = cam.district || 'Khu vực khác';
        if (!groups[dist]) groups[dist] = [];
        groups[dist].push(cam);
    });

    const sortedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'vi'));

    let html = '';
    sortedGroupNames.forEach(distName => {
        const list = groups[distName];
        html += `
            <section class="district-section">
                <div class="district-header">
                    <h2 class="district-title">${distName}</h2>
                    <span class="district-badge">${list.length} camera</span>
                </div>
                <div class="camera-grid">
                    ${list.map(cam => createCameraCardHtml(cam)).join('')}
                </div>
            </section>
        `;
    });

    container.innerHTML = html;
}

// Helper to check if camera has a valid, non-bipbop video stream
function isValidVideoUrl(url) {
    return Boolean(url && typeof url === 'string' && url.startsWith('http') && !url.includes('bipbop'));
}

// Generate single camera card HTML
function createCameraCardHtml(cam) {
    const liveImgSrc = `https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=${cam.id}`;
    const safeName = escapeHtml(cam.name);
    const safeDist = escapeHtml(cam.district);
    const safeUrl = cam.url || '#';
    const hasVideo = isValidVideoUrl(cam.videoUrl);

    const isFav = FAVORITE_CAMERA_IDS.includes(cam.id);

    return `
        <div class="camera-card ${isFav ? 'favorite-card' : ''}" id="cam-card-${cam.id}" data-id="${cam.id}">
            <div class="card-header">
                <div class="card-title-group">
                    <div class="card-title" title="${safeName}">
                        ${isFav ? '<span class="fav-star-icon" title="Camera yêu thích">⭐</span> ' : ''}${safeName}
                    </div>
                    <div class="card-district">${safeDist}</div>
                </div>
                <div class="card-actions">
                    ${hasVideo ? `
                        <button class="card-btn video-btn" onclick="openModal('${cam.id}', 'video')" title="Phát video trực tiếp">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </button>
                    ` : ''}
                    <div class="live-indicator">
                        <span class="live-dot"></span>
                        LIVE
                    </div>
                    <button class="card-btn" onclick="openModal('${cam.id}', 'image')" title="Phóng to xem chi tiết">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <polyline points="9 21 3 21 3 15"></polyline>
                            <line x1="21" y1="3" x2="14" y2="10"></line>
                            <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                    </button>
                    <a href="${safeUrl}" target="_blank" class="card-btn" title="Mở trang xem riêng tab mới">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                </div>
            </div>
            <div class="image-container" onclick="openModal('${cam.id}', 'image')">
                <img class="camera-image" 
                     id="img-${cam.id}" 
                     src="${liveImgSrc}" 
                     loading="lazy" 
                     alt="${safeName}"
                     onerror="handleImageError(this, '${cam.id}')" />
                <div class="image-overlay-hover">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                    <span>Nhấn để xem chi tiết</span>
                </div>
                ${hasVideo ? `<span class="video-badge" style="position: absolute; top: 8px; left: 8px;">🎥 Video Live</span>` : ''}
                <div class="timestamp-badge" id="time-${cam.id}">Trực tiếp</div>
            </div>
        </div>
    `;
}

// Fallback for image loading error
function handleImageError(img, camId) {
    img.onerror = null;
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200"><rect width="360" height="200" fill="%231a1a24"/><text x="50%" y="45%" fill="%238e9cae" font-family="sans-serif" font-size="14" text-anchor="middle">Camera tạm ngắt kết nối</text><text x="50%" y="60%" fill="%23ff3366" font-family="sans-serif" font-size="12" text-anchor="middle">Đang chờ cập nhật...</text></svg>';
    const badge = document.getElementById(`time-${camId}`);
    if (badge) badge.textContent = 'Mất tín hiệu';
}

// Auto-refresh visible images
function setupAutoRefresh(enabled) {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    if (!enabled) return;

    // Refresh visible images every 5 seconds
    refreshInterval = setInterval(() => {
        const images = document.querySelectorAll('.camera-image');
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        images.forEach(img => {
            // Only refresh images that are currently in the viewport
            const rect = img.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const baseSrc = img.src.split('&t=')[0].split('?t=')[0];
                if (baseSrc.includes('ImageHandler.ashx')) {
                    img.src = `${baseSrc}&t=${Date.now()}`;
                    const camId = img.id.replace('img-', '');
                    const badge = document.getElementById(`time-${camId}`);
                    if (badge) badge.textContent = timeString;
                }
            }
        });

        // Also refresh active modal image if open in image mode
        const modal = document.getElementById('camera-modal');
        if (modal && modal.classList.contains('active') && currentModalCamera && currentModalMode === 'image') {
            const modalImg = document.getElementById('modal-image');
            if (modalImg) {
                modalImg.src = `https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=${currentModalCamera.id}&t=${Date.now()}`;
            }
        }
    }, 5000);
}

// Global HLS stream & Modal state
let hlsInstance = null;
let currentModalMode = 'image';

// Modal functions
function openModal(camId, initialMode = 'image') {
    const cam = allCameras.find(c => c.id === camId);
    if (!cam) return;

    currentModalCamera = cam;
    const modal = document.getElementById('camera-modal');
    document.getElementById('modal-title').textContent = cam.name;
    document.getElementById('modal-district').textContent = cam.district || 'TP. Hồ Chí Minh';
    document.getElementById('modal-open-link').href = cam.url || `https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=${cam.id}&camLocation=${encodeURIComponent(cam.name)}&camMode=camera`;
    
    // Direct stream link button & mode switch
    const streamLinkBtn = document.getElementById('modal-stream-link');
    const modeSwitch = document.getElementById('modal-mode-switch');
    const hasVideo = isValidVideoUrl(cam.videoUrl);

    if (modeSwitch) {
        modeSwitch.style.display = hasVideo ? 'inline-flex' : 'none';
    }

    if (hasVideo) {
        streamLinkBtn.href = cam.videoUrl;
        streamLinkBtn.style.display = 'inline-flex';
        document.getElementById('video-direct-link').href = cam.videoUrl;
    } else {
        streamLinkBtn.style.display = 'none';
        if (initialMode === 'video') initialMode = 'image';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Switch to initial mode
    switchModalMode(initialMode);
}

function switchModalMode(mode) {
    currentModalMode = mode;
    const btnImage = document.getElementById('btn-mode-image');
    const btnVideo = document.getElementById('btn-mode-video');
    const modalImg = document.getElementById('modal-image');
    const modalVideo = document.getElementById('modal-video');
    const videoLoading = document.getElementById('video-loading');
    const videoError = document.getElementById('video-error');

    // Reset error & loading
    videoError.style.display = 'none';
    videoLoading.style.display = 'none';

    if (mode === 'image') {
        btnImage.classList.add('active');
        btnVideo.classList.remove('active');

        // Stop video
        stopHlsStream();
        modalVideo.style.display = 'none';

        // Show image
        modalImg.style.display = 'block';
        if (currentModalCamera) {
            modalImg.src = `https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=${currentModalCamera.id}&t=${Date.now()}`;
        }
    } else if (mode === 'video') {
        btnVideo.classList.add('active');
        btnImage.classList.remove('active');

        // Hide image
        modalImg.style.display = 'none';

        if (!currentModalCamera || !isValidVideoUrl(currentModalCamera.videoUrl)) {
            document.getElementById('video-error-msg').textContent = 'Camera này hiện chưa có luồng video trực tiếp từ sở GTVT. Bạn có thể xem hình ảnh chụp trực tiếp tự động làm mới.';
            videoError.style.display = 'flex';
            return;
        }

        // Show video & loading
        modalVideo.style.display = 'block';
        videoLoading.style.display = 'flex';
        document.getElementById('video-loading-text').textContent = 'Đang kết nối luồng video trực tiếp...';

        playHlsStream(currentModalCamera.videoUrl);
    }
}

function playHlsStream(streamUrl) {
    const modalVideo = document.getElementById('modal-video');
    const videoLoading = document.getElementById('video-loading');
    const videoError = document.getElementById('video-error');
    const errorMsg = document.getElementById('video-error-msg');

    stopHlsStream();

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 2
        });

        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(modalVideo);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            videoLoading.style.display = 'none';
            modalVideo.play().catch(err => {
                console.log('Autoplay deferred by browser:', err);
            });
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.warn('HLS Fatal Error:', data.type, data.details);
                videoLoading.style.display = 'none';
                errorMsg.textContent = `Không thể kết nối luồng video (${data.details}). Bạn có thể nhấn Mở luồng để xem trực tiếp hoặc chuyển về ảnh trực tiếp.`;
                videoError.style.display = 'flex';
                stopHlsStream();
            }
        });
    } else if (modalVideo.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari HLS
        modalVideo.src = streamUrl;
        modalVideo.addEventListener('loadedmetadata', () => {
            videoLoading.style.display = 'none';
            modalVideo.play().catch(err => console.log('Autoplay deferred:', err));
        }, { once: true });

        modalVideo.addEventListener('error', (e) => {
            videoLoading.style.display = 'none';
            errorMsg.textContent = 'Trình duyệt không thể phát luồng video này. Bạn có thể nhấn Mở luồng để xem trực tiếp.';
            videoError.style.display = 'flex';
        }, { once: true });
    } else {
        videoLoading.style.display = 'none';
        errorMsg.textContent = 'Trình duyệt không hỗ trợ chuẩn phát luồng HLS (.m3u8).';
        videoError.style.display = 'flex';
    }
}

function stopHlsStream() {
    const modalVideo = document.getElementById('modal-video');
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    if (modalVideo) {
        modalVideo.pause();
        modalVideo.removeAttribute('src');
        modalVideo.load();
    }
}

function closeModal() {
    const modal = document.getElementById('camera-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    stopHlsStream();
    currentModalCamera = null;
    currentModalMode = 'image';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}
