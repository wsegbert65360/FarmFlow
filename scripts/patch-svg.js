const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../node_modules/react-native-svg/package.json');

if (fs.existsSync(pkgPath)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'react-native-svg') {
            // Force the react-native entry point to use compiled assets
            // This avoids the common Metro resolution error on Windows 
            // where it fails to find modules inside the 'src' directory.
            pkg['react-native'] = 'lib/commonjs/index.js';
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
            console.log('Successfully patched react-native-svg package.json.');

            // Fix internal relative imports that fail on Windows Metro
            const elementsDir = path.join(__dirname, '../node_modules/react-native-svg/lib/commonjs/elements');
            if (fs.existsSync(elementsDir)) {
                fs.readdirSync(elementsDir).forEach(file => {
                    if (file.endsWith('.js')) {
                        const filePath = path.join(elementsDir, file);
                        let content = fs.readFileSync(filePath, 'utf8');
                        if (content.includes('../lib/SvgTouchableMixin') && !content.includes('../lib/SvgTouchableMixin.js')) {
                            content = content.replace(/\.\.\/lib\/SvgTouchableMixin/g, '../lib/SvgTouchableMixin.js');
                            fs.writeFileSync(filePath, content);
                            console.log(`Patched ${file} with explicit extension.`);
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.error('Failed to patch react-native-svg:', e.message);
    }
} else {
    console.warn('react-native-svg not found in node_modules, skipping patch.');
}
