const fs = require('fs');
const file = 'src/components/radial-chart-score.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  '<feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.35" floodColor="#000" />',
  '<feDropShadow dx="4" dy="0" stdDeviation="4" floodOpacity="0.5" floodColor="#000" />'
);
fs.writeFileSync(file, content);
