const RADIAN = Math.PI / 180;
const polarToCartesian = (cx, cy, radius, angle) => ({
  x: cx + Math.cos(-angle * RADIAN) * radius,
  y: cy + Math.sin(-angle * RADIAN) * radius,
});
console.log(polarToCartesian(100, 100, 50, 90)); // 90 is top, expecting y < 100
