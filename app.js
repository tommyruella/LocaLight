import { LocalLightEngine } from './engine.js';
import { parseCubeLUT } from './lut-parser.js';

// Elements
const homeScreen = document.getElementById('home-screen');
const editorWorkspace = document.getElementById('editor-workspace');
const fileInputHome = document.getElementById('file-input-home');
const btnBack = document.getElementById('btn-back');
const btnExport = document.getElementById('btn-export');
const canvas = document.getElementById('main-canvas');

// State
let engine = null;
let currentImage = null;

// Initialize PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            console.log('SW registered: ', registration);
        }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}

// Navigation
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Initialize Engine
function initEngine() {
    if (!engine) {
        engine = new LocalLightEngine(canvas);
        setupSliders();
        setupMenus();
        setupWheels();
        setupMixPanel();
    }
}

const wheelState = {
    u_lift: { h: 0, s: 0, lum: 0 },
    u_gamma: { h: 0, s: 0, lum: 0 },
    u_gain: { h: 0, s: 0, lum: 0 }
};

const mixState = [
    {h: 0, s: 0, l: 0}, // 0 Red
    {h: 0, s: 0, l: 0}, // 1 Orange
    {h: 0, s: 0, l: 0}, // 2 Yellow
    {h: 0, s: 0, l: 0}, // 3 Green
    {h: 0, s: 0, l: 0}, // 4 Cyan
    {h: 0, s: 0, l: 0}, // 5 Blue
    {h: 0, s: 0, l: 0}, // 6 Purple
    {h: 0, s: 0, l: 0}  // 7 Magenta
];
let activeMixColor = 0;
const mixBaseHues = [0, 30, 60, 120, 180, 240, 270, 300];

function hsvToRgb(h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [r, g, b];
}

function updateWheelUniform(name) {
    if (!engine) return;
    const state = wheelState[name];
    // Scale saturation down to make wheels less aggressive (professional feel)
    const rgb = hsvToRgb(state.h, state.s * 0.35, 1.0);
    
    let outVec = [0,0,0];
    if (name === 'u_lift') {
        let lum = state.lum * 0.2;
        outVec = [
            (rgb[0] - 1.0) * 0.2 + lum,
            (rgb[1] - 1.0) * 0.2 + lum,
            (rgb[2] - 1.0) * 0.2 + lum
        ];
    } else if (name === 'u_gamma') {
        let lumMult = Math.pow(2.0, state.lum * 1.5);
        outVec = [ rgb[0] * lumMult, rgb[1] * lumMult, rgb[2] * lumMult ];
    } else if (name === 'u_gain') {
        let lumMult = Math.pow(2.0, state.lum * 2.0);
        outVec = [ rgb[0] * lumMult, rgb[1] * lumMult, rgb[2] * lumMult ];
    }
    engine.setUniform(name, outVec);
}

function setupWheels() {
    const wheels = document.querySelectorAll('.color-wheel-container');
    wheels.forEach(wheel => {
        const thumb = wheel.querySelector('.color-wheel-thumb');
        const uniformName = wheel.getAttribute('data-uniform');
        let isDragging = false;
        
        const updateThumb = (e) => {
            const rect = wheel.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            let dx = clientX - cx;
            let dy = clientY - cy;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let maxDist = rect.width / 2;
            
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
                dist = maxDist;
            }
            
            thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            
            let angle = Math.atan2(dy, dx);
            let hue = (angle + Math.PI / 2) / (Math.PI * 2);
            if (hue < 0) hue += 1.0;
            let sat = dist / maxDist;
            
            wheelState[uniformName].h = hue;
            wheelState[uniformName].s = sat;
            updateWheelUniform(uniformName);
        };
        
        let lastTap = 0;
        const handleDown = (e) => {
            const currentTime = new Date().getTime();
            if (currentTime - lastTap < 300 && currentTime - lastTap > 0) {
                // Double tap reset
                wheelState[uniformName].h = 0;
                wheelState[uniformName].s = 0;
                thumb.style.transform = `translate(-50%, -50%)`;
                updateWheelUniform(uniformName);
                isDragging = false;
            } else {
                isDragging = true; 
                updateThumb(e);
            }
            lastTap = currentTime;
        };
        
        wheel.addEventListener('mousedown', handleDown);
        wheel.addEventListener('touchstart', handleDown, {passive: true});
        window.addEventListener('mousemove', (e) => { if (isDragging) updateThumb(e); });
        window.addEventListener('touchmove', (e) => { if (isDragging) updateThumb(e); }, {passive: true});
        window.addEventListener('mouseup', () => isDragging = false);
        window.addEventListener('touchend', () => isDragging = false);
    });

    // Wheels Carousel Logic
    let currentWheelIndex = 0;
    const wheelsArray = ['lift', 'gamma', 'gain'];
    const wheelNames = ['Lift', 'Gamma', 'Gain'];

    const updateWheelView = () => {
        wheelsArray.forEach((w, i) => {
            document.getElementById(`wg-${w}`).style.display = (i === currentWheelIndex) ? 'flex' : 'none';
        });
        document.getElementById('wheel-current-name').textContent = wheelNames[currentWheelIndex];
    };

    document.getElementById('btn-wheel-prev').addEventListener('click', () => {
        currentWheelIndex = (currentWheelIndex - 1 + 3) % 3;
        updateWheelView();
    });
    
    document.getElementById('btn-wheel-next').addEventListener('click', () => {
        currentWheelIndex = (currentWheelIndex + 1) % 3;
        updateWheelView();
    });
}

