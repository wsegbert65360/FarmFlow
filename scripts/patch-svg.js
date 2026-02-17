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
            console.log('Successfully patched react-native-svg for Windows stability.');
        }
    } catch (e) {
        console.error('Failed to patch react-native-svg:', e.message);
    }
} else {
    console.warn('react-native-svg not found in node_modules, skipping patch.');
}
