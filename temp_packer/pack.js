const fs = require('fs');
const path = require('path');
const ChromeExtension = require('crx');
const { generateKeyPairSync } = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const assetsDir = path.join(rootDir, 'assets');
const manifestPath = path.join(rootDir, 'manifest.json');

// Generate Key
console.log('Generating private key...');
const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const crx = new ChromeExtension({ privateKey });

// Prepare dist folder
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

function copyRecursive(src, dest) {
    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(child => copyRecursive(path.join(src, child), path.join(dest, child)));
    } else {
        fs.copyFileSync(src, dest);
    }
}

try {
    copyRecursive(srcDir, path.join(distDir, 'src'));
    copyRecursive(assetsDir, path.join(distDir, 'assets'));
    fs.copyFileSync(manifestPath, path.join(distDir, 'manifest.json'));
} catch (e) {
    console.error('Copy failed:', e);
    process.exit(1);
}

console.log('Packing...');
crx.load(distDir)
    .then(crxInstance => crxInstance.pack())
    .then(crxBuffer => {
        const outputPath = path.join(rootDir, 'x_mobile_optimizer.crx');
        fs.writeFileSync(outputPath, crxBuffer);
        console.log(`Success: CRX created at ${outputPath}`);
    })
    .catch(err => {
        console.error('Pack failed:', err);
        process.exit(1);
    });
