/**
 * animator.js
 * Adds micro-interactions and animations to X mobile web.
 */

console.log('X Animator: Loaded');

const ANIMATION_CONFIG = {
    enableLightbox: true,
    enableRipple: true,
    enableButtonScale: true,
    enableFullscreenBtn: true,
    fullscreenMode: 1 // 0: OFF, 1: Manual
};

let listenersAttached = false;

function initAnimator() {
    // 1. Start Observers IMMEDIATELY to catch initial rendering
    startAnimationObserver();
    startNavigationObserver();

    // 2. Load Config asynchronously
    chrome.storage.local.get(['animationConfig'], (result) => {
        if (result.animationConfig) {
            Object.assign(ANIMATION_CONFIG, result.animationConfig);
        }

        // Backwards compatibility migration
        if (typeof ANIMATION_CONFIG.enableFullscreenBtn !== 'undefined' && typeof ANIMATION_CONFIG.fullscreenMode === 'undefined') {
            ANIMATION_CONFIG.fullscreenMode = ANIMATION_CONFIG.enableFullscreenBtn ? 1 : 0;
        }

        // Initialize Fullscreen Button based on loaded config
        const shouldShowData = ANIMATION_CONFIG.enableFullscreenBtn || (ANIMATION_CONFIG.fullscreenMode && ANIMATION_CONFIG.fullscreenMode >= 1);
        if (shouldShowData) {
            createFullscreenButton();
        }

        // Show home loading pattern immediately if on /home
        if (window.location.pathname.endsWith('/home')) {
            setHomeLoading(true);
        }

        // Attach listeners if needed
        checkAndAttachListeners();
    });
}

// Check config and attach listeners if required
function checkAndAttachListeners() {
    if (listenersAttached) return;

    if (ANIMATION_CONFIG.enableLightbox || ANIMATION_CONFIG.enableRipple || ANIMATION_CONFIG.enableButtonScale) {
        attachInteractionListeners();
        listenersAttached = true;
    }
}

// Listen for dynamic configuration changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.animationConfig) {
        const newConfig = changes.animationConfig.newValue;
        if (newConfig) {
            Object.assign(ANIMATION_CONFIG, newConfig);

            // Handle Fullscreen Button Toggle
            const shouldShow = ANIMATION_CONFIG.enableFullscreenBtn || (ANIMATION_CONFIG.fullscreenMode && ANIMATION_CONFIG.fullscreenMode >= 1);
            if (shouldShow) {
                createFullscreenButton();
            } else {
                removeFullscreenButton(); // From animator_fullscreen.js
            }

            // Check if we need to attach listeners now (e.g. user toggled first setting ON)
            checkAndAttachListeners();
        }
    }
});

// Global State for cross-file coordination
window.xAnimator = window.xAnimator || {
    isProgrammaticBack: false
};

// Removed unused isBackNavigation logic

// Timeline Loading State Manager
let homeLoadingActive = false;

function setHomeLoading(active) {
    const isHome = window.location.pathname.endsWith('/home');

    if (active && isHome) {
        if (homeLoadingActive) return;
        // Check if content already exists
        if (document.querySelectorAll('[data-testid="tweet"]').length > 0) return;

        document.body.classList.add('x-loading-home');
        homeLoadingActive = true;
    } else {
        if (!homeLoadingActive) return;
        document.body.classList.remove('x-loading-home');
        homeLoadingActive = false;
    }
}

// SPA Navigation Observer
let lastPath = window.location.pathname;
function startNavigationObserver() {
    // Set initial home page class
    if (window.location.pathname.endsWith('/home')) {
        document.body.classList.add('x-home-page');
    }

    setInterval(() => {
        if (window.location.pathname !== lastPath) {
            lastPath = window.location.pathname;
            if (lastPath.endsWith('/home')) {
                document.body.classList.add('x-home-page');
                setHomeLoading(true);
            } else {
                document.body.classList.remove('x-home-page');
                setHomeLoading(false);
            }
        }
    }, 100);

    window.addEventListener('popstate', () => {
        lastPath = window.location.pathname;
        if (lastPath.endsWith('/home')) {
            setHomeLoading(true);
        } else {
            setHomeLoading(false);
        }
    });
}

