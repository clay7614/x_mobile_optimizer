/**
 * animator.js
 * Adds micro-interactions and animations to X mobile web.
 */

console.log('X Animator: Loaded');

const ANIMATION_CONFIG = {
    enableAnimations: true
};

function initAnimator() {
    chrome.storage.local.get(['animationConfig'], (result) => {
        if (result.animationConfig) {
            Object.assign(ANIMATION_CONFIG, result.animationConfig);
        }
        if (ANIMATION_CONFIG.enableAnimations) {
            injectAnimationStyles();
            attachInteractionListeners();
            startAnimationObserver();

            // Show timeline overlay immediately on /home if loading
            if (window.location.pathname.endsWith('/home')) {
                showTimelineOverlay();
            }
        }
    });
}

function injectAnimationStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* Fade In Effect */
    .x-fade-in {
      animation: x-fade-in-anim 0.4s ease-out forwards;
      opacity: 0; 
    }
    
    @keyframes x-fade-in-anim {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Press Scale Effect */
    .x-press-active {
        transform: scale(0.97);
        transition: transform 0.1s ease-out;
    }
    .x-press-target {
        transition: transform 0.2s ease-out;
    }

    /* DOM-based Skeleton Loading (Restored) */
    .x-skeleton-container {
        position: relative;
        overflow: hidden;
    }
    
    .x-skeleton-wrapper {
        width: 100%;
        /* Ensure it sits above any residual content */
        z-index: 10;
        /* Ensure it covers the spinner */
        position: relative; 
        background-color: rgb(0, 0, 0); /* Match theme background to cover spinner */
    }

    /* Important: Hide the original spinner when skeleton is active */
    .x-skeleton-container [role="progressbar"] {
        opacity: 0 !important;
        visibility: hidden !important;
    }

    .x-skeleton-card {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        margin-bottom: 2px;
        position: relative;
        overflow: hidden;
    }

    .x-skeleton-card::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
        background-size: 200% 100%;
        animation: x-shimmer 1.5s infinite;
    }

    @keyframes x-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }

    /* Timeline Overlay Skeleton (for /home only) */
    .x-timeline-skeleton-overlay {
        position: absolute;
        top: 180px; /* Skip header and compose area */
        left: 0;
        width: 100%;
        min-height: calc(100% - 180px);
        background: rgb(0, 0, 0);
        z-index: 2000;
        overflow-y: hidden;
        box-sizing: border-box;
        transition: opacity 0.3s ease-out;
    }
    .x-timeline-skeleton-overlay.x-hiding {
        opacity: 0;
        pointer-events: none;
    }
    /* Ensure primaryColumn can contain the overlay */
    [data-testid="primaryColumn"] {
        position: relative !important;
    }



    /* Modal & Image Zoom Animations */
    .x-zoom-in {
        animation: x-zoom-in-anim 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        transform-origin: center;
    }
    
    .x-modal-zoom {
        /* Only animate opacity to avoid breaking X's centering transforms */
        animation: x-modal-zoom-anim 0.2s ease-out forwards;
    }

    @keyframes x-zoom-in-anim {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }

    @keyframes x-modal-zoom-anim {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    /* Custom Lightbox */
    .x-lightbox {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 1);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.3s ease, opacity 0.3s ease;
        opacity: 0;
        touch-action: none;
    }
    .x-lightbox.active { opacity: 1; }
    
    .x-lightbox-track {
        display: flex;
        height: 100%;
        width: 100%;
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        will-change: transform;
    }
    
    .x-lightbox-img-wrapper {
        width: 100vw;
        height: 100vh;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .x-lightbox-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        width: auto;
        height: auto;
        user-select: none;
        -webkit-user-drag: none;
    }
    `;
    document.head.appendChild(style);
}

let isBackNavigation = false;
let isProgrammaticBack = false;
let backNavTimeout;

function triggerBackNav() {
    isBackNavigation = true;
    if (backNavTimeout) clearTimeout(backNavTimeout);
    backNavTimeout = setTimeout(() => {
        isBackNavigation = false;
    }, 1000);
}

// Timeline Overlay Skeleton System (for /home only)
let timelineOverlayActive = false;
let hasTimelineContent = false; // Prevent race conditions

function showTimelineOverlay() {
    if (timelineOverlayActive) return;
    if (hasTimelineContent) return; // Don't show if content already appeared
    if (!window.location.pathname.endsWith('/home')) return;

    // Check if already has content
    const existingTweets = document.querySelectorAll('[data-testid="tweet"]');
    if (existingTweets.length > 2) {
        hasTimelineContent = true;
        return;
    }

    // Wait for primaryColumn to exist - do not use body fallback
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (!primaryColumn) {
        // Retry after a short delay
        setTimeout(() => showTimelineOverlay(), 100);
        return;
    }

    // RE-CHECK: Tweets may have loaded while waiting for primaryColumn
    const tweetsNow = document.querySelectorAll('[data-testid="tweet"]');
    if (tweetsNow.length > 0) {
        hasTimelineContent = true;
        return; // Tweets loaded during wait, don't show overlay
    }

    const overlay = document.createElement('div');
    overlay.className = 'x-timeline-skeleton-overlay';
    overlay.id = 'x-timeline-skeleton-overlay';

    const wrapper = document.createElement('div');
    wrapper.className = 'x-skeleton-wrapper';

    for (let i = 0; i < 10; i++) {
        const card = document.createElement('div');
        card.className = 'x-skeleton-card';
        const height = Math.floor(Math.random() * (400 - 150 + 1)) + 150;
        card.style.height = `${height}px`;
        wrapper.appendChild(card);
    }

    overlay.appendChild(wrapper);
    primaryColumn.appendChild(overlay);
    timelineOverlayActive = true;
}

function hideTimelineOverlay() {
    const overlay = document.getElementById('x-timeline-skeleton-overlay');
    if (overlay) {
        overlay.classList.add('x-hiding');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
    timelineOverlayActive = false;
}

// Custom Lightbox Logic
let activeLightbox = null;
let lightboxTrack = null;
let imageList = [];
let currentImageIndex = 0;

// Gesture state
let gestureStartX = 0;
let gestureStartY = 0;
let trackStartX = 0;
let gestureStartTime = 0;
let isDraggingX = false;
let isDraggingY = false;

// Zoom & Pan state
let currentScale = 1;
let initialPinchDistance = 0;
let initialPinchScale = 1;
let pinchCenterX = 0;
let pinchCenterY = 0;
let isPinching = false;
let panOffsetX = 0;
let panOffsetY = 0;
let startPanX = 0;
let startPanY = 0;

function collectImages(startImg) {
    const allImages = Array.from(document.querySelectorAll('img[src*="pbs.twimg.com/media"]'));
    const seen = new Set();
    imageList = [];
    allImages.forEach(img => {
        if (!seen.has(img.src)) {
            seen.add(img.src);
            imageList.push({
                src: img.src,
                highRes: img.src.replace(/name=\w+/, 'name=large'),
                element: img
            });
        }
    });

    currentImageIndex = imageList.findIndex(item => item.src === startImg.src);
    if (currentImageIndex === -1) {
        imageList = [{ src: startImg.src, highRes: startImg.src.replace(/name=\w+/, 'name=large') }];
        currentImageIndex = 0;
    }
}

function openLightbox(sourceImg) {
    if (activeLightbox) return;
    collectImages(sourceImg);
    history.pushState({ x_lightbox: true }, '', '');

    const lightbox = document.createElement('div');
    lightbox.className = 'x-lightbox';

    const track = document.createElement('div');
    track.className = 'x-lightbox-track';

    imageList.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'x-lightbox-img-wrapper';

        const img = document.createElement('img');
        img.className = 'x-lightbox-img';

        if (Math.abs(index - currentImageIndex) <= 1) {
            img.src = item.highRes;
        } else {
            img.dataset.src = item.highRes;
        }

        wrapper.appendChild(img);
        track.appendChild(wrapper);
    });

    lightbox.appendChild(track);
    document.body.appendChild(lightbox);

    activeLightbox = lightbox;
    lightboxTrack = track;

    track.style.transition = 'none';
    updateTrackPosition();

    lightbox.getBoundingClientRect(); // Reflow

    setTimeout(() => {
        lightbox.classList.add('active');
        track.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }, 10);

    lightbox.addEventListener('touchstart', onTouchStart, { passive: false });
    lightbox.addEventListener('touchmove', onTouchMove, { passive: false });
    lightbox.addEventListener('touchend', onTouchEnd, { passive: false });
}

function updateTrackPosition() {
    if (!lightboxTrack) return;
    const translateX = -(currentImageIndex * 100);
    lightboxTrack.style.transform = `translateX(${translateX}vw)`;
    loadNearbyImages();
}

function loadNearbyImages() {
    if (!lightboxTrack) return;
    const slides = lightboxTrack.children;
    for (let i = -1; i <= 1; i++) {
        const idx = currentImageIndex + i;
        if (idx >= 0 && idx < slides.length) {
            const img = slides[idx].querySelector('img');
            if (img && img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
            }
        }
    }
}

function onTouchStart(e) {
    if (e.touches.length === 1) {
        gestureStartX = e.touches[0].clientX;
        gestureStartY = e.touches[0].clientY;
        gestureStartTime = Date.now();

        trackStartX = -(currentImageIndex * window.innerWidth);
        isDraggingX = false;
        isDraggingY = false;
        isPinching = false;

        if (currentScale > 1) {
            startPanX = panOffsetX;
            startPanY = panOffsetY;
        }

        if (lightboxTrack) {
            lightboxTrack.style.transition = 'none';
            const slides = Array.from(lightboxTrack.children);
            slides.forEach((child, idx) => {
                if (idx !== currentImageIndex) {
                    child.style.transition = 'none';
                    child.style.transform = '';
                }
            });
        }
    } else if (e.touches.length === 2 && activeLightbox) {
        isPinching = true;
        isDraggingX = false;
        isDraggingY = false;

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        initialPinchScale = currentScale;

        // Record initial pinch center relative to screen center (transform origin)
        pinchCenterX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (window.innerWidth / 2);
        pinchCenterY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (window.innerHeight / 2);

        startPanX = panOffsetX;
        startPanY = panOffsetY;
    }
}

function onTouchMove(e) {
    if (!activeLightbox || !lightboxTrack) return;
    e.preventDefault();

    if (e.touches.length === 2 && isPinching) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);

        const scaleChange = distance / initialPinchDistance;
        const newScale = Math.min(Math.max(1, initialPinchScale * scaleChange), 4);

        // Calculate current pinch center relative to screen center
        const currentPinchX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (window.innerWidth / 2);
        const currentPinchY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (window.innerHeight / 2);

        // Update pan based on current center, creating a natural feel (zoom around fingers + dragging)
        // Formula: newPan = currentCenter - (startCenter - startPan) * (newScale / startScale)
        panOffsetX = currentPinchX - (pinchCenterX - startPanX) * (newScale / initialPinchScale);
        panOffsetY = currentPinchY - (pinchCenterY - startPanY) * (newScale / initialPinchScale);
        currentScale = newScale;

        const currentSlide = lightboxTrack.children[currentImageIndex];
        if (currentSlide) {
            const img = currentSlide.querySelector('img');
            if (img) {
                img.style.transition = 'none';
                img.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${currentScale})`;
            }
        }
        return;
    }

    if (e.touches.length !== 1) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - gestureStartX;
    const deltaY = currentY - gestureStartY;

    if (currentScale > 1) {
        // Panning when zoomed
        panOffsetX = startPanX + deltaX;
        panOffsetY = startPanY + deltaY;

        const currentSlide = lightboxTrack.children[currentImageIndex];
        if (currentSlide) {
            const img = currentSlide.querySelector('img');
            if (img) {
                img.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${currentScale})`;
            }
        }
        return;
    }

    if (!isDraggingX && !isDraggingY) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isDraggingX = true;
        } else if (Math.abs(deltaY) > 10) {
            isDraggingY = true;
        }
    }

    if (isDraggingY) {
        const scale = Math.max(0.6, 1 - Math.abs(deltaY) / 1000);
        const currentTrackX = -(currentImageIndex * window.innerWidth);

        lightboxTrack.style.transform = `translateX(${currentTrackX}px)`;

        const currentSlide = lightboxTrack.children[currentImageIndex];
        if (currentSlide) {
            currentSlide.style.transform = `translate(0px, ${deltaY}px) scale(${scale})`;
        }

        const opacity = Math.max(0, 1 - Math.abs(deltaY) / 500);
        activeLightbox.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    }
    else if (isDraggingX) {
        const currentTrackX = -(currentImageIndex * window.innerWidth);
        let newX = currentTrackX + deltaX;

        // Resistance
        if ((currentImageIndex === 0 && deltaX > 0) ||
            (currentImageIndex === imageList.length - 1 && deltaX < 0)) {
            newX = currentTrackX + (deltaX * 0.4);
        }

        lightboxTrack.style.transform = `translateX(${newX}px)`;
    }
}

function onTouchEnd(e) {
    if (!activeLightbox || !lightboxTrack) return;

    if (isPinching) {
        const currentSlide = lightboxTrack.children[currentImageIndex];
        if (currentSlide) {
            const img = currentSlide.querySelector('img');
            if (img) {
                const transform = img.style.transform;
                const match = transform.match(/scale\(([^)]+)\)/);
                if (match) {
                    currentScale = parseFloat(match[1]);
                }

                if (currentScale <= 1.05) {
                    resetZoomAndPan(img);
                }
            }
        }
        isPinching = false;
        return;
    }

    if (currentScale > 1) {
        // Just finished panning
        return;
    }

    const currentX = e.changedTouches[0].clientX;
    const currentY = e.changedTouches[0].clientY;
    const deltaX = currentX - gestureStartX;
    const deltaY = currentY - gestureStartY;

    const duration = Date.now() - gestureStartTime;
    const velocityX = Math.abs(deltaX) / duration;
    const velocityY = Math.abs(deltaY) / duration;

    lightboxTrack.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

    if (isDraggingY) {
        // Increased min distance for flick to 60px
        if (Math.abs(deltaY) > 80 || (velocityY > 0.5 && Math.abs(deltaY) > 60)) {
            closeLightbox(false);
        } else {
            activeLightbox.style.backgroundColor = 'rgba(0, 0, 0, 1)';
            const currentSlide = lightboxTrack.children[currentImageIndex];
            if (currentSlide) {
                void currentSlide.offsetHeight;
                currentSlide.style.transition = 'transform 0.35s cubic-bezier(0.15, 0.9, 0.3, 1.0)';
                currentSlide.style.transform = '';
            }
            updateTrackPosition();
        }
    }
    else if (isDraggingX) {
        const threshold = 50;
        const isNext = (deltaX < -threshold) || (velocityX > 0.5 && deltaX < -50);
        const isPrev = (deltaX > threshold) || (velocityX > 0.5 && deltaX > 50);

        if (isNext && currentImageIndex < imageList.length - 1) {
            currentImageIndex++;
        } else if (isPrev && currentImageIndex > 0) {
            currentImageIndex--;
        }
        updateTrackPosition();
    }

    isDraggingX = false;
    isDraggingY = false;
}

function resetZoomAndPan(img) {
    if (!img) return;
    img.style.transition = 'transform 0.3s ease-out';
    img.style.transform = 'scale(1) translate(0px, 0px)';
    currentScale = 1;
    panOffsetX = 0;
    panOffsetY = 0;
}

function closeLightbox(fromHistory = false) {
    if (!activeLightbox) return;

    // Animate out immediately to avoid lag
    const targetLightbox = activeLightbox;

    // Allow background interaction
    targetLightbox.classList.remove('active');
    targetLightbox.style.pointerEvents = 'none';

    if (lightboxTrack && lightboxTrack.children[currentImageIndex]) {
        const slide = lightboxTrack.children[currentImageIndex];
        const originalItem = imageList[currentImageIndex];

        let targetTransform = 'scale(0.8)'; // Fallback

        if (originalItem && originalItem.element) {
            const rect = originalItem.element.getBoundingClientRect();
            // Check if roughly on screen/valid
            if (rect.width > 0 && rect.height > 0 && rect.top > -window.innerHeight && rect.top < window.innerHeight * 2) {
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const origCenterX = rect.left + rect.width / 2;
                const origCenterY = rect.top + rect.height / 2;
                const moveX = origCenterX - centerX;
                const moveY = origCenterY - centerY;
                // Approximation scale
                const scale = Math.max(0.1, rect.width / window.innerWidth);

                targetTransform = `translate(${moveX}px, ${moveY}px) scale(${scale})`;
            }
        }

        // Apply smooth exit
        slide.style.transition = 'transform 1s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1s ease';
        slide.style.transform = targetTransform;
        slide.style.opacity = '0';
    }

    // Reset state immediately
    activeLightbox = null;
    lightboxTrack = null;

    // Manage History behind the scenes if this wasn't called by history nav
    if (!fromHistory) {
        isProgrammaticBack = true;
        history.back();
    }

    setTimeout(() => {
        if (targetLightbox) targetLightbox.remove();
    }, 1000);
}

function attachInteractionListeners() {
    window.addEventListener('popstate', (e) => {
        if (isProgrammaticBack) {
            isProgrammaticBack = false;
            return;
        }

        if (activeLightbox) {
            closeLightbox(true);
            return;
        }
        triggerBackNav();
    });

    document.addEventListener('click', (e) => {
        const target = e.target;

        // Image Viewer Trigger
        if (target.tagName === 'IMG' && target.src.includes('pbs.twimg.com/media')) {
            const link = target.closest('a');
            if (link && link.href.includes('/photo/') && !link.closest('[role="dialog"]')) {
                e.preventDefault();
                e.stopPropagation();
                openLightbox(target);
                return;
            }
        }

        // Back Button Trigger
        if (target.closest('[data-testid="app-bar-back-button"]')) {
            triggerBackNav();
            return;
        }



        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('div[role="button"], a, button, [data-testid="tweet"], [data-testid="like"], [data-testid="retweet"], [data-testid="reply"], [data-testid="file-image"]');
            if (target) {
                target.classList.add('x-press-target');
                target.classList.add('x-press-active');
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const target = e.target.closest('.x-press-target');
            if (target) target.classList.remove('x-press-active');
        }, { passive: true });

        document.addEventListener('touchcancel', (e) => {
            const target = e.target.closest('.x-press-target');
            if (target) target.classList.remove('x-press-active');
        }, { passive: true });
    }, true);
}
const animObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
                const testId = node.getAttribute('data-testid');
                const role = node.getAttribute('role');

                if (role === 'dialog' || testId === 'sheetDialog' || node.querySelector('[role="dialog"]')) {
                    const dialog = role === 'dialog' ? node : node.querySelector('[role="dialog"]');
                    if (dialog) {
                        if (dialog.querySelector('[data-testid="swipe-to-dismiss"]') || dialog.querySelector('img[draggable="true"]')) {
                            dialog.classList.add('x-zoom-in');
                        } else {
                            dialog.classList.add('x-modal-zoom');
                            // Prevent auto-focus on compose modal
                            // Attempt to blur the text area if it grabs focus
                            setTimeout(() => {
                                const activeInput = dialog.querySelector('[contenteditable="true"], textarea, input');
                                if (activeInput) {
                                    activeInput.blur();
                                }
                            }, 50);
                            setTimeout(() => {
                                const activeInput = dialog.querySelector('[contenteditable="true"], textarea, input');
                                if (activeInput && document.activeElement === activeInput) {
                                    activeInput.blur();
                                }
                            }, 300);
                        }
                    }
                }
                else if (testId === 'primaryColumn' || (role === 'main' && node.querySelector('[data-testid="primaryColumn"]'))) {
                    const target = testId === 'primaryColumn' ? node : node.querySelector('[data-testid="primaryColumn"]');
                    if (target) {
                        // Show timeline overlay on /home
                        if (window.location.pathname.endsWith('/home')) {
                            showTimelineOverlay();
                        }
                    }
                }
                else if (testId === 'cellInnerDiv') {
                    const progressBar = node.querySelector('[role="progressbar"]');
                    if (progressBar) {
                        enableSkeleton(node);
                    } else {
                        disableSkeleton(node);
                        const content = node.firstElementChild;
                        if (content) content.classList.add('x-fade-in');

                        // Hide timeline overlay if content is present on /home
                        if (window.location.pathname.endsWith('/home') && timelineOverlayActive) {
                            hideTimelineOverlay();
                        }
                    }
                }
                // NEW: Catch cases where spinner is added LATER into an existing cell
                else if (role === 'progressbar' || (node.querySelector && node.querySelector('[role="progressbar"]'))) {
                    const progressBar = role === 'progressbar' ? node : node.querySelector('[role="progressbar"]');

                    // Priority 1: Tweel Cell
                    const cell = progressBar.closest('[data-testid="cellInnerDiv"]');
                    if (cell) {
                        enableSkeleton(cell);
                    }
                    // Priority 2: Generic Page Loader (e.g. Profile, Notifications initial load)
                    else {
                        const primaryCol = progressBar.closest('[data-testid="primaryColumn"]');
                        if (primaryCol) {
                            // NEW: On /home, we use the overlay for INITIAL load, so HIDE the original main spinner
                            if (window.location.pathname.endsWith('/home') && timelineOverlayActive) {
                                progressBar.style.opacity = '0';
                                return;
                            }

                            // Find a suitable container locally
                            const container = progressBar.parentElement;
                            if (container && container.tagName === 'DIV' && !container.classList.contains('x-skeleton-container')) {
                                // ensure it's not a small button loader
                                const rect = progressBar.getBoundingClientRect();
                                // If spinner is reasonably large or in a large container
                                if (rect.width > 20 || container.offsetHeight > 100) {
                                    enableSkeleton(container);
                                }
                            }
                        }
                    }
                }
                else if (testId === 'tweet' || (node.querySelector && node.querySelector('[data-testid="tweet"]'))) {
                    const tweetNode = testId === 'tweet' ? node : node.querySelector('[data-testid="tweet"]');
                    if (tweetNode) {
                        hasTimelineContent = true; // Mark content as loaded
                        tweetNode.classList.add('x-fade-in');
                        // Clean up parent skeleton if it exists
                        const parentCell = tweetNode.closest('div[data-testid="cellInnerDiv"]');
                        if (parentCell) {
                            disableSkeleton(parentCell);
                        }
                        // Hide timeline overlay if on /home
                        if (window.location.pathname.endsWith('/home') && timelineOverlayActive) {
                            hideTimelineOverlay();
                        }
                    }
                }
            }
        }
    }
});

function enableSkeleton(cell) {
    if (cell.classList.contains('x-skeleton-container')) return;

    // Strict safety check: Disable on status pages to prevent React conflicts
    if (window.location.pathname.includes('/status/')) return;

    // For /home, we use overlay for initial load, but DOM skeletons for infinite scroll
    if (window.location.pathname.endsWith('/home') && timelineOverlayActive) return;

    if (cell.querySelector('[data-testid="tweet"]')) return;

    cell.classList.add('x-skeleton-container');

    const wrapper = document.createElement('div');
    wrapper.className = 'x-skeleton-wrapper';

    // Create random cards to simulate feed
    for (let i = 0; i < 40; i++) {
        const card = document.createElement('div');
        card.className = 'x-skeleton-card';
        const height = Math.floor(Math.random() * (600 - 200 + 1)) + 200;
        card.style.height = `${height}px`;
        wrapper.appendChild(card);
    }

    cell.appendChild(wrapper);
}

function disableSkeleton(cell) {
    if (cell.classList.contains('x-skeleton-container')) {
        cell.classList.remove('x-skeleton-container');
        const wrapper = cell.querySelector('.x-skeleton-wrapper');
        if (wrapper) wrapper.remove();
    }
}

function startAnimationObserver() {
    const targetNode = document.body;
    if (!targetNode) return;
    animObserver.observe(targetNode, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimator);
} else {
    initAnimator();
}
