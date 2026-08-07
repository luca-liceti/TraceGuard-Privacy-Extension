const fs = require('fs');
const file = 'src/components/radial-chart-score.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props',
  'const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;\n  console.log("SHAPE PROPS:", {innerRadius, outerRadius});'
);
fs.writeFileSync(file, content);
