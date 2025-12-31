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
                // Target content inside virtual scroll cells
                // This covers Tweets, Notifications, Users in lists, etc.
                if (node.getAttribute('data-testid') === 'cellInnerDiv') {
                    // Apply to the first direct child which acts as the content container
                    // This avoids animating the cellInnerDiv itself which causes layout issues
                    const content = node.firstElementChild;
                    if (content) {
                        content.classList.add('x-fade-in');
                    }
                }
                // Falback: If the node is injected as these specific types directly
                else if (['tweet', 'notification', 'UserCell'].includes(node.getAttribute('data-testid'))) {
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
