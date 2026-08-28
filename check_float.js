let count = 1024 * 1024;
let sum = 0;
for(let i=0; i<count; i++) {
    sum += 3.0 / 255.0;
}
let mae = sum / count;
console.log("Calculated MAE: " + mae);
console.log("Expected MAE:   " + (3.0/255.0));
console.log("Difference:     " + (mae - (3.0/255.0)));
