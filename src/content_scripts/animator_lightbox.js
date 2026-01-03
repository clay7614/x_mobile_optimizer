/**
 * animator_lightbox.js
 * Handles the custom lightbox functionalities.
 */

// Custom Lightbox Logic
var activeLightbox = null;
let lightboxTrack = null;
let imageList = [];
let currentImageIndex = 0;

// Gesture state
let gestureStartX = 0;
let gestureStartY = 0;
// trackStartX removed - unused
let gestureStartTime = 0;
let isDraggingX = false;
let isDraggingY = false;
let isSpreadMode = false;

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

// Auto-hide controls state
let controlsHideTimer = null;
let controlsVisible = true;
const CONTROLS_HIDE_DELAY = 3000; // 3 seconds

function collectImages(startImg) {
    // 1. Determine Scope
    let scopeElement = document;

    // Priority 1: Modal (if tweet is open in modal) - treat as conversation
    const modal = startImg.closest('[aria-modal="true"]');
    if (modal) {
        scopeElement = modal;
    }
    // Priority 2: Status Page (Conversation view) - treat as conversation
    else if (window.location.pathname.includes('/status/')) {
        // ideally find the conversation timeline or primary column
        scopeElement = document.querySelector('[aria-label^="Timeline: Conversation"], [aria-label^="タイムライン: 会話"]')
            || document.querySelector('[data-testid="primaryColumn"]');
    }
    // Priority 3: Timeline / List - treat as single tweet
    else {
        // In timeline, we only want images from the specific tweet clicked
        scopeElement = startImg.closest('article[data-testid="tweet"]');
    }

    if (!scopeElement) scopeElement = document.body;

    // 2. Query only Tweet Media images within scope
    // We strictly look for images INSIDE tweet articles to avoid avatars/promos outside tweets
    const potentialImages = Array.from(scopeElement.querySelectorAll('article[data-testid="tweet"] img[src*="pbs.twimg.com/media"]'));

    // 3. Filter and Deduplicate
    const seen = new Set();
    imageList = [];

    potentialImages.forEach(img => {
        if (!seen.has(img.src)) {
            seen.add(img.src);
            const highRes = img.src.replace(/name=\w+/, 'name=large');
            // Find parent tweet (guaranteed by query, but good for ref)
            const tweet = img.closest('[data-testid="tweet"]');

            // Optional: Filter out if it seems to be in a "Who to follow" block inside the timeline?
            // Usually those are distinct or don't use data-testid="tweet". 
            // Promoted tweets DO use data-testid="tweet", but they are in the stream.
            // "More to find" usually are just more tweets appended.
            // If the user wants to restrict to "Tree" in Status view, the streamContainer logic above should handle it
            // if the suggestions are outside that labeled region.

            imageList.push({
                src: img.src,
                highRes: highRes,
                element: img,
                tweetRef: tweet
            });
        }
    });

    currentImageIndex = imageList.findIndex(item => item.src === startImg.src);
    if (currentImageIndex === -1) {
        // Fallback: If strict query failed (e.g. startImg wasn't in scope or selector mismatch)
        // We revert to just the single image to ensure it opens.
        const fallbackTweet = startImg.closest('[data-testid="tweet"]');
        imageList = [{
            src: startImg.src,
            highRes: startImg.src.replace(/name=\w+/, 'name=large'),
            element: startImg,
            tweetRef: fallbackTweet
        }];
        currentImageIndex = 0;
    }
}

