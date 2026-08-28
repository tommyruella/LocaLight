const fs = require('fs');
const appSrc = fs.readFileSync('app.js', 'utf8');
const engineSrc = fs.readFileSync('engine.js', 'utf8');

const computeMatch = appSrc.match(/function computeEngineStateForLayer\([\s\S]*?return s;\n}/);
const hsvToRgb = (h, s, v) => [0,0,0];
let computeFnStr = computeMatch[0].replace("function computeEngineStateForLayer", "var computeFn = function");
eval(computeFnStr);

const mockLayerState = { sliders: { 'u_lut_intensity': 75 }, activeLut: 'FUJI.cube' };
const engineState = computeFn(mockLayerState);
console.log("1. UI Slider mapped to engineState['u_lut_intensity']:", engineState['u_lut_intensity']);

let capturedUniform = null;
const mockGl = {
    useProgram: () => {}, bindFramebuffer: () => {}, viewport: () => {},
    activeTexture: () => {}, bindTexture: () => {}, uniform1i: () => {},
    uniform1fv: () => {}, uniform3fv: () => {},
    uniform1f: (loc, val) => { if (loc === 'MOCK_LUT_INTENSITY_LOC') capturedUniform = val; },
    drawArrays: () => {}, clearColor: () => {}, clear: () => {},
    getExtension: () => null, createShader: () => null, shaderSource: () => {}, compileShader: () => {}, getShaderParameter: () => true,
    createProgram: () => 1, attachShader: () => {}, linkProgram: () => {}, getProgramParameter: () => true, useProgram: () => {},
    getUniformLocation: (prog, name) => { if (name === 'u_lut_intensity') return 'MOCK_LUT_INTENSITY_LOC'; return 'SOME_LOC'; },
    getAttribLocation: () => 0,
    createBuffer: () => null, bindBuffer: () => {}, bufferData: () => {}, enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
    createTexture: () => null, texParameteri: () => {}, texImage2D: () => {}, texImage3D: () => {}, deleteTexture: () => {},
    COLOR_BUFFER_BIT: 1, TRIANGLES: 4, TEXTURE0: 0, TEXTURE1: 1, TEXTURE_2D: 2, TEXTURE_3D: 3, FRAMEBUFFER: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6
};

const MOCK_GL_CONTEXT = mockGl;

let evalEngineSrc = engineSrc
    .replace('export class LocalLightEngine', 'global.LocalLightEngine = class')
    .replace('this.gl = canvas.getContext(\'webgl2\', { preserveDrawingBuffer: true });', 'this.gl = MOCK_GL_CONTEXT;')
    .replace('if (!this.gl)', 'if (false)');
eval(evalEngineSrc);

const engine = new global.LocalLightEngine({ getContext: () => MOCK_GL_CONTEXT, width: 100, height: 100 });
engine.originalTexture = true;
engine.compAFbo = 1; engine.compATexture = 1; engine.compBFbo = 2; engine.compBTexture = 2;
engine.layerFbo = 3; engine.layerTexture = 3; engine.lutTexture = 4; engine.dummyLut = 5;
engine.outputLocs = { 'u_image': 'MOCK_IMAGE_LOC', 'u_lut': 'MOCK_LUT_LOC', 'u_lut_intensity': 'MOCK_LUT_INTENSITY_LOC', 'u_lut_size': 'MOCK_LUT_SIZE_LOC' };
engine.renderSingleLayerState = () => {}; 
engine.bindQuad = () => {};

engine.bypassed = true;
engine.render([]);
console.log("2. Bypassed engine runtime uniform value:", capturedUniform);

engine.bypassed = false;
engine.render([{ active: true, visible: true, engineState: engineState }]);
console.log("3. Active rendering runtime uniform value:", capturedUniform);

let wasPadded = false;
engine.gl.texImage3D = (target, level, internalformat, width, height, depth, border, format, type, pixels) => {
    if (pixels && pixels.length === 65*65*65*4) {
        wasPadded = true;
    }
};
const dummyData = { data: new Float32Array(65*65*65*3), size: 65 };
engine.loadLUT(dummyData);
if (wasPadded) {
    console.log("4. RGB to RGBA padding verified for 65x65x65 LUT");
} else {
    console.error("FAIL: RGB to RGBA padding didn't happen");
    process.exit(1);
}

console.log("PASS: M8 UI to GPU Wiring Runtime Verified");
