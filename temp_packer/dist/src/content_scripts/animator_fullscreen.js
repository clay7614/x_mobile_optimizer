/**
 * animator_fullscreen.js
 * Handles the fullscreen toggle button functionality.
 */

// Fullscreen Toggle
function createFullscreenButton() {
    if (document.getElementById('x-fullscreen-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'x-fullscreen-btn';
    btn.className = 'x-fullscreen-btn';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
    `;
    btn.title = 'フルスクリーン';

    btn.addEventListener('click', toggleFullscreen);
    document.body.appendChild(btn);
}

function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        enterFullscreen();
    } else {
        exitFullscreen();
    }
}

function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(e => console.log('Fullscreen blocked:', e));
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
}

function removeFullscreenButton() {
    const btn = document.getElementById('x-fullscreen-btn');
    if (btn) {
        btn.removeEventListener('click', toggleFullscreen);
        btn.remove();
    }
}