// Setup Slider Event Listeners
function setupSliders() {
    const sliders = document.querySelectorAll('.custom-slider');
    sliders.forEach(input => {
        const uniformName = input.getAttribute('data-uniform');
        if (uniformName) {
            input.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                
                // Update UI text display (+10%, -20%)
                const displaySpan = e.target.parentElement.querySelector('.val-display');
                if (displaySpan) {
                    const prefix = val > 0 ? '+' : '';
                    displaySpan.textContent = `${prefix}${val}%`;
                }
                
                val = val / 100.0; // normalize
                
                if (uniformName.endsWith('_lum')) {
                    const baseName = uniformName.replace('_lum', ''); // 'u_lift'
                    if (wheelState[baseName]) {
                        wheelState[baseName].lum = val;
                        updateWheelUniform(baseName);
                    }
                } else if (engine) {
                    engine.setUniform(uniformName, val);
                }
            });
        }
    });

    // Mobile-friendly double tap to reset
    const sliderGroups = document.querySelectorAll('.slider-group');
    sliderGroups.forEach(group => {
        let lastTap = 0;
        
        const handleTap = (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 300 && tapLength > 0) {
                const slider = group.querySelector('.custom-slider');
                if (slider) {
                    slider.value = 0;
                    slider.dispatchEvent(new Event('input'));
                }
            }
            lastTap = currentTime;
        };
        
        group.addEventListener('touchstart', handleTap, { passive: true });
        group.addEventListener('mousedown', handleTap);
    });
}

function resetSliders() {
    const sliders = document.querySelectorAll('.custom-slider');
    sliders.forEach(slider => {
        slider.value = 0;
        const displaySpan = slider.parentElement.querySelector('.val-display');
        if (displaySpan) {
            displaySpan.textContent = '0%';
        }
    });

    // Reset wheels
    if (typeof wheelState !== 'undefined') {
        Object.keys(wheelState).forEach(name => {
            wheelState[name].h = 0;
            wheelState[name].s = 0;
            wheelState[name].lum = 0;
        });
        
        const thumbs = document.querySelectorAll('.color-wheel-thumb');
        thumbs.forEach(thumb => {
            thumb.style.transform = `translate(-50%, -50%)`;
        });
    }
}

// Setup Menu Interactions
function setupMenus() {
    // Collapsible panel logic
    const panelHeaders = document.querySelectorAll('.panel-header');
    panelHeaders.forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('collapsed');
        });
    });

    // Sub-nav interactions
    const subNavBtns = document.querySelectorAll('.sub-nav-btn');
    const panels = {
        'Light': document.getElementById('panel-light'),
        'Color': document.getElementById('panel-color'),
        'Mix': document.getElementById('panel-mix'),
        'WB': document.getElementById('panel-wb'),
        'Details': document.getElementById('panel-details'),
        'LUTs': document.getElementById('panel-luts'),
        'Wheels': document.getElementById('panel-wheels')
    };

    let currentActiveMenu = 'Light';

    subNavBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedMenu = e.target.textContent.trim();
            const targetPanel = panels[selectedMenu];
            
            // If clicking the already active menu, toggle its collapse state
            if (currentActiveMenu === selectedMenu) {
                if (targetPanel) {
                    targetPanel.classList.toggle('collapsed');
                }
                return;
            }
            
            currentActiveMenu = selectedMenu;

            // Update active state
            subNavBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Show corresponding panel and hide others
            Object.keys(panels).forEach(key => {
                const panel = panels[key];
                if (!panel) return;
                
                if (key === selectedMenu) {
                    panel.style.display = 'flex';
                    panel.classList.remove('collapsed');
                } else {
                    panel.style.display = 'none';
                    panel.classList.add('collapsed');
                }
            });
        });
    });

    // Main nav logic
    const mainNavBtns = document.querySelectorAll('.main-nav-btn');
    mainNavBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find closest button in case SVG is clicked
            const targetBtn = e.target.closest('.main-nav-btn');
            if(targetBtn) {
                mainNavBtns.forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
            }
        });
    });
}

