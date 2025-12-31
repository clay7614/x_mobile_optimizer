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
        height: 120px; /* Approx tweet height */
        background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        position: relative;
        overflow: hidden;
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

        // Check for removed nodes (clean up skeletons if needed)
        // Usually X replaces the loader cell with content, so strict cleanup might not be needed if we target the cellInnerDiv correctly.

        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
                const testId = node.getAttribute('data-testid');

                // 1. Content Fade-in
                if (testId === 'cellInnerDiv') {
                    // Check if this is a loading spinner cell
                    const progressBar = node.querySelector('[role="progressbar"]');
                    if (progressBar) {
                        // This is a loader cell. Convert to skeleton.
                        enableSkeleton(node);
                    } else {
                        // Normal content
                        const content = node.firstElementChild;
                        if (content) content.classList.add('x-fade-in');
                    }
                }
                else if (['tweet', 'notification', 'UserCell'].includes(testId)) {
                    node.classList.add('x-fade-in');
                }

                // 2. Catch nested progress bar if inserted later
                if (testId === undefined || testId === null) {
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

    cell.classList.add('x-skeleton-valid');
    cell.classList.add('x-skeleton-container');

    // Add dummy cards
    // We append specific internal structure to simulate cards
    // Note: manipulating innerHTML of a React-managed node is risky.
    // Instead, we use pseudo-elements or a separate overlay container if possible.
    // Here we append a safe container that shouldn't break React if X only manages the progressbar inside.

    const skeletonWrapper = document.createElement('div');
    skeletonWrapper.className = 'x-skeleton-wrapper';
    skeletonWrapper.style.width = '100%';

    for (let i = 0; i < 5; i++) {
        const card = document.createElement('div');
        card.className = 'x-skeleton-card';
        skeletonWrapper.appendChild(card);
    }

    cell.appendChild(skeletonWrapper);
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
