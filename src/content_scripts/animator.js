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
            // CSS is now loaded via manifest (animator.css)
            attachInteractionListeners();
            startAnimationObserver();
            startNavigationObserver();
            createFullscreenButton(); // From animator_fullscreen.js

            // Show home loading pattern immediately if on /home
            if (window.location.pathname.endsWith('/home')) {
                setHomeLoading(true);
            }
        }
    });
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
        if (isProgrammaticBack) {
            isProgrammaticBack = false;
            return;
        }

        if (activeLightbox) {
            closeLightbox(true); // From animator_lightbox.js
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
                openLightbox(target); // From animator_lightbox.js
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
                        // Activate home loading pattern
                        if (window.location.pathname.endsWith('/home')) {
                            setHomeLoading(true);
                        }
                    }
                }
                else if (testId === 'cellInnerDiv') {
                    const progressBar = node.querySelector('[role="progressbar"]');
                    const hasTweet = node.querySelector('[data-testid="tweet"]');

                    if (progressBar && !hasTweet) {
                        // Use CSS skeleton class for all pages
                        if (window.location.pathname.endsWith('/home')) {
                            if (!homeLoadingActive) {
                                node.classList.add('x-skeleton-cell');
                            }
                        } else {
                            node.classList.add('x-skeleton-cell');
                        }
                    } else {
                        // Remove skeleton class when content arrives
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
                // NEW: Catch cases where spinner is added LATER into an existing cell
                else if (role === 'progressbar' || (node.querySelector && node.querySelector('[role="progressbar"]'))) {
                    const progressBar = role === 'progressbar' ? node : node.querySelector('[role="progressbar"]');

                    // Priority 1: Tweet Cell
                    const cell = progressBar.closest('[data-testid="cellInnerDiv"]');
                    if (cell) {
                        const hasTweet = cell.querySelector('[data-testid="tweet"]');
                        if (!hasTweet) {
                            // Use CSS skeleton class for all pages
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
                else if (testId === 'tweet' || (node.querySelector && node.querySelector('[data-testid="tweet"]')) ||
                    (testId === 'cellInnerDiv' && !node.querySelector('[role="progressbar"]'))) {
                    const isTweet = testId === 'tweet' || node.querySelector('[data-testid="tweet"]');
                    const isContentCell = testId === 'cellInnerDiv' && !node.querySelector('[role="progressbar"]');

                    if (isTweet || isContentCell) {
                        if (isTweet) {
                            const tweetNode = testId === 'tweet' ? node : node.querySelector('[data-testid="tweet"]');
                            tweetNode.classList.add('x-fade-in');
                        }

                        const parentCell = node.closest ? node.closest('div[data-testid="cellInnerDiv"]') : null;

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
    if (!targetNode) return;
    animObserver.observe(targetNode, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimator);
} else {
    initAnimator();
}
