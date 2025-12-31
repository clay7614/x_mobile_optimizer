/**
 * optimizer.js
 * Handles performance optimizations for X on mobile web.
 */

console.log('X Mobile Optimizer: Loaded');

// Configuration
const CONFIG = {
    removeAds: true,
    removeSidebar: true,
    optimizeMedia: true,
    debug: false
};

// Selectors
const SELECTORS = {
    // Common ad indicators
    adPlacement: '[data-testid="placementTracking"]',
    // Specific text indicators often found in ads (Promoted, etc)
    promotedLabel: 'span:contains("Promoted")', // Helper needed for :contains

    // Sidebar elements
    sidebarColumn: '[data-testid="sidebarColumn"]',
    trending: '[data-testid="trend"]',
    whoToFollow: '[data-testid="UserCell"]', // Be careful with this one

    // Navigation distractions
    grokButton: '[aria-label="Grok"]',
    verifiedOrg: '[aria-label="Verified Organizations"]',
    premiumEntry: '[aria-label="Premium"]',
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
    if (CONFIG.removeAds) removeAds();
    if (CONFIG.removeSidebar) removeSidebar();
    if (CONFIG.optimizeMedia) optimizeMedia();
}

// --- Optimization Logic ---

function removeAds() {
    // 1. Data-testid based removal (Most reliable)
    const ads = document.querySelectorAll(SELECTORS.adPlacement);
    ads.forEach(ad => {
        // Hide the parent cell that contains the ad
        const tweetCell = ad.closest('[data-testid="cellInnerDiv"]');
        if (tweetCell && tweetCell.style.display !== 'none') {
            tweetCell.style.display = 'none';
            log('Removed ad via placementTracking');
        }
    });

    // 2. SVG Path based removal (For "Promoted" label icons if text is obfuscated)
    // This is brittle, using text content check as a backup on specific spans if needed.
    // Currently rely on native DOM structures as much as possible.
}

function removeSidebar() {
    // On mobile, the sidebar is usually hidden or different.
    // This targets desktop/tablet views mainly.
    const sidebar = document.querySelector(SELECTORS.sidebarColumn);
    if (sidebar && sidebar.style.display !== 'none') {
        sidebar.style.display = 'none';
        log('Hidden Sidebar');
    }

    // Hide extraneous nav items on mobile drawer or bottom bar if accessible
    // Nav items usually have aria-labels
    const unwantedNavs = [SELECTORS.grokButton, SELECTORS.verifiedOrg];
    unwantedNavs.forEach(selector => {
        const el = document.querySelector(selector);
        if (el && el.style.display !== 'none') {
            el.style.display = 'none';
        }
    });
}

function optimizeMedia() {
    // Set content-visibility to auto for off-screen interaction improvements
    // This is a browser-native feature, harmless to apply broadly on big lists
    const timeline = document.querySelector('[aria-label="Timeline: Your Home Timeline"]');
    if (timeline) {
        // Applying to children cells
        // Careful not to break scroll position logic of virtual lists
        // React virtual lists manage DOM mounting, so content-visibility might conflict.
        // Instead, we can force lower quality images if we could intercept network requests,
        // but that requires more permissions.

        // For now, let's just ensure video autoplay is managed effectively if we can access video tags
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            // Logic to pause off-screen videos could go here if not native
        });
    }
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizer);
} else {
    initOptimizer();
}

