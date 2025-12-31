const sharp = require('sharp');
const path = require('path');

const svgPath = path.resolve(__dirname, '../assets/icon.svg');
const assetsDir = path.resolve(__dirname, '../assets');

async function generateIcons() {
    try {
        console.log('Generating icons from SVG...');

        // 16x16
        await sharp(svgPath)
            .resize(16, 16)
            .toFile(path.join(assetsDir, 'icon_16.png'));

        // 48x48
        await sharp(svgPath)
            .resize(48, 48)
            .toFile(path.join(assetsDir, 'icon_48.png'));

        // 128x128
        await sharp(svgPath)
            .resize(128, 128)
            .toFile(path.join(assetsDir, 'icon_128.png'));

        console.log('Icons generated successfully.');
    } catch (err) {
        console.error('Error generating icons:', err);
        process.exit(1);
    }
}

generateIcons();
