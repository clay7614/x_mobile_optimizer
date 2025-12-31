/**
 * animator.js
 * Adds micro-interactions and animations to X mobile web.
 */

console.log('X Animator: Loaded');

const ANIMATION_CONFIG = {
    enableAnimations: true,
    enableHaptics: true
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
  `;
    document.head.appendChild(style);
}

function attachInteractionListeners() {
    // 1. Haptic Feedback & Press Animation
    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('div[role="button"], a, button, [data-testid="tweet"], [data-testid="like"], [data-testid="retweet"], [data-testid="reply"]');
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

    document.addEventListener('click', (e) => {
        if (!ANIMATION_CONFIG.enableHaptics) return;

        const target = e.target.closest('div[role="button"], a, button, [data-testid="like"], [data-testid="retweet"], [data-testid="reply"]');
        if (target) {
            // Light vibration for interactions
            // navigator.vibrate is standard but implementation varies on Android browsers
            if (navigator.vibrate) {
                navigator.vibrate(5); // 5ms is extremely crisp
            }
        }
    }, true);
}

// Observe for new tweets/elements to animate
const animObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {

        // 1. Handle removed nodes (Cleanup skeleton if loader is removed)
        for (const node of mutation.removedNodes) {
            if (node.nodeType === 1) {
                // If the progress bar is removed, we must clean up the skeleton
                // even if we didn't see the new content add event yet
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

                // Case A: New Cell Inserted
                if (testId === 'cellInnerDiv') {
                    const progressBar = node.querySelector('[role="progressbar"]');
                    if (progressBar) {
                        enableSkeleton(node);
                    } else {
                        // Content cell
                        disableSkeleton(node);
                        const content = node.firstElementChild;
                        // Apply fade-in only if it's main content
                        if (content) content.classList.add('x-fade-in');
                    }
                }
                // Case B: Content injected into existing cell
                else if (testId) {
                    // Check if this is likely content (not a wrapper or script)
                    // Broaden check to catch any meaningful display element
                    const cell = node.closest('[data-testid="cellInnerDiv"]');
                    if (cell) {
                        // If any content is added to a skeleton cell, disable skeleton immediately
                        disableSkeleton(cell);
                    }

                    if (['tweet', 'notification', 'UserCell'].includes(testId)) {
                        node.classList.add('x-fade-in');
                    }
                }

                // Case C: Progress bar injected later (rare but possible)
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