function openLightbox(sourceImg) {
    if (activeLightbox) return;
    collectImages(sourceImg);
    // Push state to handle back button closing
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

    // Create Controls
    const controls = document.createElement('div');
    controls.className = 'x-lightbox-controls';

    if (imageList.length > 1) {
        const spreadBtn = document.createElement('button');
        spreadBtn.className = 'x-spread-btn';
        if (isSpreadMode) spreadBtn.classList.add('active');
        spreadBtn.innerHTML = `
            <svg viewBox="0 0 24 24"><path d="M21 4H3c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM3 19V6h8v13H3zm18 0h-8V6h8v13z"/></svg>
        `;
        spreadBtn.onclick = (e) => {
            e.stopPropagation();
            toggleSpreadMode(spreadBtn);
        };
        controls.appendChild(spreadBtn);
    }

    lightbox.appendChild(controls);

    // Create Action Bar
    const actionBar = document.createElement('div');
    actionBar.className = 'x-lightbox-actions';
    lightbox.appendChild(actionBar);

    // Create Navigation Buttons
    if (imageList.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'x-lightbox-nav x-lightbox-nav-prev';
        prevBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
        prevBtn.onclick = (e) => { e.stopPropagation(); navigateNext(); }; // Left button = next (RTL)
        lightbox.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'x-lightbox-nav x-lightbox-nav-next';
        nextBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
        nextBtn.onclick = (e) => { e.stopPropagation(); navigatePrev(); }; // Right button = prev (RTL)
        lightbox.appendChild(nextBtn);
    }

    document.body.appendChild(lightbox);

    activeLightbox = lightbox;
    lightboxTrack = track;

    if (isSpreadMode) {
        renderSpreadView();
    }

    updateInteractionBar(); // Initial render

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

    // Start auto-hide timer and ensure controls are visible initially
    controlsVisible = true;
    startControlsHideTimer();
}

function updateTrackPosition() {
    if (!lightboxTrack) return;
    // Positive direction because track is row-reversed
    const translateX = currentImageIndex * 100;
    lightboxTrack.style.transform = `translateX(${translateX}vw)`;
    loadNearbyImages();
    updateInteractionBar();
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

        // trackStartX calculation removed - unused
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
        // Allow scaling down to 0.5 (bounce back later) and up to 8
        const newScale = Math.min(Math.max(0.5, initialPinchScale * scaleChange), 8);

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
        // Positive direction because track is row-reversed (consistent with X-drag)
        const currentTrackX = currentImageIndex * window.innerWidth;

        lightboxTrack.style.transform = `translateX(${currentTrackX}px)`;

        const currentSlide = lightboxTrack.children[currentImageIndex];
        if (currentSlide) {
            currentSlide.style.transform = `translate(0px, ${deltaY}px) scale(${scale})`;
        }

        const opacity = Math.max(0, 1 - Math.abs(deltaY) / 500);
        activeLightbox.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    }
    else if (isDraggingX) {
        // Positive direction because track is row-reversed
        const currentTrackX = currentImageIndex * window.innerWidth;
        // Track follows finger direction
        let newX = currentTrackX + deltaX;

        // Resistance at edges
        const maxIndex = isSpreadMode ? Math.ceil(imageList.length / 2) - 1 : imageList.length - 1;
        if ((currentImageIndex === 0 && deltaX < 0) ||
            (currentImageIndex === maxIndex && deltaX > 0)) {
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

                if (currentScale < 1 || currentScale <= 1.05) {
                    resetZoomAndPan(img);
                }
            }
        }
        isPinching = false;
        return;
    }

    if (currentScale > 1 && currentScale >= 0.95) {
        // Just finished panning (allow slight float point error for 1.0)
        return;
    }

    // Bounce back if scale < 1 (Zoom out release)
    if (currentScale < 1) {
        const currentSlide = lightboxTrack.children[currentImageIndex];
        if (currentSlide) {
            const img = currentSlide.querySelector('img');
            resetZoomAndPan(img);
        }
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
        // Right swipe (positive deltaX) = next, Left swipe (negative deltaX) = prev
        const isNext = (deltaX > threshold) || (velocityX > 0.5 && deltaX > 50);
        const isPrev = (deltaX < -threshold) || (velocityX > 0.5 && deltaX < -50);

        const maxIndex = isSpreadMode ? Math.ceil(imageList.length / 2) - 1 : imageList.length - 1;
        if (isNext && currentImageIndex < maxIndex) {
            currentImageIndex++;
        } else if (isPrev && currentImageIndex > 0) {
            currentImageIndex--;
        }
        updateTrackPosition();
    }

    isDraggingX = false;
    isDraggingY = false;

    // If no drag happened (just a tap), toggle controls visibility
    // But not if tapped on controls or action bar area
    if (!isDraggingX && !isDraggingY && !isPinching && currentScale === 1) {
        const deltaX = e.changedTouches[0].clientX - gestureStartX;
        const deltaY = e.changedTouches[0].clientY - gestureStartY;
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            // Check if tap was on action bar or controls or nav buttons
            const target = e.target;
            const actionBar = activeLightbox?.querySelector('.x-lightbox-actions');
            const controls = activeLightbox?.querySelector('.x-lightbox-controls');
            const isOnActionBar = actionBar && actionBar.contains(target);
            const isOnControls = controls && controls.contains(target);
            const isOnNav = target.closest('.x-lightbox-nav') !== null;

            if (!isOnActionBar && !isOnControls && !isOnNav) {
                toggleControlsVisibility();
            }
        }
    }
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
    currentScale = 1; // Reset scale on close

    // Manage History behind the scenes if this wasn't called by history nav
    if (!fromHistory) {
        if (window.xAnimator) {
            window.xAnimator.isProgrammaticBack = true;
        }
        history.back();
    }

    setTimeout(() => {
        if (targetLightbox) targetLightbox.remove();
    }, 1000);
}

