import { LocalLightEngine } from './engine.js';
import { parseCubeLUT } from './lut-parser.js';

// Elements
const homeScreen = document.getElementById('home-screen');
const editorWorkspace = document.getElementById('editor-workspace');
const fileInputHome = document.getElementById('file-input-home');
const btnBack = document.getElementById('btn-back');
const btnExport = document.getElementById('btn-export');
const btnLayers = document.getElementById('btn-layers');
const layersDropdown = document.getElementById('layers-dropdown');
const btnAddLayer = document.getElementById('btn-add-layer');
const layersList = document.getElementById('layers-list');
const layerOptionsModal = document.getElementById('layer-options-modal');
const btnLayerDuplicate = document.getElementById('btn-layer-duplicate');
const btnLayerDelete = document.getElementById('btn-layer-delete');
const btnLayerCancel = document.getElementById('btn-layer-cancel');
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
        setupHistory();
    }
}

let wheelState = {
    u_lift: { h: 0, s: 0, lum: 0 },
    u_gamma: { h: 0, s: 0, lum: 0 },
    u_gain: { h: 0, s: 0, lum: 0 }
};

let mixState = [
    {h: 0, s: 0, l: 0}, // 0 Red
    {h: 0, s: 0, l: 0}, // 1 Orange
    {h: 0, s: 0, l: 0}, // 2 Yellow
    {h: 0, s: 0, l: 0}, // 3 Green
    {h: 0, s: 0, l: 0}, // 4 Cyan
    {h: 0, s: 0, l: 0}, // 5 Blue
    {h: 0, s: 0, l: 0}, // 6 Purple
    {h: 0, s: 0, l: 0}  // 7 Magenta
];

let layers = [];
let activeLayerIndex = 0;

function createDefaultLayerState(name = "Livello", blendMode = "normal", isBase = false) {
    return {
        id: 'layer_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        name: name,
        blendMode: blendMode,
        opacity: 1.0,
        visible: true,
        isBase: isBase,
        state: {
            sliders: {}, // Will be populated dynamically on save or from UI
            wheelState: {
                u_lift: { h: 0, s: 0, lum: 0 },
                u_gamma: { h: 0, s: 0, lum: 0 },
                u_gain: { h: 0, s: 0, lum: 0 }
            },
            mixState: [
                {h: 0, s: 0, l: 0}, {h: 0, s: 0, l: 0}, {h: 0, s: 0, l: 0}, {h: 0, s: 0, l: 0},
                {h: 0, s: 0, l: 0}, {h: 0, s: 0, l: 0}, {h: 0, s: 0, l: 0}, {h: 0, s: 0, l: 0}
            ],
            activeLut: 'none'
        }
    };
}
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
    triggerEngineRender();
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
        window.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; pushHistoryState(); } });
        window.addEventListener('touchend', () => { if (isDragging) { isDragging = false; pushHistoryState(); } });
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
                    triggerEngineRender();
                }
            });
            input.addEventListener('change', () => pushHistoryState());
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
        'Effects': document.getElementById('panel-effects'),
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

// --- IndexedDB Project Manager ---
const DB_NAME = 'LocalLightDB';
const DB_VERSION = 1;
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('projects')) {
                database.createObjectStore('projects', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            setupActionSheet();
            loadRecentProjectsUI();
            resolve(db);
        };
        request.onerror = (e) => reject(e);
    });
}
window.addEventListener('load', () => initDB());

let selectedProjectForAction = null;

function setupActionSheet() {
    const overlay = document.getElementById('action-sheet-overlay');
    const btnDuplicate = document.getElementById('btn-project-duplicate');
    const btnDelete = document.getElementById('btn-project-delete');
    const btnCancel = document.getElementById('btn-project-cancel');
    
    const closeSheet = () => {
        if (overlay) overlay.classList.remove('active');
        selectedProjectForAction = null;
    };
    
    if (btnCancel) btnCancel.addEventListener('click', closeSheet);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeSheet();
        });
    }
    
    if (btnDuplicate) {
        btnDuplicate.addEventListener('click', () => {
            if (selectedProjectForAction) {
                duplicateProject(selectedProjectForAction);
                closeSheet();
            }
        });
    }
    
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (selectedProjectForAction) {
                deleteProject(selectedProjectForAction.id);
                closeSheet();
            }
        });
    }
    const btnClearStorage = document.getElementById('btn-clear-storage');
    if (btnClearStorage) {
        btnClearStorage.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to completely wipe all stored project photos, presets, and cache?')) {
                return;
            }
            try {
                if (db) {
                    db.close();
                    db = null;
                }
                await new Promise((resolve) => {
                    const req = indexedDB.deleteDatabase('LocalLightDB');
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                });
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                localStorage.clear();
                sessionStorage.clear();
                await initDB();
                loadRecentProjectsUI();
            } catch (err) {
                console.error('Error performing full storage clear:', err);
            }
        });
    }
}

function openActionSheet(proj) {
    selectedProjectForAction = proj;
    const overlay = document.getElementById('action-sheet-overlay');
    const titleSpan = document.getElementById('action-sheet-title');
    if (titleSpan) titleSpan.textContent = proj.name || 'Project Options';
    if (overlay) overlay.classList.add('active');
    if (navigator.vibrate) navigator.vibrate(40);
}

function duplicateProject(proj) {
    if (!db) return;
    const newId = proj.id + '_copy_' + Date.now();
    const duplicatedRecord = {
        ...JSON.parse(JSON.stringify(proj)),
        id: newId,
        name: proj.name ? (proj.name.replace(/\.[^/.]+$/, '') + ' Copy.jpg') : 'Copy.jpg',
        updatedAt: Date.now()
    };
    
    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    store.put(duplicatedRecord);
    tx.oncomplete = () => loadRecentProjectsUI();
}