function attachInteractionListeners() {
    window.addEventListener('popstate', (e) => {
        if (window.xAnimator && window.xAnimator.isProgrammaticBack) {
            window.xAnimator.isProgrammaticBack = false;
            return;
        }

        if (typeof activeLightbox !== 'undefined' && activeLightbox) {
            closeLightbox(true); // From animator_lightbox.js
            return;
        }
    });

    document.addEventListener('click', (e) => {
        const target = e.target;

        // Image Viewer Trigger
        if (ANIMATION_CONFIG.enableLightbox) {
            if (target.tagName === 'IMG' && target.src.includes('pbs.twimg.com/media')) {
                const link = target.closest('a');
                if (link && link.href.includes('/photo/') && !link.closest('[role="dialog"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                    openLightbox(target); // From animator_lightbox.js
                    return;
                }
            }
        }

        // Back Button Trigger - No specific action needed currently
    }, true);

    // Touch Listeners for Ripple and Scale
    document.addEventListener('touchstart', (e) => {
        // Optimization: Only run if features enabled
        if (!ANIMATION_CONFIG.enableRipple && !ANIMATION_CONFIG.enableButtonScale) return;

        // Determine target based on what we want to animate
        const target = e.target.closest('div[role="button"], a, button, [data-testid="tweet"], [data-testid="like"], [data-testid="retweet"], [data-testid="reply"], [data-testid="file-image"]');
        if (target) {
            target.classList.add('x-press-target');
            if (ANIMATION_CONFIG.enableButtonScale) target.classList.add('x-press-active');
            if (ANIMATION_CONFIG.enableRipple) {
                target.classList.add('x-ripple-effect');
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const target = e.target.closest('.x-press-target');
        if (target) {
            target.classList.remove('x-press-active');
            target.classList.remove('x-ripple-effect');
            target.classList.remove('x-press-target');
        }
    }, { passive: true });

    document.addEventListener('touchcancel', (e) => {
        const target = e.target.closest('.x-press-target');
        if (target) {
            target.classList.remove('x-press-active');
            target.classList.remove('x-ripple-effect');
            target.classList.remove('x-press-target');
        }
    }, { passive: true });
}

// Mutation Observer Logic
const animObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
                const testId = node.getAttribute('data-testid');
                const role = node.getAttribute('role');

                // Dialog / Modal Animations
                if (role === 'dialog' || testId === 'sheetDialog' || node.querySelector('[role="dialog"]')) {
                    const dialog = role === 'dialog' ? node : node.querySelector('[role="dialog"]');
                    if (dialog) {
                        if (dialog.querySelector('[data-testid="swipe-to-dismiss"]') || dialog.querySelector('img[draggable="true"]')) {
                            dialog.classList.add('x-zoom-in');
                        } else {
                            dialog.classList.add('x-modal-zoom');
                            // Prevent auto-focus on compose modal
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
                // Primary Column / Home Loading
                else if (testId === 'primaryColumn' || (role === 'main' && node.querySelector('[data-testid="primaryColumn"]'))) {
                    const target = testId === 'primaryColumn' ? node : node.querySelector('[data-testid="primaryColumn"]');
                    if (target) {
                        if (window.location.pathname.endsWith('/home')) {
                            setHomeLoading(true);
                        }
                    }
                }
                // Cell Inner Div (Skeleton & Reveal)
                else if (testId === 'cellInnerDiv') {
                    const progressBar = node.querySelector('[role="progressbar"]');
                    const hasTweet = node.querySelector('[data-testid="tweet"]');

                    if (progressBar && !hasTweet) {
                        // Use CSS skeleton class
                        if (window.location.pathname.endsWith('/home')) {
                            if (!homeLoadingActive) {
                                node.classList.add('x-skeleton-cell');
                            }
                        } else {
                            node.classList.add('x-skeleton-cell');
                        }
                    } else {
                        // Reveal Content
                        node.classList.remove('x-skeleton-cell');
                        const content = node.firstElementChild;
                        if (content && !content.classList.contains('x-fade-in')) {
                            content.classList.add('x-fade-in');
                        }

                        // Hide home loading pattern if content is present
                        if (window.location.pathname.endsWith('/home') && homeLoadingActive) {
                            setHomeLoading(false);
                        }
                    }
                }
                // Progress Bar (Lazy Skeleton)
                else if (role === 'progressbar' || (node.querySelector && node.querySelector('[role="progressbar"]'))) {
                    const progressBar = role === 'progressbar' ? node : node.querySelector('[role="progressbar"]');
                    const cell = progressBar.closest('[data-testid="cellInnerDiv"]');
                    if (cell) {
                        const hasTweet = cell.querySelector('[data-testid="tweet"]');
                        if (!hasTweet) {
                            if (window.location.pathname.endsWith('/home')) {
                                if (!homeLoadingActive) {
                                    cell.classList.add('x-skeleton-cell');
                                }
                            } else {
                                cell.classList.add('x-skeleton-cell');
                            }
                        }
                    }
                }
                // Tweet / Content Arrival -> Fade In
                else if (testId === 'tweet' || (node.querySelector && node.querySelector('[data-testid="tweet"]')) ||
                    (testId === 'cellInnerDiv' && !node.querySelector('[role="progressbar"]'))) {
                    const isTweet = testId === 'tweet' || node.querySelector('[data-testid="tweet"]');
                    const isContentCell = testId === 'cellInnerDiv' && !node.querySelector('[role="progressbar"]');

                    if (isTweet || isContentCell) {
                        if (isTweet) {
                            const tweetNode = testId === 'tweet' ? node : node.querySelector('[data-testid="tweet"]');
                            tweetNode.classList.add('x-fade-in');
                        }

                        // Hide home loading pattern
                        if (window.location.pathname.endsWith('/home') && homeLoadingActive) {
                            setHomeLoading(false);
                        }
                    }
                }
            }
        }
    }
});


function startAnimationObserver() {
    const targetNode = document.body;
    if (!targetNode) return; // Should not happen with run_at: document_end

    // Start observing immediately
    animObserver.observe(targetNode, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimator);
} else {
    initAnimator();
}