function toggleSpreadMode(btn) {
    if (!activeLightbox || !lightboxTrack) return;

    isSpreadMode = !isSpreadMode;
    if (isSpreadMode) {
        btn.classList.add('active');
        renderSpreadView();
    } else {
        btn.classList.remove('active');
        renderSingleView();
    }

    // Reset Zoom
    currentScale = 1;
    panOffsetX = 0;
    panOffsetY = 0;

    lightboxTrack.style.transition = 'none';
    updateTrackPosition();
}

function renderSpreadView() {
    // Determine current logical image to try and stay on same page
    // currentImageIndex in spread view refers to SPREAD index (0, 1, 2...)
    // We strictly pair as [1,2], [3,4]... for RTL: [2][1], [4][3]

    // Calculate new index based on currently visible image
    // If we were at index 5 (6th image), that's inside spread pair 2 (images 4,5 => [5,4])
    const newIndex = Math.floor(currentImageIndex / 2);

    lightboxTrack.innerHTML = '';

    // Group images
    const spreads = [];
    for (let i = 0; i < imageList.length; i += 2) {
        const pair = [];
        if (i < imageList.length) pair.push(imageList[i]);
        if (i + 1 < imageList.length) pair.push(imageList[i + 1]);
        spreads.push(pair);
    }

    spreads.forEach((pair, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'x-lightbox-img-wrapper spread';

        // RTL Pairing: Second item (if exists) goes LEFT (visual first in row-reverse), First item goes RIGHT
        // CSS row-reverse handles Visual order. DOM order: [1, 2] -> Visual: [2] [1]

        pair.forEach(item => {
            const img = document.createElement('img');
            img.className = 'x-lightbox-img';
            if (pair.length === 1) img.classList.add('single');

            // Lazy load check - simple for now, load all for small sets or refine
            img.src = item.highRes;

            wrapper.appendChild(img);
        });

        lightboxTrack.appendChild(wrapper);
    });

    currentImageIndex = newIndex;
}

function renderSingleView() {
    // Convert Spread Index to Image Index
    // Spread 2 -> roughly Image 4 (start of pair)
    const newIndex = currentImageIndex * 2;

    lightboxTrack.innerHTML = '';

    imageList.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'x-lightbox-img-wrapper';

        const img = document.createElement('img');
        img.className = 'x-lightbox-img';
        img.src = item.highRes;

        wrapper.appendChild(img);
        lightboxTrack.appendChild(wrapper);
    });

    currentImageIndex = Math.min(newIndex, imageList.length - 1);
}

// --- Interaction Logic ---

function getIcons() {
    return {
        reply: '<svg viewBox="0 0 24 24"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/></svg>',
        retweet: '<svg viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>',
        like: '<svg viewBox="0 0 24 24"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.527 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.605 3.01.894 1.81.846 4.17-.518 6.67z"/></svg>',
        likeFilled: '<svg viewBox="0 0 24 24"><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.605 3.01.894 1.81.846 4.17-.518 6.67z"/></svg>',
        bookmark: '<svg viewBox="0 0 24 24"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/></svg>',
        bookmarkFilled: '<svg viewBox="0 0 24 24"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"/></svg>',
        share: '<svg viewBox="0 0 24 24"><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/></svg>'
    };
}

