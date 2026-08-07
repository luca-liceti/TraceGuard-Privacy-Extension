const cx = 100;
const cy = 100;
const radius = 95;
const angle = 90; // 12 o'clock in recharts
const rad = Math.PI / 180;
const x = cx + radius * Math.cos(-angle * rad);
const y = cy + radius * Math.sin(-angle * rad);
console.log({x, y}); // for 90 degrees, should be x=100, y=5 (100 - 95)
