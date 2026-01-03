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
    // 非同期処理でメインスレッドをブロックしない
    // 各最適化を個別のマイクロタスクとして実行

    // 1. Content Visibility for Timeline Cells (優先度高)
    optimizeCells();

    // 2. 画像最適化 (次フレームで実行)
    setTimeout(optimizeImages, 0);

    // 3. 動画最適化 (次フレームで実行)
    setTimeout(optimizeVideos, 0);
}

function optimizeCells() {
    const cells = document.querySelectorAll('[data-testid="cellInnerDiv"]:not([data-xmo-opt="true"])');
    cells.forEach(cell => {
        cell.style.contentVisibility = 'auto';
        cell.style.containIntrinsicSize = '1px 300px';
        cell.dataset.xmoOpt = 'true';
    });
}

function optimizeImages() {
    // 画像の非同期デコードとlazyロード
    const images = document.querySelectorAll('img:not([data-xmo-img="true"])');
    images.forEach(img => {
        if (img.src && img.src.includes('twimg.com')) {
            img.decoding = 'async';
            img.loading = 'lazy';
            img.dataset.xmoImg = 'true';
        }
    });
}

function optimizeVideos() {
    // 動画のプリロード制御 - 帯域幅とメモリ使用量を削減
    const videos = document.querySelectorAll('video:not([data-xmo-vid="true"])');
    videos.forEach(video => {
        // 自動再生動画はmetadataのみプリロード
        // ユーザーが明示的に再生するまでフル読み込みしない
        if (video.autoplay || video.muted) {
            video.preload = 'metadata';
        } else {
            video.preload = 'none';
        }
        video.dataset.xmoVid = 'true';
    });
}

function optimizeAnimationElements() {
    // よくアニメーションする要素にGPUレイヤーを事前作成
    // これによりアニメーション開始時のレイヤー作成コストを削減

    // ツイートのアクションボタン (いいね、RT、リプライなど)
    const actionButtons = document.querySelectorAll(
        '[data-testid="like"]:not([data-xmo-anim="true"]),' +
        '[data-testid="unlike"]:not([data-xmo-anim="true"]),' +
        '[data-testid="retweet"]:not([data-xmo-anim="true"]),' +
        '[data-testid="unretweet"]:not([data-xmo-anim="true"]),' +
        '[data-testid="reply"]:not([data-xmo-anim="true"]),' +
        '[data-testid="bookmark"]:not([data-xmo-anim="true"])'
    );

    actionButtons.forEach(btn => {
        btn.style.willChange = 'transform';
        btn.dataset.xmoAnim = 'true';
    });

    // モーダルやダイアログ (出現時にアニメーション)
    const modals = document.querySelectorAll('[role="dialog"]:not([data-xmo-anim="true"])');
    modals.forEach(modal => {
        modal.style.willChange = 'transform, opacity';
        modal.dataset.xmoAnim = 'true';
    });
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizer);
} else {
    initOptimizer();
}

