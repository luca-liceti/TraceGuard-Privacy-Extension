const fs = require('fs');
const file = 'src/components/traceguard/site-details-panel.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("getIndicatorTextColor")) {
    content = content.replace(
        'getNetworkStatusTextColor } from "@/lib/theme-utils"',
        'getNetworkStatusTextColor, getIndicatorTextColor } from "@/lib/theme-utils"'
    );
}

// Replace exact class strings with template literals
content = content.replace(/className="([^"]*)text-success([^"]*)"/g, 'className={`$1${getIndicatorTextColor(\'success\')}$2`}');
content = content.replace(/className="([^"]*)text-warning([^"]*)"/g, 'className={`$1${getIndicatorTextColor(\'warning\')}$2`}');
content = content.replace(/className="([^"]*)text-destructive([^"]*)"/g, 'className={`$1${getIndicatorTextColor(\'error\')}$2`}');

// For classes already in template literals
content = content.replace(/text-success/g, '${getIndicatorTextColor(\'success\')}');
content = content.replace(/text-warning/g, '${getIndicatorTextColor(\'warning\')}');
content = content.replace(/text-destructive/g, '${getIndicatorTextColor(\'error\')}');

// Clean up double template literal injects like `${${...}}`
content = content.replace(/\$\{getIndicatorTextColor\('success'\)\}/g, '${getIndicatorTextColor(\'success\')}');
// Wait, the previous two replace calls might conflict. 
// Instead, let's just do a simpler literal replacement.
