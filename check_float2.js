let pixels = [128, 128, 128, 125, 125, 125]; // Example
let r1 = 128/255.0, g1 = 128/255.0, b1 = 128/255.0;
let L1 = 0.299*r1 + 0.587*g1 + 0.114*b1;
let r2 = 125/255.0, g2 = 125/255.0, b2 = 125/255.0;
let L2 = 0.299*r2 + 0.587*g2 + 0.114*b2;
let diff = Math.abs(L1 - L2);
console.log("Diff: " + diff);
console.log("Ref:  " + 3.0/255.0);
console.log(diff > 3.0/255.0);

// What if the RGB values diverge by 3 in a way that maximizes L?
// e.g. R changes by 0, G by 5, B by 0 -> diff = 5 * 0.587 / 255 = 2.935 / 255 < 3/255.
// If diff is 0.011764705882353121, let's see what RGB values produce it.
for(let dr=-5; dr<=5; dr++) {
  for(let dg=-5; dg<=5; dg++) {
    for(let db=-5; db<=5; db++) {
       let dL = Math.abs(0.299*dr + 0.587*dg + 0.114*db) / 255.0;
       if (dL > 0.011764 && dL < 0.011765) {
           console.log(`dr=${dr}, dg=${dg}, db=${db} -> dL=${dL}`);
       }
    }
  }
}
