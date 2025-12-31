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
        transition: background-color 0.3s ease;
        opacity: 0; /* Started hidden for fade in */
        touch-action: none; /* Prevent scroll */
    }
    .x-lightbox.active {
        opacity: 1;
    }
    
    .x-lightbox-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        will-change: transform;
    }
    
    .x-lightbox-closing {
        background-color: rgba(0, 0, 0, 0) !important;
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
let lightboxImg = null;
let imageList = [];
let currentImageIndex = 0;

// Gesture state
let gestureStartX = 0;
let gestureStartY = 0;
let gestureCurrentX = 0;
let gestureCurrentY = 0;
let isDraggingX = false;
let isDraggingY = false;

function collectImages(startImg) {
    // Collect all media images currently valid in the DOM
    // Filter out small avatars or icons if possible, though 'pbs.twimg.com/media' usually targets content
    const allImages = Array.from(document.querySelectorAll('img[src*="pbs.twimg.com/media"]'));

    // Filter to ensure we only get actual content images (avoiding weird duplicates if any)
    // We can filter by verifying they are likely inside a tweet or media container
    // For now, simple selection is robust enough for the user's "timeline flow" request

    imageList = allImages.map(img => ({
        src: img.src,
        highRes: img.src.replace(/name=\w+/, 'name=large'),
        element: img
    }));

    // Find index of the clicked image
    currentImageIndex = imageList.findIndex(item => item.src === startImg.src);
    if (currentImageIndex === -1) {
        // Fallback if src changed or not found
        imageList = [{ src: startImg.src, highRes: startImg.src.replace(/name=\w+/, 'name=large') }];
        currentImageIndex = 0;
    }
}

function updateLightboxImage(index, direction = 0) {
    if (!lightboxImg || !imageList[index]) return;

    const targetSrc = imageList[index].highRes;

    // Reset transform/transitions
    lightboxImg.style.transition = 'none';
    lightboxImg.style.transform = 'translate(0, 0) scale(1)';
    lightboxImg.style.opacity = '1';

    // If direction provided, we can animate exit/enter? 
    // For simplicity/responsiveness, just swap src and reset position.
    // User requested swipe, so manual drag handles the animation mostly.

    lightboxImg.src = targetSrc;
    currentImageIndex = index;
}

function openLightbox(sourceImg) {
    if (activeLightbox) return;

    collectImages(sourceImg);

    // 0. Push history
    history.pushState({ x_lightbox: true }, '', '');

    // 2. Create Elements
    const lightbox = document.createElement('div');
    lightbox.className = 'x-lightbox';

    const img = document.createElement('img');
    img.src = imageList[currentImageIndex].src;
    img.className = 'x-lightbox-img';

    lightbox.appendChild(img);
    document.body.appendChild(lightbox);

    activeLightbox = lightbox;
    lightboxImg = img;

    // Force reflow
    lightbox.getBoundingClientRect();
    lightbox.classList.add('active');

    // Switch to high res immediately
    setTimeout(() => { img.src = imageList[currentImageIndex].highRes; }, 50);

    // Gestures
    activeLightbox.addEventListener('touchstart', onTouchStart, { passive: false });
    activeLightbox.addEventListener('touchmove', onTouchMove, { passive: false });
    activeLightbox.addEventListener('touchend', onTouchEnd, { passive: false });
}

function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    gestureStartX = e.touches[0].clientX;
    gestureStartY = e.touches[0].clientY;
    gestureCurrentX = gestureStartX;
    gestureCurrentY = gestureStartY;
    isDraggingX = false;
    isDraggingY = false;

    if (lightboxImg) {
        lightboxImg.style.transition = 'none';
    }
}

function onTouchMove(e) {
    if (!activeLightbox || !lightboxImg) return;
    e.preventDefault(); // Lock browser scroll

    gestureCurrentX = e.touches[0].clientX;
    gestureCurrentY = e.touches[0].clientY;

    const deltaX = gestureCurrentX - gestureStartX;
    const deltaY = gestureCurrentY - gestureStartY;

    if (!isDraggingX && !isDraggingY) {
        // Determine direction
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            isDraggingX = true;
        } else if (Math.abs(deltaY) > 10) {
            isDraggingY = true;
        }
    }

    if (isDraggingY) {
        // Pull to close
        const scale = Math.max(0.6, 1 - Math.abs(deltaY) / 1000);
        lightboxImg.style.transform = `translateY(${deltaY}px) scale(${scale})`;
        const opacity = Math.max(0, 1 - Math.abs(deltaY) / 500);
        activeLightbox.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    } else if (isDraggingX) {
        // Swipe navigation
        // Add resistance at edges
        let translateX = deltaX;
        if ((currentImageIndex === 0 && deltaX > 0) ||
            (currentImageIndex === imageList.length - 1 && deltaX < 0)) {
            translateX = deltaX * 0.3; // Resistance
        }
        lightboxImg.style.transform = `translateX(${translateX}px)`;
    }
}

function onTouchEnd(e) {
    if (!activeLightbox || !lightboxImg) return;

    const deltaX = gestureCurrentX - gestureStartX;
    const deltaY = gestureCurrentY - gestureStartY;

    if (isDraggingY) {
        // Check for close
        if (Math.abs(deltaY) > 100) {
            closeLightbox(false);
        } else {
            // Revert
            resetImagePosition();
        }
    } else if (isDraggingX) {
        // Check for navigation
        const threshold = 80;
        if (deltaX < -threshold && currentImageIndex < imageList.length - 1) {
            // Next
            transitionToImage(currentImageIndex + 1, -1);
        } else if (deltaX > threshold && currentImageIndex > 0) {
            // Prev
            transitionToImage(currentImageIndex - 1, 1);
        } else {
            // Revert
            resetImagePosition();
        }
    } else {
        // Tap (neither X nor Y drag) -> Do nothing (tap to close removed)
    }

    isDraggingX = false;
    isDraggingY = false;
}

function resetImagePosition() {
    if (!lightboxImg || !activeLightbox) return;
    lightboxImg.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    lightboxImg.style.transform = 'translate(0, 0) scale(1)';
    activeLightbox.style.backgroundColor = 'rgba(0, 0, 0, 1)';
}

function transitionToImage(newIndex, direction) {
    if (!lightboxImg) return;

    // Simply snap for now, or slide out
    // Since we are reusing the img element, a fade or simple snap is best to avoid complex double-buffering
    // Let's do: Slide out fully -> Swap Src -> Reset Position (hidden) -> Slide in?
    // Faster feeling: Just swap and reset.

    updateLightboxImage(newIndex);
}


function closeLightbox(fromHistory = false) {
    if (!activeLightbox) return;

    // If triggered by UI interaction, pop history (which will trigger popstate -> closeLightbox(true))
    if (!fromHistory) {
        history.back();
        return;
    }

    activeLightbox.classList.add('x-lightbox-closing');

    if (lightboxImg) {
        lightboxImg.style.transition = 'all 0.25s ease-out';
        lightboxImg.style.opacity = '0';
        lightboxImg.style.transform = 'scale(0.8)';
    }

    // Capture reference to remove
    const targetLightbox = activeLightbox;
    activeLightbox = null;
    lightboxImg = null;

    setTimeout(() => {
        if (targetLightbox) targetLightbox.remove();
    }, 250);
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