function deleteProject(id) {
    if (!db) return;
    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    store.delete(id);
    tx.oncomplete = () => loadRecentProjectsUI();
}

function generateThumbnail(img, maxSize = 480) {
    const canvasThumb = document.createElement('canvas');
    let w = img.width;
    let h = img.height;
    if (w > h) {
        if (w > maxSize) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
        }
    } else {
        if (h > maxSize) {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
        }
    }
    canvasThumb.width = Math.max(1, w);
    canvasThumb.height = Math.max(1, h);
    const ctx = canvasThumb.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvasThumb.toDataURL('image/jpeg', 0.8);
}

function updateStorageStatsUI() {
    if (!db) return;
    const tx = db.transaction('projects', 'readonly');
    const store = tx.objectStore('projects');
    const request = store.getAll();
    
    request.onsuccess = async () => {
        const projects = request.result || [];
        let totalBytes = 0;
        
        projects.forEach(proj => {
            if (proj.originalBlob && proj.originalBlob.size) {
                totalBytes += proj.originalBlob.size;
            }
            if (proj.thumbnail) {
                totalBytes += proj.thumbnail.length;
            }
        });
        
        const mb = (totalBytes / (1024 * 1024)).toFixed(1);
        const storageText = document.getElementById('storage-text');
        
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                const totalUsedMB = (estimate.usage / (1024 * 1024)).toFixed(1);
                if (storageText) {
                    storageText.textContent = `Storage: ${mb} MB (${projects.length} project${projects.length === 1 ? '' : 's'}) • Cache: ${totalUsedMB} MB`;
                }
            } catch (e) {
                if (storageText) storageText.textContent = `Storage: ${mb} MB (${projects.length} project${projects.length === 1 ? '' : 's'})`;
            }
        } else {
            if (storageText) storageText.textContent = `Storage: ${mb} MB (${projects.length} project${projects.length === 1 ? '' : 's'})`;
        }
    };
}

function saveCurrentProject() {
    if (!db || !currentImage) return;
    
    try {
        const fileMeta = currentImage._fileMeta || {
            name: 'Untitled.jpg',
            size: 0,
            lastModified: Date.now()
        };
        
        const projectId = `${fileMeta.name}_${fileMeta.size}_${fileMeta.lastModified}`;
        const thumbUrl = generateThumbnail(currentImage, 480);
        const stateSnapshot = captureCurrentState();
        const ar = (currentImage.height && currentImage.width) ? (currentImage.height / currentImage.width) : 1.2;
        
        const projectRecord = {
            id: projectId,
            name: fileMeta.name,
            size: fileMeta.size,
            lastModified: fileMeta.lastModified,
            updatedAt: Date.now(),
            thumbnail: thumbUrl,
            aspectRatio: ar,
            originalBlob: currentImage._originalBlob || null,
            state: stateSnapshot
        };
        
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        store.put(projectRecord);
        tx.oncomplete = () => loadRecentProjectsUI();
    } catch (err) {
        console.error('Error saving project to IndexedDB:', err);
    }
}

