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

    /* Skeleton Loading - CSS Only approach */
    .x-skeleton-loading {
        position: relative;
        display: block;
        min-height: var(--x-skeleton-height, 400px);
        contain: layout style;
        pointer-events: none;
    }

    /* Hide the original spinner */
    .x-skeleton-loading [role="progressbar"] {
        opacity: 0 !important;
        visibility: hidden !important;
    }

    .x-skeleton-loading::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 10;
        background: 
            linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent),
            repeating-linear-gradient(180deg, 
                rgba(255,255,255,0.02) 0px, 
                rgba(255,255,255,0.02) 150px, 
                transparent 150px, 
                transparent 162px
            );
        background-size: 200% 100%, 100% 100%;
        animation: x-shimmer 1.5s infinite;
        pointer-events: none;
    }

    @keyframes x-shimmer {
        0% { background-position: -200% 0, 0 0; }
        100% { background-position: 200% 0, 0 0; }
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
    if (e.touches.length !== 1) return;
    gestureStartX = e.touches[0].clientX;
    gestureStartY = e.touches[0].clientY;
    gestureStartTime = Date.now();

    trackStartX = -(currentImageIndex * window.innerWidth);
    isDraggingX = false;
    isDraggingY = false;

    if (lightboxTrack) {
        lightboxTrack.style.transition = 'none';
        Array.from(lightboxTrack.children).forEach(child => {
            child.style.transition = 'none';
            child.style.transform = '';
        });
    }
}

function onTouchMove(e) {
    if (!activeLightbox || !lightboxTrack) return;
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
        if (target.tagName === 'IMG' && target.src.includes('pbs.twimg.com/media')) {
            const link = target.closest('a');
            if (link && link.href.includes('/photo/') && !link.closest('[role="dialog"]')) {
                e.preventDefault();
                e.stopPropagation();
                openLightbox(target);
                return;
            }
        }
        if (target.closest('[data-testid="app-bar-back-button"]')) {
            triggerBackNav();
        }
    }, true);

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
                        }
                    }
                }
                else if (testId === 'primaryColumn' || (role === 'main' && node.querySelector('[data-testid="primaryColumn"]'))) {
                    const target = testId === 'primaryColumn' ? node : node.querySelector('[data-testid="primaryColumn"]');
                    if (target) {
                        target.classList.add(isBackNavigation ? 'x-slide-in-left' : 'x-slide-in-right');
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
                    }
                }
                // NEW: Detect when a tweet is directly added (e.g. replacing skeleton)
                else if (testId === 'tweet' || (node.querySelector && node.querySelector('[data-testid="tweet"]'))) {
                    const tweetNode = testId === 'tweet' ? node : node.querySelector('[data-testid="tweet"]');
                    if (tweetNode) {
                        tweetNode.classList.add('x-fade-in');
                        // Clean up parent skeleton if it exists
                        const parentCell = tweetNode.closest('div[data-testid="cellInnerDiv"]');
                        if (parentCell) {
                            disableSkeleton(parentCell);
                        }
                    }
                }
            }
        }
    }
});

function enableSkeleton(cell) {
    if (cell.classList.contains('x-skeleton-loading')) return;
    if (cell.querySelector('[data-testid="tweet"]')) return;

    cell.classList.add('x-skeleton-loading');
    // Force large height to show multiple cards
    cell.style.setProperty('--x-skeleton-height', '400px');
}

function disableSkeleton(cell) {
    if (cell.classList.contains('x-skeleton-loading')) {
        cell.classList.remove('x-skeleton-loading');
        cell.style.removeProperty('--x-skeleton-height');
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
