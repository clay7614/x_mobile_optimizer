/**
 * optimizer.js
 * Handles performance optimizations for X on mobile web.
 */

console.log('X Mobile Optimizer: Loaded');

// Configuration
const CONFIG = {
    optimizeMedia: true,
    debug: false
};


// Initialize
function initOptimizer() {
    console.log('X Mobile Optimizer: Initializing...');
    // Load settings from storage
    chrome.storage.local.get(['config'], (result) => {
        if (result.config) {
            Object.assign(CONFIG, result.config);
        }
        log('Config loaded:', CONFIG);

        // Initial cleanup
        cleanup();

        // Start observing for new content
        startObservation();
    });
}

function log(...args) {
    if (CONFIG.debug) console.log('XMO:', ...args);
}

// DOM Observer to handle dynamic content
const observer = new MutationObserver((mutations) => {
    let shouldCleanup = false;

    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldCleanup = true;
            break;
        }
    }

    if (shouldCleanup) {
        // Debounce potential high-frequency calls if needed, 
        // but for simple hiding, direct call is usually fine.
        requestAnimationFrame(cleanup);
    }
});

function startObservation() {
    const targetNode = document.body;
    if (!targetNode) return;

    const config = { childList: true, subtree: true };
    observer.observe(targetNode, config);
    log('Observer started');
}

function cleanup() {
    if (CONFIG.optimizeMedia) {
        optimizeRendering(); // New rendering optimizations
    }
}

function injectResourceHints() {
    const hints = [
        'https://pbs.twimg.com',
        'https://video.twimg.com',
        'https://abs.twimg.com'
    ];

    hints.forEach(url => {
        if (!document.head.querySelector(`link[rel="preconnect"][href="${url}"]`)) {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = url;
            link.crossOrigin = 'anonymous'; // Important for CORS content
            document.head.appendChild(link);
        }
    });
    log('Resource hints injected');
}

// Inject hints immediately
injectResourceHints();

// Optimization Logic
// Ads and Sidebar removal are handled by other extensions or user preference.
// This script focuses purely on performance optimizations.

function optimizeRendering() {
    // 1. Content Visibility for Timeline Cells
    // This allows the browser to skip rendering work for off-screen tweets.
    // We target the cell wrapper.
    const cells = document.querySelectorAll('[data-testid="cellInnerDiv"]:not([data-xmo-opt="true"])');
    cells.forEach(cell => {
        // Apply only if not already optimized
        cell.style.contentVisibility = 'auto';
        cell.style.containIntrinsicSize = '1px 300px'; // Estimated average height to prevent scroll jumps
        cell.dataset.xmoOpt = 'true';
    });

    // 2. Image Decoding
    // Force async decoding to prevent main thread blocking during scroll
    const images = document.querySelectorAll('img:not([decoding="async"])');
    images.forEach(img => {
        if (img.src && img.src.includes('twimg.com')) {
            img.decoding = 'async';
        }
    });
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizer);
} else {
    initOptimizer();
}

