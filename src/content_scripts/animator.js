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
            attachEventListeners();
            startAnimationObserver();
        }
    });
}

function injectAnimationStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* Ripple Effect */
    .x-ripple-container {
      position: relative;
      overflow: hidden;
    }
    
    .x-touch-ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      transform: scale(0);
      animation: x-ripple-anim 0.6s linear;
      pointer-events: none;
      z-index: 9999;
    }

    @keyframes x-ripple-anim {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }

    /* Fade In Effect for new tweets */
    .x-fade-in {
      animation: x-fade-in-anim 0.4s ease-out forwards;
      opacity: 0;
    }

    @keyframes x-fade-in-anim {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
    document.head.appendChild(style);
}

function attachEventListeners() {
    document.addEventListener('click', (e) => {
        createRipple(e);
    }, true); // Capture phase to ensure it triggers before navigation or other handlers
}

function createRipple(event) {
    // Target interactive elements
    const target = event.target.closest('div[role="button"], a, button, [data-testid="app-bar-back-button"]');

    if (target) {
        const rect = target.getBoundingClientRect();
        const circle = document.createElement('span');
        const diameter = Math.max(rect.width, rect.height);
        const radius = diameter / 2;

        // Simple overlay ripple at click position
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('x-touch-ripple');

        // Remove existing ripples
        const existing = target.getElementsByClassName('x-touch-ripple')[0];
        if (existing) {
            existing.remove();
        }

        // Ensure relative positioning
        const style = window.getComputedStyle(target);
        if (style.position === 'static') {
            target.style.position = 'relative';
        }

        target.appendChild(circle);

        setTimeout(() => {
            circle.remove();
        }, 600);
    }
}

// Observe for new tweets/elements to animate
const animObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
                // Check if it's a tweet cell
                if (node.getAttribute('data-testid') === 'cellInnerDiv' || node.querySelector('[data-testid="tweet"]')) {
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
