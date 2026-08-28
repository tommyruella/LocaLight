const fs = require('fs');
// Very naive parser to check midpoint
const data = fs.readFileSync('FUJI.cube', 'utf8').split('\n');
let size = 0;
let values = [];
for (let line of data) {
    if (line.startsWith('LUT_3D_SIZE')) size = parseInt(line.split(' ')[1]);
    else if (!line.startsWith('#') && !line.startsWith('DOMAIN') && !line.startsWith('TITLE') && line.trim().length > 0) {
        let p = line.trim().split(/\s+/).map(Number);
        if (p.length === 3) values.push(p);
    }
}
let mid = Math.floor(size / 2);
let idx = mid + mid*size + mid*size*size;
console.log(`LUT Size: ${size}`);
console.log(`Midpoint index: [${mid}, ${mid}, ${mid}] -> flat index ${idx}`);
console.log(`Value at midpoint:`, values[idx]);