function loadRecentProjectsUI() {
    if (!db) return;
    const tx = db.transaction('projects', 'readonly');
    const store = tx.objectStore('projects');
    const request = store.getAll();
    
    request.onsuccess = () => {
        const projects = request.result || [];
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        
        const container = document.getElementById('recent-projects-list');
        if (!container) return;
        
        updateStorageStatsUI();
        
        if (projects.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent projects</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="masonry-col" id="masonry-col-1"></div>
            <div class="masonry-col" id="masonry-col-2"></div>
        `;
        
        const col1 = document.getElementById('masonry-col-1');
        const col2 = document.getElementById('masonry-col-2');
        
        // Pinterest Shortest-Column Dynamic Algorithm
        let colHeights = [0, 0];
        
        projects.forEach((proj) => {
            let ext = 'JPEG';
            if (proj.name) {
                const match = proj.name.match(/\.([a-zA-Z0-9]+)$/);
                if (match) ext = match[1].toUpperCase();
            }
            
            const ar = proj.aspectRatio || 1.2;
            const targetColIndex = (colHeights[0] <= colHeights[1]) ? 0 : 1;
            const targetCol = (targetColIndex === 0) ? col1 : col2;
            
            const cardHtml = `
                <div class="project-card" data-project-id="${proj.id}">
                    <img src="${proj.thumbnail}" class="project-thumb" alt="${proj.name}">
                    <span class="project-badge">${ext}</span>
                    <button class="project-options-btn" data-project-id="${proj.id}" title="Options">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
                    </button>
                </div>
            `;
            
            targetCol.insertAdjacentHTML('beforeend', cardHtml);
            colHeights[targetColIndex] += ar;
        });
        
        container.querySelectorAll('.project-card').forEach(card => {
            const id = card.dataset.projectId;
            const proj = projects.find(p => p.id === id);
            if (!proj) return;
            
            let pressTimer = null;
            let isLongPress = false;
            
            const startPress = () => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    openActionSheet(proj);
                }, 500);
            };
            
            const cancelPress = () => {
                if (pressTimer) clearTimeout(pressTimer);
            };
            
            card.addEventListener('touchstart', startPress, { passive: true });
            card.addEventListener('touchend', (e) => {
                cancelPress();
            });
            card.addEventListener('touchmove', cancelPress, { passive: true });
            card.addEventListener('mousedown', startPress);
            card.addEventListener('mouseup', cancelPress);
            card.addEventListener('mouseleave', cancelPress);
            
            card.addEventListener('click', (e) => {
                if (isLongPress) return;
                if (e.target.closest('.project-options-btn')) {
                    e.stopPropagation();
                    openActionSheet(proj);
                    return;
                }
                openProject(proj);
            });
        });
    };
}

function openProject(projectRecord) {
    if (projectRecord.originalBlob) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const fullImg = new Image();
            fullImg.onload = () => {
                fullImg._fileMeta = {
                    name: projectRecord.name,
                    size: projectRecord.size,
                    lastModified: projectRecord.lastModified
                };
                fullImg._originalBlob = projectRecord.originalBlob;
                currentImage = fullImg;
                initEngine();
                engine.loadImage(fullImg);
                applyHistoryState(projectRecord.state);
                historyStack = [projectRecord.state];
                historyIndex = 0;
                updateHistoryButtonsState();
                showScreen(editorWorkspace);
            };
            fullImg.src = event.target.result;
        };
        reader.readAsDataURL(projectRecord.originalBlob);
    } else {
        const img = new Image();
        img.onload = () => {
            img._fileMeta = {
                name: projectRecord.name,
                size: projectRecord.size,
                lastModified: projectRecord.lastModified
            };
            currentImage = img;
            initEngine();
            engine.loadImage(img);
            applyHistoryState(projectRecord.state);
            historyStack = [projectRecord.state];
            historyIndex = 0;
            updateHistoryButtonsState();
            showScreen(editorWorkspace);
        };
        img.src = projectRecord.thumbnail;
    }
}

// Event Listeners
btnBack.addEventListener('click', () => {
    saveCurrentProject();
    showScreen(homeScreen);
    currentImage = null;
    fileInputHome.value = '';
});
// Layers Logic
btnLayers.addEventListener('click', (e) => {
    e.stopPropagation();
    layersDropdown.classList.toggle('active');
    if (layersDropdown.classList.contains('active')) {
        renderLayersList();
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (layersDropdown && layersDropdown.classList.contains('active') && !layersDropdown.contains(e.target) && e.target !== btnLayers && !btnLayers.contains(e.target)) {
        layersDropdown.classList.remove('active');
    }
});

btnAddLayer.addEventListener('click', () => {
    captureCurrentState(); // Sync current UI first
    const newLayer = createDefaultLayerState(`Livello ${layers.length}`);
    layers.push(newLayer);
    activeLayerIndex = layers.length - 1;
    applyHistoryState({ layers, activeLayerIndex }); // Sync UI to new layer
    
    // Force reset isRestoringHistory so we can push this structural change immediately
    isRestoringHistory = false;
    pushHistoryState();
});

let layerActionTargetId = null;

let draggedLayerIndex = null;

function renderLayersList() {
    if (!layersList) return;
    layersList.innerHTML = '';
    
    // Render in reverse so top layer is visually at the top
    const displayLayers = [...layers].reverse();
    
    displayLayers.forEach((layer) => {
        const trueIndex = layers.indexOf(layer);
        
        const item = document.createElement('div');
        item.className = 'layer-item';
        if (trueIndex === activeLayerIndex) item.classList.add('active');
        item.dataset.index = trueIndex;
        

        // Header (Eye, Name, Options)
        const header = document.createElement('div');
        header.className = 'layer-header';
        
        const btnEye = document.createElement('button');
        btnEye.className = `layer-visibility ${layer.visible ? '' : 'hidden'}`;
        btnEye.innerHTML = layer.visible ? 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` : 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        btnEye.onclick = (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            btnEye.classList.toggle('hidden', !layer.visible);
            btnEye.innerHTML = layer.visible ? 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` : 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
            if (engine) triggerEngineRender();
            pushHistoryState();
        };
        
        const nameEl = document.createElement('h4');
        nameEl.className = 'layer-name';
        nameEl.textContent = layer.name;
        nameEl.onclick = () => switchLayer(trueIndex);
        
        const btnMore = document.createElement('button');
        btnMore.className = 'layer-options';
        btnMore.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
        
        if (layer.isBase) {
            btnMore.style.opacity = '0.2';
            btnMore.style.pointerEvents = 'none';
        } else {
            btnMore.onclick = (e) => {
                e.stopPropagation();
                layerActionTargetId = layer.id;
                layerOptionsModal.classList.add('active');
            };
        }
        
        header.appendChild(btnEye);
        header.appendChild(nameEl);
        
        // Move Up / Move Down buttons
        if (!layer.isBase) {
            const reorderDiv = document.createElement('div');
            reorderDiv.style.display = 'flex';
            reorderDiv.style.flexDirection = 'column';
            reorderDiv.style.marginLeft = '8px';
            reorderDiv.style.marginRight = '8px';
            reorderDiv.style.justifyContent = 'center';
            
            const btnUp = document.createElement('button');
            btnUp.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
            btnUp.className = 'island-btn';
            btnUp.style.width = '24px'; btnUp.style.height = '16px';
            btnUp.style.opacity = (trueIndex === layers.length - 1) ? '0.2' : '1';
            btnUp.style.pointerEvents = (trueIndex === layers.length - 1) ? 'none' : 'auto';
            btnUp.onclick = (e) => {
                e.stopPropagation();
                if (trueIndex < layers.length - 1) {
                    const temp = layers[trueIndex];
                    layers[trueIndex] = layers[trueIndex + 1];
                    layers[trueIndex + 1] = temp;
                    if (activeLayerIndex === trueIndex) activeLayerIndex = trueIndex + 1;
                    else if (activeLayerIndex === trueIndex + 1) activeLayerIndex = trueIndex;
                    applyHistoryState({ layers, activeLayerIndex });
                    pushHistoryState();
                    if (engine) triggerEngineRender();
                }
            };

            const btnDown = document.createElement('button');
            btnDown.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            btnDown.className = 'island-btn';
            btnDown.style.width = '24px'; btnDown.style.height = '16px';
            btnDown.style.opacity = (trueIndex === 1) ? '0.2' : '1';
            btnDown.style.pointerEvents = (trueIndex === 1) ? 'none' : 'auto';
            btnDown.onclick = (e) => {
                e.stopPropagation();
                if (trueIndex > 1) {
                    const temp = layers[trueIndex];
                    layers[trueIndex] = layers[trueIndex - 1];
                    layers[trueIndex - 1] = temp;
                    if (activeLayerIndex === trueIndex) activeLayerIndex = trueIndex - 1;
                    else if (activeLayerIndex === trueIndex - 1) activeLayerIndex = trueIndex;
                    applyHistoryState({ layers, activeLayerIndex });
                    pushHistoryState();
                    if (engine) triggerEngineRender();
                }
            };

            reorderDiv.appendChild(btnUp);
            reorderDiv.appendChild(btnDown);
            header.appendChild(reorderDiv);
        }
        
        header.appendChild(btnMore);
        item.appendChild(header);
        
        // Controls (Blend mode, Opacity)
        if (!layer.isBase) {
            const controls = document.createElement('div');
            controls.className = 'layer-controls';
            
            const blendSelect = document.createElement('select');
            blendSelect.className = 'layer-blend-mode';
            const modes = [
                {val: 'normal', text: 'Normale'},
                {val: 'multiply', text: 'Moltiplica'},
                {val: 'screen', text: 'Schermo'},
                {val: 'overlay', text: 'Sovrapponi'}
            ];
            modes.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.val;
                opt.textContent = m.text;
                if (layer.blendMode === m.val) opt.selected = true;
                blendSelect.appendChild(opt);
            });
            blendSelect.onchange = (e) => {
                layer.blendMode = e.target.value;
                if (engine) triggerEngineRender();
                pushHistoryState();
            };
            
            const opacityWrapper = document.createElement('div');
            opacityWrapper.className = 'layer-opacity-wrapper';
            
            const opacitySlider = document.createElement('input');
            opacitySlider.type = 'range';
            opacitySlider.className = 'layer-opacity-slider';
            opacitySlider.min = '0';
            opacitySlider.max = '100';
            opacitySlider.value = (layer.opacity * 100).toFixed(0);
            
            const opacityVal = document.createElement('span');
            opacityVal.className = 'layer-opacity-val';
            opacityVal.textContent = opacitySlider.value + '%';
            
            opacitySlider.oninput = (e) => {
                opacityVal.textContent = e.target.value + '%';
                layer.opacity = parseFloat(e.target.value) / 100.0;
                if (engine) triggerEngineRender();
            };
            opacitySlider.onchange = () => {
                pushHistoryState();
            };
            
            opacityWrapper.appendChild(opacitySlider);
            opacityWrapper.appendChild(opacityVal);
            
            controls.appendChild(blendSelect);
            controls.appendChild(opacityWrapper);
            
            item.appendChild(controls);
        }
        
        layersList.appendChild(item);
    });
}

function switchLayer(index) {
    if (index === activeLayerIndex) return;
    captureCurrentState(); // save current sliders to active layer
    activeLayerIndex = index;
    // Update UI with new active layer state
    applyHistoryState({ layers, activeLayerIndex });
    renderLayersList(); // updates visual active state
}

btnLayerCancel.addEventListener('click', () => {
    layerOptionsModal.classList.remove('active');
    layerActionTargetId = null;
});

btnLayerDelete.addEventListener('click', () => {
    if (layerActionTargetId) {
        const idx = layers.findIndex(l => l.id === layerActionTargetId);
        if (idx > 0) { // cant delete base
            layers.splice(idx, 1);
            if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;
            applyHistoryState({ layers, activeLayerIndex }); // reset UI if active layer was deleted
            pushHistoryState();
            if (engine) triggerEngineRender();
        }
    }
    layerOptionsModal.classList.remove('active');
    layerActionTargetId = null;
});

btnLayerDuplicate.addEventListener('click', () => {
    if (layerActionTargetId) {
        const srcLayer = layers.find(l => l.id === layerActionTargetId);
        if (srcLayer) {
            const newLayer = JSON.parse(JSON.stringify(srcLayer));
            newLayer.id = 'layer_' + Date.now() + '_' + Math.floor(Math.random()*1000);
            newLayer.name = newLayer.name + " copia";
            newLayer.isBase = false; // Just in case we duplicated base (though UI disables it)
            layers.push(newLayer);
            activeLayerIndex = layers.length - 1;
            applyHistoryState({ layers, activeLayerIndex });
            pushHistoryState();
            if (engine) triggerEngineRender();
        }
    }
    layerOptionsModal.classList.remove('active');
    layerActionTargetId = null;
});

// Global Overall Compare (Top Button: Hold to view RAW Original photo)
const btnCompare = document.getElementById('btn-compare');
const startGlobalCompare = () => { if (engine) { engine.setBypass(true); triggerEngineRender(); } };
const stopGlobalCompare = () => { if (engine) { engine.setBypass(false); triggerEngineRender(); } };

btnCompare.addEventListener('mousedown', startGlobalCompare);
btnCompare.addEventListener('touchstart', startGlobalCompare, { passive: true });

window.addEventListener('mouseup', stopGlobalCompare);
window.addEventListener('touchend', stopGlobalCompare, { passive: true });
window.addEventListener('touchcancel', stopGlobalCompare, { passive: true });

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
                img._fileMeta = {
                    name: file.name,
                    size: file.size,
                    lastModified: file.lastModified
                };
                img._originalBlob = file;
                currentImage = img;
                initEngine();
                engine.loadImage(img);
                
                const projectId = `${file.name}_${file.size}_${file.lastModified}`;
                
                // Check if existing project exists in IndexedDB
                if (db) {
                    const tx = db.transaction('projects', 'readonly');
                    const store = tx.objectStore('projects');
                    const request = store.get(projectId);
                    request.onsuccess = () => {
                        const existingProject = request.result;
                        if (existingProject && confirm(`Found previous saved edits for "${file.name}".\n\nWould you like to restore your previous project edits?`)) {
                            applyHistoryState(existingProject.state);
                            historyStack = [existingProject.state];
                            historyIndex = 0;
                            updateHistoryButtonsState();
                        } else {
                            engine.resetState();
                            resetSliders();
                            historyStack = [];
                            historyIndex = -1;
                            pushHistoryState();
                        }
                        showScreen(editorWorkspace);
                    };
                    request.onerror = () => {
                        engine.resetState();
                        resetSliders();
                        historyStack = [];
                        historyIndex = -1;
                        pushHistoryState();
                        showScreen(editorWorkspace);
                    };
                } else {
                    engine.resetState();
                    resetSliders();
                    historyStack = [];
                    historyIndex = -1;
                    pushHistoryState();
                    showScreen(editorWorkspace);
                }
            } catch (err) {
                alert("Error loading image: " + err.message + "\n\nStack: " + err.stack);
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

const lutBtns = document.querySelectorAll('.lut-btn');
lutBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        lutBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const lutFile = e.target.dataset.lut;
        if (!engine) return;
        
        if (lutFile === 'none') {
            const intensitySlider = document.querySelector('[data-uniform="u_lut_intensity"]');
            if (intensitySlider) {
                intensitySlider.value = 0;
                intensitySlider.dispatchEvent(new Event('input'));
            }
            return;
        }
        
        try {
            const res = await fetch(`./${lutFile}`);
            const text = await res.text();
            const lutData = parseCubeLUT(text);
            engine.loadLUT(lutData);
            
            const intensitySlider = document.querySelector('[data-uniform="u_lut_intensity"]');
            if (intensitySlider) {
                intensitySlider.value = 100;
                intensitySlider.dispatchEvent(new Event('input'));
            }
        } catch(err) {
            console.error('Error loading default LUT:', err);
        }
    });
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
                
                lutBtns.forEach(b => b.classList.remove('active'));
                
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

// Export Settings Modal Manager
let exportSettings = {
    format: 'image/jpeg',
    quality: 0.95,
    scale: 1.0
};

function setupExportModal() {
    const modal = document.getElementById('export-modal');
    const btnClose = document.getElementById('btn-close-export');
    const formatControl = document.getElementById('export-format-control');
    const resControl = document.getElementById('export-res-control');
    const qualitySlider = document.getElementById('export-quality-slider');
    const qualityVal = document.getElementById('export-quality-val');
    const btnDoExport = document.getElementById('btn-do-export');
    const btnShareExport = document.getElementById('btn-share-export');
    const groupQuality = document.getElementById('group-export-quality');
    
    const closeModal = () => {
        if (modal) modal.classList.remove('active');
    };
    
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    if (formatControl) {
        formatControl.querySelectorAll('.segment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                formatControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                exportSettings.format = btn.dataset.format;
                if (groupQuality) {
                    groupQuality.style.display = (exportSettings.format === 'image/png') ? 'none' : 'flex';
                }
                updateExportSizeEstimate();
            });
        });
    }
    
    if (qualitySlider) {
        qualitySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            exportSettings.quality = val / 100;
            if (qualityVal) qualityVal.textContent = `${val}%`;
            updateExportSizeEstimate();
        });
    }
    
    if (resControl) {
        resControl.querySelectorAll('.segment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                resControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                exportSettings.scale = parseFloat(btn.dataset.scale);
                updateExportSizeEstimate();
            });
        });
    }
    
    if (btnDoExport) {
        btnDoExport.addEventListener('click', () => executeExport(false));
    }
    
    if (btnShareExport) {
        btnShareExport.addEventListener('click', () => executeExport(true));
    }
}
window.addEventListener('load', () => setupExportModal());

function openExportModal() {
    if (!currentImage || !engine) return;
    triggerEngineRender();
    const modal = document.getElementById('export-modal');
    if (modal) modal.classList.add('active');
    updateExportSizeEstimate();
}

async function getExportBlob() {
    if (!canvas) return null;
    
    let targetWidth = canvas.width * exportSettings.scale;
    let targetHeight = canvas.height * exportSettings.scale;
    
    let exportCanvas = canvas;
    if (exportSettings.scale < 1.0) {
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        const ctx = exportCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    }
    
    return new Promise((resolve) => {
        exportCanvas.toBlob((blob) => {
            resolve(blob);
        }, exportSettings.format, exportSettings.quality);
    });
}

async function updateExportSizeEstimate() {
    const sizeText = document.getElementById('export-size-text');
    const previewImg = document.getElementById('export-preview-img');
    if (!sizeText) return;
    sizeText.textContent = 'Calculating...';
    
    const blob = await getExportBlob();
    if (blob) {
        const mb = (blob.size / (1024 * 1024)).toFixed(2);
        sizeText.textContent = `~ ${mb} MB`;
        
        if (previewImg) {
            previewImg.src = URL.createObjectURL(blob);
        }
    }
}

async function executeExport() {
    const blob = await getExportBlob();
    if (!blob) return;
    
    let ext = 'jpg';
    if (exportSettings.format === 'image/png') ext = 'png';
    if (exportSettings.format === 'image/webp') ext = 'webp';
    
    const filename = `LocalLight_${Date.now()}.${ext}`;
    const file = new File([blob], filename, { type: exportSettings.format });
    
    const modal = document.getElementById('export-modal');
    if (modal) modal.classList.remove('active');
    
    const isMobileOrIOS = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                          (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/i.test(navigator.userAgent));
    
    // 1. Mobile / iOS -> Use Native Mobile System Share Sheet ("Salva in Foto" / Instagram / AirDrop)
    if (isMobileOrIOS && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: filename
            });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }
    
    // 2. Mac / PC / Desktop -> Direct 1-Click Save directly to Downloads folder!
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = blobUrl;
    link.click();
    
    // Cleanup to avoid memory leaks
    setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
    }, 100);
}

btnExport.addEventListener('click', () => {
    if (!isMobileOrIOS && window.showSaveFilePicker) {
        // Direct save on Mac/Browser via File System Access API
        if (!engine) return;
        canvas.toBlob(async (blob) => {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'localight_edited.jpg',
                    types: [{
                        description: 'JPEG Image',
                        accept: {'image/jpeg': ['.jpg', '.jpeg']}
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch (err) {
                if (err.name !== 'AbortError') doExport('jpeg');
            }
        }, 'image/jpeg', 0.95);
    } else if (!isMobileOrIOS) {
        // Fallback direct save for older browsers
        doExport('jpeg');
    } else {
        openExportModal();
    }
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
    triggerEngineRender();
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
        slider.addEventListener('change', () => pushHistoryState());
    });
    
    updateMixSlidersUI();
}

// History System (Undo, Redo, Global Reset)
let historyStack = [];
let historyIndex = -1;
let isRestoringHistory = false;

function captureCurrentState() {
    if (layers.length > 0 && layers[activeLayerIndex]) {
        const slidersData = {};
        document.querySelectorAll('.custom-slider').forEach(slider => {
            const uniform = slider.getAttribute('data-uniform');
            if (uniform) {
                slidersData[uniform] = parseFloat(slider.value);
            }
        });
        
        layers[activeLayerIndex].state.sliders = slidersData;
        layers[activeLayerIndex].state.wheelState = JSON.parse(JSON.stringify(wheelState));
        layers[activeLayerIndex].state.mixState = JSON.parse(JSON.stringify(mixState));
        layers[activeLayerIndex].state.activeLut = document.querySelector('.lut-btn.active')?.dataset.lut || 'none';
    }

    return {
        pipelineVersion: 2,
        layers: JSON.parse(JSON.stringify(layers)),
        activeLayerIndex: activeLayerIndex
    };
}

function pushHistoryState() {
    if (isRestoringHistory) return;
    const currentState = captureCurrentState();
    
    if (historyIndex >= 0) {
        const lastState = historyStack[historyIndex];
        if (JSON.stringify(lastState) === JSON.stringify(currentState)) return;
    }
    
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(currentState);
    if (historyStack.length > 50) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateHistoryButtonsState();
    saveCurrentProject();
}

function computeEngineStateForLayer(layerState) {
    const s = {};
    
    // Sliders
    // Semantic mapping for sliders
    s['u_exposure'] = (layerState.sliders['u_exposure'] || 0) / 20.0; // UI [-100, 100] -> [-5 EV, +5 EV]
    
    // Other sliders mapped to semantic ranges [-1.0, 1.0]
    ['u_contrast', 'u_highlights', 'u_shadows', 'u_whites', 'u_blacks', 'u_temperature', 'u_tint', 'u_saturation', 'u_vibrance'].forEach(name => {
        s[name] = (layerState.sliders[name] || 0) / 100.0;
    });
    
    s['u_sharpness'] = (layerState.sliders['u_sharpness'] || 0) / 100.0;
    s['u_clarity'] = (layerState.sliders['u_clarity'] || 0) / 100.0;
    s['u_lut_intensity'] = (layerState.sliders['u_lut_intensity'] !== undefined ? layerState.sliders['u_lut_intensity'] : 100) / 100.0;
    
    // Effects
    s['u_grain'] = (layerState.sliders['u_grain'] || 0) / 100.0;
    s['u_noise'] = (layerState.sliders['u_noise'] || 0) / 100.0;
    s['u_halation'] = (layerState.sliders['u_halation'] || 0) / 100.0;
    s['u_glow'] = (layerState.sliders['u_glow'] || 0) / 100.0;

    // Wheels
    const w = layerState.wheelState;
    if (w) {
        ['u_lift', 'u_gamma', 'u_gain'].forEach(name => {
            if (w[name]) {
                const rgb = hsvToRgb(w[name].h, w[name].s * 0.35, 1.0);
                if (name === 'u_lift') {
                    let lum = w[name].lum * 0.2;
                    s[name] = [(rgb[0]-1)*0.2+lum, (rgb[1]-1)*0.2+lum, (rgb[2]-1)*0.2+lum];
                } else if (name === 'u_gamma') {
                    let lumMult = Math.pow(2.0, w[name].lum * 1.5);
                    s[name] = [rgb[0]*lumMult, rgb[1]*lumMult, rgb[2]*lumMult];
                } else {
                    let lumMult = Math.pow(2.0, w[name].lum * 2.0);
                    s[name] = [rgb[0]*lumMult, rgb[1]*lumMult, rgb[2]*lumMult];
                }
            } else {
                s[name] = name === 'u_lift' ? [0,0,0] : [1,1,1];
            }
        });
    } else {
        s['u_lift'] = [0,0,0]; s['u_gamma'] = [1,1,1]; s['u_gain'] = [1,1,1];
    }
    
    // Mix
    const m = layerState.mixState;
    if (m) {
        const flat = new Float32Array(24);
        for(let i=0; i<8; i++){
            if(m[i]) {
                flat[i*3] = m[i].h;
                flat[i*3+1] = m[i].s;
                flat[i*3+2] = m[i].l;
            }
        }
        s['u_hsl_shifts'] = flat;
    } else {
        s['u_hsl_shifts'] = new Float32Array(24);
    }
    
    s['activeLut'] = layerState.activeLut || 'none';
    
    return s;
}

let renderPending = false;
function triggerEngineRender() {
    if (!engine || renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
        renderPending = false;
        
        // In case no layers, use default dummy
        if (layers.length === 0) {
            layers.push(createDefaultLayerState("Base", "normal", true));
        }
        
        // Synchronize the current active UI into the active layer before computing
        if (layers[activeLayerIndex]) {
            captureCurrentState();
        }
        
        layers.forEach((layer, i) => {
            layer.active = (i === activeLayerIndex);
            layer.engineState = computeEngineStateForLayer(layer.state);
        });
        
        console.log('[RENDER] Layers being sent to engine:');
        layers.forEach((l, i) => {
            const es = l.engineState;
            console.log(`  Layer ${i} "${l.name}" visible=${l.visible} exposure=${es?.u_exposure} brightness=${es?.u_brightness} sliders_exposure=${l.state?.sliders?.u_exposure}`);
        });
        
        engine.render(layers);
    });
}

function applyHistoryState(state) {
    if (!state || !engine) return;
    isRestoringHistory = true;

    if (!state.layers) {
        layers = [createDefaultLayerState("Base", "normal", true)];
        activeLayerIndex = 0;
        layers[0].state = {
            sliders: state.sliders || {},
            wheelState: state.wheelState || JSON.parse(JSON.stringify(wheelState)),
            mixState: state.mixState || JSON.parse(JSON.stringify(mixState)),
            activeLut: state.activeLut || 'none'
        };
        engine.pipelineVersion = 1; // M13: Ensure legacy projects restore to V1
    } else {
        layers = JSON.parse(JSON.stringify(state.layers));
        activeLayerIndex = state.activeLayerIndex;
        engine.pipelineVersion = state.pipelineVersion || 1;
    }
    
    if (typeof renderLayersList === 'function') renderLayersList();

    const activeState = layers[activeLayerIndex].state;
    
    // 1. Restore Sliders
    document.querySelectorAll('.custom-slider').forEach(slider => {
        const uniform = slider.getAttribute('data-uniform');
        if (uniform) {
            const val = activeState.sliders[uniform] || 0;
            slider.value = val;
            const displaySpan = slider.parentElement?.querySelector('.val-display');
            if (displaySpan) {
                const prefix = val > 0 ? '+' : '';
                displaySpan.textContent = val === 0 ? '0%' : `${prefix}${val}%`;
            }
        }
    });
    
    // 2. Restore Wheels
    if (activeState.wheelState) {
        Object.keys(activeState.wheelState).forEach(name => {
            wheelState[name] = JSON.parse(JSON.stringify(activeState.wheelState[name]));
            const wheelContainer = document.querySelector(`[data-uniform="${name}"]`);
            if (wheelContainer) {
                const thumb = wheelContainer.querySelector('.color-wheel-thumb');
                if (thumb) {
                    const maxDist = wheelContainer.getBoundingClientRect().width / 2 || 70;
                    const h = wheelState[name].h;
                    const s = wheelState[name].s;
                    const angle = (h * Math.PI * 2) - (Math.PI / 2);
                    const dist = s * maxDist;
                    const dx = Math.cos(angle) * dist;
                    const dy = Math.sin(angle) * dist;
                    thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                }
            }
        });
    }
    
    // 3. Restore Mix
    if (activeState.mixState) {
        for (let i = 0; i < 8; i++) {
            mixState[i] = JSON.parse(JSON.stringify(activeState.mixState[i]));
        }
        updateMixSlidersUI();
    }
    
    // 4. Restore LUT
    if (activeState.activeLut) {
        const lutBtn = document.querySelector(`.lut-btn[data-lut="${activeState.activeLut}"]`);
        if (lutBtn && !lutBtn.classList.contains('active')) {
            document.querySelectorAll('.lut-btn').forEach(btn => btn.classList.remove('active'));
            lutBtn.classList.add('active');
        }
    } else {
        document.querySelectorAll('.lut-btn').forEach(btn => btn.classList.remove('active'));
        const noneLutBtn = document.querySelector('.lut-btn[data-lut="none"]');
        if(noneLutBtn) noneLutBtn.classList.add('active');
    }
    
    triggerEngineRender();
    isRestoringHistory = false;
    updateHistoryButtonsState();
}

function updateHistoryButtonsState() {
    const undoBtn = document.getElementById('btn-undo-action');
    const redoBtn = document.getElementById('btn-redo-action');
    if (undoBtn) undoBtn.style.opacity = (historyIndex > 0) ? '1' : '0.4';
    if (redoBtn) redoBtn.style.opacity = (historyIndex < historyStack.length - 1) ? '1' : '0.4';
}

function globalReset() {
    if (!engine) return;
    
    resetSliders();
    engine.resetState();
    
    for (let i = 0; i < 8; i++) {
        mixState[i] = { h: 0, s: 0, l: 0 };
    }
    updateMixSlidersUI();
    updateMixUniforms();
    
    const noneLutBtn = document.querySelector('.lut-btn[data-lut="none"]');
    if (noneLutBtn) noneLutBtn.click();
    
    pushHistoryState();
    triggerEngineRender();
}

function setupHistory() {
    const historyWidget = document.getElementById('history-widget');
    const toggleBtn = document.getElementById('btn-history-toggle');
    const undoBtn = document.getElementById('btn-undo-action');
    const redoBtn = document.getElementById('btn-redo-action');
    const resetBtn = document.getElementById('btn-reset-action');
    
    if (toggleBtn && historyWidget) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            historyWidget.classList.toggle('expanded');
        });
        
        document.addEventListener('click', (e) => {
            if (!historyWidget.contains(e.target)) {
                historyWidget.classList.remove('expanded');
            }
        });
    }
    
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (historyIndex > 0) {
                historyIndex--;
                applyHistoryState(historyStack[historyIndex]);
            }
        });
    }
    
    if (redoBtn) {
        redoBtn.addEventListener('click', () => {
            if (historyIndex < historyStack.length - 1) {
                historyIndex++;
                applyHistoryState(historyStack[historyIndex]);
            }
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            globalReset();
        });
    }
}

// Native Touch Pinch-to-Zoom, Mouse Wheel / Trackpad Zoom, Pan & Double Click Reset
let zoomState = {
    scale: 1.0,
    minScale: 0.2, // Dezoom down to 20%
    maxScale: 5.0, // Zoom up to 500%
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
};

function setupGestureZoom() {
    const mainCanvas = document.getElementById('main-canvas');
    const container = document.getElementById('canvas-container');
    if (!mainCanvas || !container) return;
    
    function applyTransform() {
        zoomState.scale = Math.min(Math.max(zoomState.scale, zoomState.minScale), zoomState.maxScale);
        mainCanvas.style.transform = `translate(${zoomState.panX}px, ${zoomState.panY}px) scale(${zoomState.scale})`;
    }
    
    function resetZoomAndPan() {
        zoomState.scale = 1.0;
        zoomState.panX = 0;
        zoomState.panY = 0;
        applyTransform();
    }
    
    // Hold Screen (450ms) -> Compare Single LAST Edit Impact
    let screenHoldTimer = null;
    let isComparingLastEdit = false;
    let savedCurrentState = null;
    let holdStartX = 0;
    let holdStartY = 0;
    
    function triggerScreenHoldCompare() {
        if (!engine) return;
        if (historyIndex > 0 && historyStack[historyIndex - 1]) {
            isComparingLastEdit = true;
            savedCurrentState = captureCurrentState();
            applyHistoryState(historyStack[historyIndex - 1]);
        } else {
            isComparingLastEdit = true;
            engine.setBypass(true);
            triggerEngineRender();
        }
    }
    
    function releaseScreenHoldCompare() {
        if (screenHoldTimer) {
            clearTimeout(screenHoldTimer);
            screenHoldTimer = null;
        }
        if (isComparingLastEdit) {
            if (savedCurrentState) {
                applyHistoryState(savedCurrentState);
                savedCurrentState = null;
            }
            if (engine) {
                engine.setBypass(false);
                triggerEngineRender();
            }
            isComparingLastEdit = false;
        }
    }

    // 1. Touch Gestures & Screen Hold
    mainCanvas.style.cursor = 'grab';
    
    let initialPinchDist = 0;
    let initialPinchScale = 1.0;
    
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            releaseScreenHoldCompare();
            initialPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialPinchScale = zoomState.scale;
        } else if (e.touches.length === 1) {
            zoomState.isDragging = true;
            zoomState.startX = e.touches[0].clientX - zoomState.panX;
            zoomState.startY = e.touches[0].clientY - zoomState.panY;
            holdStartX = e.touches[0].clientX;
            holdStartY = e.touches[0].clientY;
            
            releaseScreenHoldCompare();
            screenHoldTimer = setTimeout(triggerScreenHoldCompare, 450);
        }
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist > 0) {
            releaseScreenHoldCompare();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scaleFactor = dist / initialPinchDist;
            zoomState.scale = initialPinchScale * scaleFactor;
            applyTransform();
        } else if (e.touches.length === 1 && zoomState.isDragging) {
            if (Math.hypot(e.touches[0].clientX - holdStartX, e.touches[0].clientY - holdStartY) > 6) {
                if (screenHoldTimer) { clearTimeout(screenHoldTimer); screenHoldTimer = null; }
            }
            zoomState.panX = e.touches[0].clientX - zoomState.startX;
            zoomState.panY = e.touches[0].clientY - zoomState.startY;
            applyTransform();
        }
    }, { passive: true });
    
    let lastTapTime = 0;
    container.addEventListener('touchend', (e) => {
        releaseScreenHoldCompare();
        if (e.touches.length < 2) initialPinchDist = 0;
        if (e.touches.length === 0) zoomState.isDragging = false;
        
        if (e.changedTouches && e.changedTouches.length === 1) {
            const now = Date.now();
            const tapDelay = now - lastTapTime;
            if (tapDelay > 40 && tapDelay < 320) {
                resetZoomAndPan();
                lastTapTime = 0;
                return;
            }
            lastTapTime = now;
        }
    });
    
    // 2. Mouse Drag Pan & Mouse Hold
    mainCanvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        zoomState.isDragging = true;
        zoomState.startX = e.clientX - zoomState.panX;
        zoomState.startY = e.clientY - zoomState.panY;
        holdStartX = e.clientX;
        holdStartY = e.clientY;
        mainCanvas.style.cursor = 'grabbing';
        
        releaseScreenHoldCompare();
        screenHoldTimer = setTimeout(triggerScreenHoldCompare, 450);
        
        try { mainCanvas.setPointerCapture(e.pointerId); } catch(err) {}
    });
    
    mainCanvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        if (zoomState.isDragging) {
            if (Math.hypot(e.clientX - holdStartX, e.clientY - holdStartY) > 6) {
                if (screenHoldTimer) { clearTimeout(screenHoldTimer); screenHoldTimer = null; }
            }
            zoomState.panX = e.clientX - zoomState.startX;
            zoomState.panY = e.clientY - zoomState.startY;
            applyTransform();
        }
    });
    
    const stopPan = (e) => {
        releaseScreenHoldCompare();
        if (zoomState.isDragging) {
            zoomState.isDragging = false;
            mainCanvas.style.cursor = 'grab';
            try { mainCanvas.releasePointerCapture(e.pointerId); } catch(err) {}
        }
    };
    mainCanvas.addEventListener('pointerup', stopPan);
    mainCanvas.addEventListener('pointercancel', stopPan);
    
    // 3. Trackpad & Mouse Wheel Zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSensitivity = e.ctrlKey ? 0.01 : 0.0025;
        const delta = -e.deltaY * zoomSensitivity;
        zoomState.scale = zoomState.scale * (1.0 + delta);
        applyTransform();
    }, { passive: false });
    
    // 4. Double Click / Double Tap -> Reset Zoom & Pan to Fullwidth (100%)
    container.addEventListener('dblclick', (e) => {
        e.preventDefault();
        resetZoomAndPan();
    });
}

window.addEventListener('load', () => {
    setupGestureZoom();
});