function updateInteractionBar() {
    if (!activeLightbox) return;
    const actionBar = activeLightbox.querySelector('.x-lightbox-actions');
    if (!actionBar) return;

    // Get current tweet info
    // In spread mode, we might have 2 images. Prefer the right-side (first visually) or the logical current index.
    // For simplicity, use imageList[currentImageIndex].tweetRef
    const item = imageList[currentImageIndex];
    if (!item || !item.tweetRef) {
        actionBar.style.display = 'none';
        return;
    }

    // Check if item.tweetRef is still in document? Even if detached, we might still hold ref.
    // But proxy clicks might fail if X removed listeners. Assuming standard DOM persistence or virtual scroll that keeps nearby.

    actionBar.style.display = 'flex';

    // Read state from DOM
    // Like: [data-testid="like"] vs [data-testid="unlike"]
    const likeBtn = item.tweetRef.querySelector('[data-testid="like"], [data-testid="unlike"]');
    const isLiked = likeBtn && likeBtn.getAttribute('data-testid') === 'unlike';

    // Retweet: [data-testid="retweet"] vs [data-testid="unretweet"]
    const rtBtn = item.tweetRef.querySelector('[data-testid="retweet"], [data-testid="unretweet"]');
    const isRetweeted = rtBtn && rtBtn.getAttribute('data-testid') === 'unretweet';

    // Bookmark: [data-testid="bookmark"] vs [data-testid="removeBookmark"]
    const bookmarkBtn = item.tweetRef.querySelector('[data-testid="bookmark"], [data-testid="removeBookmark"]');
    const isBookmarked = bookmarkBtn && bookmarkBtn.getAttribute('data-testid') === 'removeBookmark';

    const icons = getIcons();

    actionBar.innerHTML = `
        <button class="x-action-btn" onclick="triggerInteraction('reply')">
            ${icons.reply}
        </button>
        <button class="x-action-btn ${isRetweeted ? 'retweeted' : ''}" onclick="triggerInteraction('retweet')">
            ${icons.retweet}
        </button>
        <button class="x-action-btn ${isLiked ? 'liked' : ''}" onclick="triggerInteraction('like')">
            ${isLiked ? icons.likeFilled : icons.like}
        </button>
        <button class="x-action-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="triggerInteraction('bookmark')">
            ${isBookmarked ? icons.bookmarkFilled : icons.bookmark}
        </button>
        <button class="x-action-btn" onclick="triggerInteraction('share')">
            ${icons.share}
        </button>
    `;

    // Bind click handlers properly since inline string won't find global function in modular scope
    // We need to attach event delegation or bind individual
    const btns = actionBar.querySelectorAll('button');
    btns[0].onclick = (e) => { e.stopPropagation(); triggerInteraction('reply'); };
    btns[1].onclick = (e) => { e.stopPropagation(); triggerInteraction('retweet'); };
    btns[2].onclick = (e) => { e.stopPropagation(); triggerInteraction('like'); };
    btns[3].onclick = (e) => { e.stopPropagation(); triggerInteraction('bookmark'); };
    btns[4].onclick = (e) => { e.stopPropagation(); triggerInteraction('share'); };

    // Reset hide timer when bar is updated
    startControlsHideTimer();
}

