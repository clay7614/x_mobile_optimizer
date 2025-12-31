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
        /* Height is set dynamically via JS for randomness */
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
let lightboxStartY = 0;
let lightboxCurrentY = 0;
let lightboxImg = null;
let originalRect = null;

function openLightbox(sourceImg) {
    if (activeLightbox) return;

    // 1. Prepare info
    originalRect = sourceImg.getBoundingClientRect();
    const highResUrl = sourceImg.src.replace(/name=\w+/, 'name=large'); // Try to get large

    // 2. Create Elements
    const lightbox = document.createElement('div');
    lightbox.className = 'x-lightbox';

    const img = document.createElement('img');
    img.src = sourceImg.src; // start with current src
    img.className = 'x-lightbox-img';

    // 3. Initial Position (matching original image)
    // We use transform to animate from original rect to center
    // However, fitting object-fit:contain is tricky to animate perfectly from object-fit:cover
    // Simple approach: Fade in background, Zoom in image from center or simple scaling

    // Better native feel: Calculate scale/translate
    // But for simplicity and robustness against layout shifts:
    // Start scale 0.5 -> 1 with opacity is easiest, but user wants "expand from image"

    // Let's try formatting it
    lightbox.appendChild(img);
    document.body.appendChild(lightbox);

    activeLightbox = lightbox;
    lightboxImg = img;

    // Force reflow
    lightbox.getBoundingClientRect();
    lightbox.classList.add('active');

    // Switch to high res after animation starts
    setTimeout(() => { img.src = highResUrl; }, 100);

    // 4. Attach Close Listeners
    lightbox.addEventListener('click', () => closeLightbox());

    // Gestures
    lightbox.addEventListener('touchstart', (e) => {
        lightboxStartY = e.touches[0].clientY;
        lightboxCurrentY = lightboxStartY;
        img.style.transition = 'none'; // disable transition for direct 1:1 movement
    });

    lightbox.addEventListener('touchmove', (e) => {
        e.preventDefault(); // stop scrolling
        lightboxCurrentY = e.touches[0].clientY;
        const deltaY = lightboxCurrentY - lightboxStartY;

        // Move image with finger
        // Scale down slightly as you pull away
        const scale = Math.max(0.6, 1 - Math.abs(deltaY) / 1000);
        img.style.transform = `translateY(${deltaY}px) scale(${scale})`;

        // Fade background
        const opacity = Math.max(0, 1 - Math.abs(deltaY) / 500);
        lightbox.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    });

    lightbox.addEventListener('touchend', (e) => {
        const deltaY = lightboxCurrentY - lightboxStartY;
        if (Math.abs(deltaY) > 100) {
            closeLightbox();
        } else {
            // Revert
            img.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            img.style.transform = '';
            lightbox.style.backgroundColor = 'rgba(0, 0, 0, 1)';
        }
    });
}

function closeLightbox() {
    if (!activeLightbox) return;

    activeLightbox.classList.add('x-lightbox-closing');

    // Animate image out (simple fade/scale out for now, exact reverse to rect is complex math)
    if (lightboxImg) {
        lightboxImg.style.transition = 'all 0.25s ease-out';
        lightboxImg.style.opacity = '0';
        lightboxImg.style.transform = 'scale(0.8)';
    }

    setTimeout(() => {
        if (activeLightbox) activeLightbox.remove();
        activeLightbox = null;
        lightboxImg = null;
    }, 250);
}

function attachInteractionListeners() {
    // 1. Navigation Detection
    window.addEventListener('popstate', triggerBackNav);

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

    // User requested 100 cards
    for (let i = 0; i < 100; i++) {
        const card = document.createElement('div');
        card.className = 'x-skeleton-card';
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
