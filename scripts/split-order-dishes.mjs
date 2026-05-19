import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('pages');
const srcPath = path.join(root, 'order-dishes.page.ts');
const outDir = path.join(root, 'order-dishes');
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Types: lines 11-96
const typesContent = `${slice(11, 96)}\n`;
fs.writeFileSync(path.join(outDir, 'order-dishes.types.ts'), typesContent);

// Store method bodies for sections (1-based line numbers from grep)
const sections = {
  menu: [
    [400, 542],
    [610, 772],
    [1766, 1816],
    [2659, 2873], // dish/menu/combo private helpers at end
  ],
  modifier: [
    [544, 608],
    [2133, 2151],
    [2496, 2615],
  ],
  charge: [
    [774, 1008],
    [1854, 2312],
    [2106, 2131],
  ],
  reads: [
    [1010, 1703],
    [1099, 1165],
    [2474, 2494],
  ],
  facadeNav: [
    [392, 399],
    [1705, 1764],
    [1818, 1852],
    [2189, 2216],
    [2356, 2424],
  ],
};

for (const [name, ranges] of Object.entries(sections)) {
  const body = ranges.map(([s, e]) => slice(s, e)).join('\n\n');
  fs.writeFileSync(path.join(outDir, `_extract-${name}.txt`), body);
}

console.log('Extracted', Object.keys(sections).length, 'section bodies from', lines.length, 'lines');