function triggerInteraction(type) {
    if (!activeLightbox) return;
    const item = imageList[currentImageIndex];
    if (!item || !item.tweetRef) return;

    // For reply, close lightbox first so the compose dialog appears on top
    if (type === 'reply') {
        const replyBtn = item.tweetRef.querySelector('[data-testid="reply"]');
        if (replyBtn) {
            closeLightbox(false);
            setTimeout(() => replyBtn.click(), 100);
        }
        return;
    }

    // For retweet/unretweet
    if (type === 'retweet') {
        const rtBtn = item.tweetRef.querySelector('[data-testid="retweet"], [data-testid="unretweet"]');
        if (rtBtn) {
            const isUnretweet = rtBtn.getAttribute('data-testid') === 'unretweet';
            rtBtn.click();
            // Wait for menu to appear
            setTimeout(() => {
                if (isUnretweet) {
                    // Unretweet: look for cancel option
                    const unrtItem = document.querySelector('[data-testid="unretweetConfirm"]');
                    if (unrtItem) unrtItem.click();
                } else {
                    // Retweet: confirm
                    const rtItem = document.querySelector('[data-testid="retweetConfirm"]');
                    if (rtItem) rtItem.click();
                }
            }, 200);
        }
        animateButton(1); // RT button is index 1
        setTimeout(() => updateInteractionBar(), 400);
        return;
    }

    // For share, click button then wait for menu and click "Share via"
    if (type === 'share') {
        const shareBtn = item.tweetRef.querySelector('[aria-label*="Share"], [aria-label*="共有"]');
        if (shareBtn) {
            shareBtn.click();
            // Wait for menu, then click the external share option
            setTimeout(() => {
                // Look for "Share post via..." or equivalent
                const shareMenu = document.querySelector('[data-testid="sharePostMenu"]') ||
                    document.querySelector('[role="menu"]');
                if (shareMenu) {
                    // Find the "Share via" or last option which is usually external share
                    const menuItems = shareMenu.querySelectorAll('[role="menuitem"]');
                    for (const mi of menuItems) {
                        if (mi.textContent.includes('その他') || mi.textContent.includes('Share') || mi.textContent.includes('via')) {
                            mi.click();
                            return;
                        }
                    }
                    // Fallback: click last menu item
                    if (menuItems.length > 0) {
                        menuItems[menuItems.length - 1].click();
                    }
                }
            }, 200);
        }
        return;
    }

    // For like and bookmark, simple click
    let selector = '';
    switch (type) {
        case 'like': selector = '[data-testid="like"], [data-testid="unlike"]'; break;
        case 'bookmark': selector = '[data-testid="bookmark"], [data-testid="removeBookmark"]'; break;
    }

    if (!selector) return;

    let target = item.tweetRef.querySelector(selector);
    if (target) {
        // Animate button
        const btnIndex = type === 'like' ? 2 : 3; // like=2, bookmark=3
        animateButton(btnIndex);
        target.click();
        setTimeout(() => updateInteractionBar(), 100);
    }
}

function animateButton(index) {
    if (!activeLightbox) return;
    const btns = activeLightbox.querySelectorAll('.x-action-btn');
    if (btns[index]) {
        btns[index].classList.add('pressed');
        setTimeout(() => {
            btns[index].classList.remove('pressed');
        }, 200);
    }
}

function navigatePrev() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        updateTrackPosition();
    }
    showControls(); // Reset timer on navigation
}

function navigateNext() {
    const maxIndex = isSpreadMode ? Math.ceil(imageList.length / 2) - 1 : imageList.length - 1;
    if (currentImageIndex < maxIndex) {
        currentImageIndex++;
        updateTrackPosition();
    }
    showControls(); // Reset timer on navigation
}

// --- Controls Visibility ---

function startControlsHideTimer() {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = setTimeout(() => {
        hideControls();
    }, CONTROLS_HIDE_DELAY);
}

function showControls() {
    if (!activeLightbox) return;
    const actionBar = activeLightbox.querySelector('.x-lightbox-actions');
    const controls = activeLightbox.querySelector('.x-lightbox-controls');
    const navBtns = activeLightbox.querySelectorAll('.x-lightbox-nav');
    if (actionBar) actionBar.classList.remove('hidden');
    if (controls) controls.classList.remove('hidden');
    navBtns.forEach(btn => btn.classList.remove('hidden'));
    controlsVisible = true;
    startControlsHideTimer();
}

function hideControls() {
    if (!activeLightbox) return;
    const actionBar = activeLightbox.querySelector('.x-lightbox-actions');
    const controls = activeLightbox.querySelector('.x-lightbox-controls');
    const navBtns = activeLightbox.querySelectorAll('.x-lightbox-nav');
    if (actionBar) actionBar.classList.add('hidden');
    if (controls) controls.classList.add('hidden');
    navBtns.forEach(btn => btn.classList.add('hidden'));
    controlsVisible = false;
}

function toggleControlsVisibility() {
    if (controlsVisible) {
        hideControls();
    } else {
        showControls();
    }
}