// Event Listeners
btnBack.addEventListener('click', () => {
    showScreen(homeScreen);
    currentImage = null;
    fileInputHome.value = ''; // Reset input
});

// Compare functionality (Hold to view original)
const btnCompare = document.getElementById('btn-compare');
const startCompare = () => { if (engine) engine.setBypass(true); };
const stopCompare = () => { if (engine) engine.setBypass(false); };

btnCompare.addEventListener('mousedown', startCompare);
btnCompare.addEventListener('touchstart', startCompare, { passive: true });
canvas.addEventListener('mousedown', startCompare);
canvas.addEventListener('touchstart', startCompare, { passive: true });

window.addEventListener('mouseup', stopCompare);
window.addEventListener('touchend', stopCompare, { passive: true });
window.addEventListener('touchcancel', stopCompare, { passive: true });

fileInputHome.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            try {
                currentImage = img;
                initEngine();
                engine.loadImage(img);
                engine.resetState();
                resetSliders();
                showScreen(editorWorkspace);
            } catch (err) {
                alert("Error loading image: " + err.message + "\n\nStack: " + err.stack);
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

const lutInput = document.getElementById('lut-input');
if (lutInput) {
    lutInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !engine) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const lutData = parseCubeLUT(event.target.result);
                engine.loadLUT(lutData);
                
                // Update UI slider for intensity to 100% since it's turned on
                const intensitySlider = document.querySelector('[data-uniform="u_lut_intensity"]');
                if (intensitySlider) {
                    intensitySlider.value = 100;
                    intensitySlider.dispatchEvent(new Event('input'));
                }
            } catch(err) {
                alert('Error loading LUT: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
}

btnExport.addEventListener('click', () => {
    if (!currentImage || !engine) return;
    
    // Request a render immediately before export just in case
    engine.render();
    
    // Export high-res image from WebGL canvas
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    
    // Create temporary link to download
    const link = document.createElement('a');
    link.download = `LocalLight_${Date.now()}.jpg`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

function updateMixUniforms() {
    if (!engine) return;
    const flatMix = new Float32Array(24);
    for(let i = 0; i < 8; i++) {
        flatMix[i*3]   = mixState[i].h;
        flatMix[i*3+1] = mixState[i].s;
        flatMix[i*3+2] = mixState[i].l;
    }
    engine.state['u_hsl_shifts'] = flatMix;
    engine.render();
}

function updateMixSlidersUI() {
    const hueSlider = document.getElementById('mix-hue-slider');
    const satSlider = document.getElementById('mix-sat-slider');
    const lumSlider = document.getElementById('mix-lum-slider');
    
    if (!hueSlider || !satSlider || !lumSlider) return;
    
    // Set values
    const state = mixState[activeMixColor];
    hueSlider.value = state.h * 100;
    satSlider.value = state.s * 100;
    lumSlider.value = state.l * 100;
    
    hueSlider.previousElementSibling.querySelector('.val-display').textContent = Math.round(state.h * 100) + '%';
    satSlider.previousElementSibling.querySelector('.val-display').textContent = Math.round(state.s * 100) + '%';
    lumSlider.previousElementSibling.querySelector('.val-display').textContent = Math.round(state.l * 100) + '%';
    
    // Update CSS gradients
    const baseH = mixBaseHues[activeMixColor];
    hueSlider.style.background = `linear-gradient(to right, hsl(${baseH-45}, 100%, 50%), hsl(${baseH}, 100%, 50%), hsl(${baseH+45}, 100%, 50%))`;
    satSlider.style.background = `linear-gradient(to right, hsl(${baseH}, 0%, 50%), hsl(${baseH}, 100%, 50%))`;
    lumSlider.style.background = `linear-gradient(to right, #000, hsl(${baseH}, 100%, 50%), #fff)`;
}

function setupMixPanel() {
    const dots = document.querySelectorAll('.color-dot');
    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            dots.forEach(d => d.classList.remove('active'));
            e.target.classList.add('active');
            activeMixColor = parseInt(e.target.dataset.colorIndex);
            updateMixSlidersUI();
        });
    });
    
    const mixSliders = document.querySelectorAll('.mix-slider');
    mixSliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const type = e.target.dataset.type; // h, s, or l
            mixState[activeMixColor][type] = parseFloat(e.target.value) / 100.0;
            e.target.previousElementSibling.querySelector('.val-display').textContent = e.target.value + '%';
            updateMixUniforms();
        });
    });
    
    updateMixSlidersUI();
}
