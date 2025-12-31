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
        }
    });
}

function injectAnimationStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* Fade In Effect for tweet content */
    .x-fade-in {
      animation: x-fade-in-anim 0.4s ease-out forwards;
      opacity: 0; 
    }
    
    @keyframes x-fade-in-anim {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Press Scale Effect */
    .x-press-active {
        transform: scale(0.97);
        transition: transform 0.1s ease-out;
    }
    /* Smooth return */
    .x-press-target {
        transition: transform 0.2s ease-out;
    }

    /* Skeleton Loading Effect */
    .x-skeleton-container {
        /* Force height to simulate multiple tweets */
        min-height: 100vh; 
        background-color: transparent;
        display: flex;
        flex-direction: column;
        gap: 1px; /* border separator simulation */
        pointer-events: none; /* Let touches pass through */
    }

    .x-skeleton-valid {
        /* Only show skeleton when this class is applied to a valid loader container */
        position: relative;
    }
    
    .x-skeleton-valid [role="progressbar"] {
        /* Hide original spinner but keep it in DOM for React */
        opacity: 0 !important;
        position: absolute;
    }

    .x-skeleton-card {
        width: 100%;
        /* Height is set dynamically via JS */
        flex: 0 0 auto; /* Prevent shrinking in flex container */
        background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        position: relative;
        overflow: hidden;
        margin-bottom: 1px;
    }
    
    /* Shimmer effect */
    .x-skeleton-card::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
        animation: x-shimmer 1.5s infinite;
    }

    @keyframes x-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
    
    /* Navigation Animations */
    .x-slide-in-right {
        animation: x-slide-in-right-anim 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .x-slide-in-left {
        animation: x-slide-in-left-anim 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    
    @keyframes x-slide-in-right-anim {
        from { transform: translateX(30px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes x-slide-in-left-anim {
        from { transform: translateX(-30px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    /* Modal & Image Zoom Animations */
    .x-zoom-in {
        animation: x-zoom-in-anim 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; /* Pop effect */
        transform-origin: center;
    }
    
    .x-modal-zoom {
        animation: x-modal-zoom-anim 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        transform-origin: center;
    }

    @keyframes x-zoom-in-anim {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    
    @keyframes x-modal-zoom-anim {
        from { transform: scale(0.92); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
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
    .x-lightbox.active {
        opacity: 1;
    }
    
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
        object-fit: contain; /* Ensure it fits within screen */
        width: auto;
        height: auto;
        user-select: none;
        -webkit-user-drag: none;
    }

    /* Force hide skeleton on status pages to prevent conflicts */
    body.x-status-page .x-skeleton-container {
        display: none !important;
    }
  `;
    document.head.appendChild(style);
}

let isBackNavigation = false;
let backNavTimeout;

function triggerBackNav() {
    isBackNavigation = true;
    if (backNavTimeout) clearTimeout(backNavTimeout);
    backNavTimeout = setTimeout(() => {
        isBackNavigation = false;
    }, 1000);
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
let isDraggingX = false;
let isDraggingY = false;

function collectImages(startImg) {
    const allImages = Array.from(document.querySelectorAll('img[src*="pbs.twimg.com/media"]'));

    // Deduplicate based on src (sometimes X renders duplicates)
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

    // Create DOM
    const lightbox = document.createElement('div');
    lightbox.className = 'x-lightbox';

    const track = document.createElement('div');
    track.className = 'x-lightbox-track';

    // Build slides (Lazy load implies we put placeholders, but for smoothness let's put imgs)
    // To avoid loading ALL heavy images at once, we load current, prev, next immediately
    imageList.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'x-lightbox-img-wrapper';

        const img = document.createElement('img');
        img.className = 'x-lightbox-img';

        // Load immediately if close to current index
        if (Math.abs(index - currentImageIndex) <= 1) {
            img.src = item.highRes;
        } else {
            img.dataset.src = item.highRes; // Lazy
        }

        wrapper.appendChild(img);
        track.appendChild(wrapper);
    });

    lightbox.appendChild(track);
    document.body.appendChild(lightbox);

    activeLightbox = lightbox;
    lightboxTrack = track;

    // Set initial position without animation
    track.style.transition = 'none';
    updateTrackPosition();

    // Force reflow
    lightbox.getBoundingClientRect();

    // Animate In
    setTimeout(() => {
        lightbox.classList.add('active');
        // Enable transition for interactions
        track.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }, 10);

    // Gestures
    lightbox.addEventListener('touchstart', onTouchStart, { passive: false });
    lightbox.addEventListener('touchmove', onTouchMove, { passive: false });
    lightbox.addEventListener('touchend', onTouchEnd, { passive: false });
}

function updateTrackPosition() {
    if (!lightboxTrack) return;
    const translateX = -(currentImageIndex * 100); // 100vw units
    lightboxTrack.style.transform = `translateX(${translateX}vw)`;

    // Load nearby images
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
    if (e.touches.length !== 1) return;
    gestureStartX = e.touches[0].clientX;
    gestureStartY = e.touches[0].clientY;

    // Get current transform value for track logic is tricky with vw.
    // Simpler: Track assumes current index base.
    trackStartX = -(currentImageIndex * window.innerWidth);

    isDraggingX = false;
    isDraggingY = false;

    if (lightboxTrack) {
        lightboxTrack.style.transition = 'none';

        // Reset child transitions/transforms to ensure clean slate
        Array.from(lightboxTrack.children).forEach(child => {
            child.style.transition = 'none';
            child.style.transform = '';
        });
    }
}

function onTouchMove(e) {
    if (!activeLightbox || !lightboxTrack) return;

    // Don't prevent default immediately to allow vertical scroll check?
    // Actually we want to block scroll to prevent page behind moving.
    e.preventDefault();

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - gestureStartX;
    const deltaY = currentY - gestureStartY;

    if (!isDraggingX && !isDraggingY) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isDraggingX = true;
        } else if (Math.abs(deltaY) > 10) {
            isDraggingY = true;
        }
    }

    if (isDraggingY) {
        // Drag current slide vertically (keep track horizontal)
        const scale = Math.max(0.6, 1 - Math.abs(deltaY) / 1000);
        const currentTrackX = -(currentImageIndex * window.innerWidth);

        // Track stays horizontal, only current slide moves Y/Scales
        lightboxTrack.style.transform = `translateX(${currentTrackX}px)`;

        const currentSlide = lightboxTrack.children[currentImageIndex];
        if (currentSlide) {
            currentSlide.style.transform = `translate(0px, ${deltaY}px) scale(${scale})`;
        }

        const opacity = Math.max(0, 1 - Math.abs(deltaY) / 500);
        activeLightbox.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    }
    else if (isDraggingX) {
        // Move track horizontally
        const currentTrackX = -(currentImageIndex * window.innerWidth);
        let newX = currentTrackX + deltaX;

        // Resistance at edges
        if ((currentImageIndex === 0 && deltaX > 0) ||
            (currentImageIndex === imageList.length - 1 && deltaX < 0)) {
            newX = currentTrackX + (deltaX * 0.4);
        }

        lightboxTrack.style.transform = `translateX(${newX}px)`;
    }
}

function onTouchEnd(e) {
    if (!activeLightbox || !lightboxTrack) return;

    const currentX = e.changedTouches[0].clientX;
    const currentY = e.changedTouches[0].clientY;
    const deltaX = currentX - gestureStartX;
    const deltaY = currentY - gestureStartY;

    // Restore transition
    lightboxTrack.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

    if (isDraggingY) {
        if (Math.abs(deltaY) > 80) {
            closeLightbox(false);
        } else {
            // Revert properties
            activeLightbox.style.backgroundColor = 'rgba(0, 0, 0, 1)';

            // Revert Child Transform with transition
            const currentSlide = lightboxTrack.children[currentImageIndex];
            if (currentSlide) {
                currentSlide.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                currentSlide.style.transform = '';
            }

            updateTrackPosition(); // Snap back to correct X
        }
    }
    else if (isDraggingX) {
        const threshold = 50; // Reduced from 20% width to 40px for lighter swipe
        if (deltaX < -threshold && currentImageIndex < imageList.length - 1) {
            currentImageIndex++;
        } else if (deltaX > threshold && currentImageIndex > 0) {
            currentImageIndex--;
        }
        updateTrackPosition(); // Snap to new index
    }
    else {
        // Tap -> Do nothing
    }

    isDraggingX = false;
    isDraggingY = false;
}

function closeLightbox(fromHistory = false) {
    if (!activeLightbox) return;

    if (!fromHistory) {
        history.back();
        return;
    }

    // Animate out
    activeLightbox.classList.remove('active'); // Fade out opacity

    // Zoom out track slightly for finish feel
    if (lightboxTrack) {
        lightboxTrack.style.transform += ' scale(0.9)';
    }

    const targetLightbox = activeLightbox;
    activeLightbox = null;
    lightboxTrack = null;

    setTimeout(() => {
        if (targetLightbox) targetLightbox.remove();
    }, 300);
}

function attachInteractionListeners() {
    // 1. Navigation Detection & Lightbox History Handling
    window.addEventListener('popstate', (e) => {
        if (activeLightbox) {
            // Prevent other back handlers if possible, or just accept we are closing modal
            closeLightbox(true);
            return;
        }
        triggerBackNav();
    });

    // Global click handler
    document.addEventListener('click', (e) => {
        const target = e.target;

        // A. Custom Lightbox Intercept
        if (target.tagName === 'IMG' && target.src.includes('pbs.twimg.com/media')) {
            // Check if it's inside a tweet or grid. Usually these images are wrapped in anchors.
            // We want to stop that anchor.
            const link = target.closest('a');
            if (link && link.href.includes('/photo/') && !link.closest('[role="dialog"]')) {
                // Only intercept timeline photos, not already in modal
                e.preventDefault();
                e.stopPropagation();
                openLightbox(target);
                return;
            }
        }

        // B. Back Button
        if (target.closest('[data-testid="app-bar-back-button"]')) {
            // If we are in lightbox (shouldn't happen as lightbox covers header), do nothing
            // Regular back
            triggerBackNav();
        }
    }, true); // Capture phase to prevent X specific handlers

    // 2. Press Animation
    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('div[role="button"], a, button, [data-testid="tweet"], [data-testid="like"], [data-testid="retweet"], [data-testid="reply"], [data-testid="file-image"]');
        if (target) {
            target.classList.add('x-press-target');
            target.classList.add('x-press-active');
        }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const target = e.target.closest('.x-press-target');
        if (target) {
            target.classList.remove('x-press-active');
        }
    }, { passive: true });

    // Safety cleanup
    document.addEventListener('touchcancel', (e) => {
        const target = e.target.closest('.x-press-target');
        if (target) target.classList.remove('x-press-active');
    }, { passive: true });
}

// Observe for new tweets/elements to animate
const animObserver = new MutationObserver((mutations) => {
    // Check status page
    if (window.location.pathname.includes('/status/')) {
        document.body.classList.add('x-status-page');
    } else {
        document.body.classList.remove('x-status-page');
    }

    for (const mutation of mutations) {

        // 1. Handle removed nodes
        for (const node of mutation.removedNodes) {
            if (node.nodeType === 1) {
                if (node.getAttribute('role') === 'progressbar' || node.querySelector('[role="progressbar"]')) {
                    const cell = mutation.target.closest('[data-testid="cellInnerDiv"]');
                    if (cell) disableSkeleton(cell);
                }
            }
        }

        // 2. Handle added nodes
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
                const testId = node.getAttribute('data-testid');
                const role = node.getAttribute('role');

                // --- A. Modal / Dialog Animations ---
                if (role === 'dialog' || testId === 'sheetDialog' || node.querySelector('[role="dialog"]')) {
                    const dialog = role === 'dialog' ? node : node.querySelector('[role="dialog"]');
                    if (dialog) {
                        // 1. Image Viewer (Swipe to dismiss usually indicates media viewer)
                        if (dialog.querySelector('[data-testid="swipe-to-dismiss"]') || dialog.querySelector('img[draggable="true"]')) {
                            dialog.classList.add('x-zoom-in');
                        }
                        // 2. Tweet Composer (Look for textarea or specific buttons)
                        else if (dialog.querySelector('[data-testid="tweetTextarea_0"]') || dialog.querySelector('[data-testid="toolBar"]')) {
                            dialog.classList.add('x-modal-zoom');
                        }
                        // 3. Generic Dialogs (Menu, etc) - optional, maybe skip to avoid weirdness
                        else {
                            dialog.classList.add('x-modal-zoom');
                        }
                    }
                }

                // --- B. Page / Column Animations ---
                // If the primary column is re-rendered (page transition)
                else if (testId === 'primaryColumn' || (role === 'main' && node.querySelector('[data-testid="primaryColumn"]'))) {
                    const target = testId === 'primaryColumn' ? node : node.querySelector('[data-testid="primaryColumn"]');
                    if (target) {
                        if (isBackNavigation) {
                            target.classList.add('x-slide-in-left');
                        } else {
                            target.classList.add('x-slide-in-right');
                        }
                    }
                }

                // --- C. List Content Animations (Virtual Scroll) ---
                else if (testId === 'cellInnerDiv') {
                    // Force clean up if we are on status page and skeleton exists
                    if (window.location.pathname.includes('/status/')) {
                        disableSkeleton(node);
                        return;
                    }

                    const progressBar = node.querySelector('[role="progressbar"]');
                    if (progressBar) {
                        enableSkeleton(node);
                    } else {
                        disableSkeleton(node);
                        const content = node.firstElementChild;
                        if (content) {
                            // Only fade in if not covered by page transition
                            // But adding it safely doesn't hurt
                            content.classList.add('x-fade-in');
                        }
                    }
                }
                else if (['tweet', 'notification', 'UserCell'].includes(testId)) {
                    const cell = node.closest('[data-testid="cellInnerDiv"]');
                    if (cell) disableSkeleton(cell);
                    node.classList.add('x-fade-in');
                }

                // --- D. Late Skeleton Check ---
                if (!testId) {
                    const progressBar = node.querySelector('[role="progressbar"]');
                    if (progressBar) {
                        const cell = node.closest('[data-testid="cellInnerDiv"]');
                        if (cell) enableSkeleton(cell);
                    }
                }
            }
        }
    }
});

function enableSkeleton(cell) {
    if (cell.classList.contains('x-skeleton-valid')) return;

    // Disable skeleton on Status (Tweet Detail) pages to prevent reply loading issues
    if (window.location.pathname.includes('/status/')) return;

    // Safety: don't override existing content
    if (cell.querySelector('[data-testid="tweet"]')) return;

    cell.classList.add('x-skeleton-valid');
    cell.classList.add('x-skeleton-container');

    const skeletonWrapper = document.createElement('div');
    skeletonWrapper.className = 'x-skeleton-wrapper';
    skeletonWrapper.style.width = '100%';

    // User requested 40 cards with random heights
    for (let i = 0; i < 40; i++) {
        const card = document.createElement('div');
        card.className = 'x-skeleton-card';

        // Random height between 200 and 600
        const randomHeight = Math.floor(Math.random() * (600 - 200 + 1)) + 200;
        card.style.height = `${randomHeight}px`;
        card.style.minHeight = `${randomHeight}px`; // Force height

        skeletonWrapper.appendChild(card);
    }

    cell.appendChild(skeletonWrapper);
}

function disableSkeleton(cell) {
    if (cell.classList.contains('x-skeleton-valid')) {
        cell.classList.remove('x-skeleton-valid');
        cell.classList.remove('x-skeleton-container');

        // Remove wrapper
        const wrapper = cell.querySelector('.x-skeleton-wrapper');
        if (wrapper) wrapper.remove();

        // Reset styles that might cause layout issues
        cell.style.height = 'auto';
        cell.style.minHeight = '0px';
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
