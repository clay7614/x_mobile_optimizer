document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const speedToggle = document.getElementById('speedModeToggle');
    const speedOptions = document.getElementById('speedOptions');
    const removeAdsCheck = document.getElementById('removeAds');
    const removeSidebarCheck = document.getElementById('removeSidebar');

    const motionToggle = document.getElementById('motionModeToggle');

    // Load saved settings
    chrome.storage.local.get(['config', 'animationConfig'], (result) => {
        // Speed Config
        if (result.config) {
            removeAdsCheck.checked = result.config.removeAds !== false;
            removeSidebarCheck.checked = result.config.removeSidebar !== false;

            // If either is true, assume speed mode is somewhat active
            // For simplicity, we track a master 'speedMode' flag or derive it
            speedToggle.checked = result.config.speedModeEnabled !== false;
        } else {
            // Defaults
            speedToggle.checked = true;
            removeAdsCheck.checked = true;
            removeSidebarCheck.checked = true;
        }

        // Animation Config
        if (result.animationConfig) {
            motionToggle.checked = result.animationConfig.enableAnimations !== false;
        } else {
            motionToggle.checked = true;
        }

        updateUI();
    });

    // Event Listeners
    speedToggle.addEventListener('change', () => {
        updateUI();
        saveConfig();
    });

    motionToggle.addEventListener('change', () => {
        saveConfig();
    });

    removeAdsCheck.addEventListener('change', saveConfig);
    removeSidebarCheck.addEventListener('change', saveConfig);

    function updateUI() {
        // Show/Hide sub-options based on Speed Mode toggle
        if (speedToggle.checked) {
            speedOptions.classList.add('visible');
        } else {
            speedOptions.classList.remove('visible');
        }
    }

    function saveConfig() {
        const config = {
            speedModeEnabled: speedToggle.checked,
            removeAds: speedToggle.checked && removeAdsCheck.checked,
            removeSidebar: speedToggle.checked && removeSidebarCheck.checked
        };

        const animationConfig = {
            enableAnimations: motionToggle.checked
        };

        chrome.storage.local.set({ config, animationConfig }, () => {
            console.log('Settings saved');
            // Notify tabs to update immediately (Optional enhancement)
        });
    }
});
