document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const lightboxToggle = document.getElementById('lightboxToggle');
    const rippleToggle = document.getElementById('rippleToggle');
    const buttonScaleToggle = document.getElementById('buttonScaleToggle');
    const fullscreenToggle = document.getElementById('fullscreenToggle');
    const optimizeToggle = document.getElementById('optimizeToggle');

    // Load saved settings
    chrome.storage.local.get(['config', 'animationConfig'], (result) => {
        // Defaults
        const animConfig = result.animationConfig || {};
        const config = result.config || {};

        // Animation Settings
        lightboxToggle.checked = animConfig.enableLightbox !== false;
        rippleToggle.checked = animConfig.enableRipple !== false;
        buttonScaleToggle.checked = animConfig.enableButtonScale !== false;

        // Fullscreen Mode logic
        // Treat 1 (Manual/On) as true
        let fsEnabled = true; // Default to true
        if (animConfig.fullscreenMode !== undefined) {
            fsEnabled = animConfig.fullscreenMode >= 1;
        } else if (animConfig.enableFullscreenBtn !== undefined) {
            fsEnabled = animConfig.enableFullscreenBtn;
        }

        if (fullscreenToggle) {
            fullscreenToggle.checked = fsEnabled;
        }

        // Optimization Settings
        optimizeToggle.checked = config.optimizeMedia !== false;
    });

    // Event Listeners for auto-save
    lightboxToggle.addEventListener('change', saveConfig);
    rippleToggle.addEventListener('change', saveConfig);
    buttonScaleToggle.addEventListener('change', saveConfig);
    if (fullscreenToggle) {
        fullscreenToggle.addEventListener('change', saveConfig);
    }
    optimizeToggle.addEventListener('change', saveConfig);

    function saveConfig() {
        // Sync fullscreenMode for legacy or other parts but rely on boolean primarily
        // 0: Off, 1: Manual (On)
        let fsMode = 1;
        let fsBtn = true;

        if (fullscreenToggle) {
            fsBtn = fullscreenToggle.checked;
            fsMode = fullscreenToggle.checked ? 1 : 0;
        }

        const animationConfig = {
            enableLightbox: lightboxToggle.checked,
            enableRipple: rippleToggle.checked,
            enableButtonScale: buttonScaleToggle.checked,
            enableFullscreenBtn: fsBtn,
            fullscreenMode: fsMode
        };

        const config = {
            optimizeMedia: optimizeToggle.checked
        };

        chrome.storage.local.set({ config, animationConfig }, () => {
            console.log('Settings saved');
        });
    }
});
