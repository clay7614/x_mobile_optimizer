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
            // attachEventListeners(); // Ripple removed
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
  `;
    document.head.appendChild(style);
}

// Observe for new tweets/elements to animate
const animObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
                // Target the inner tweet content, NOT the container cell
                // This avoids interfering with the Virtual Scroll's positioning of the cell
                if (node.getAttribute('data-testid') === 'cellInnerDiv') {
                    const tweetContent = node.querySelector('[data-testid="tweet"]');
                    if (tweetContent) {
                        tweetContent.classList.add('x-fade-in');
                    }
                }
                // If the node itself is the tweet (rare in this insertion pattern but possible)
                else if (node.getAttribute('data-testid') === 'tweet') {
                    node.classList.add('x-fade-in');
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
