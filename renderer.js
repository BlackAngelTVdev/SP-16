const Tone = require('tone');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// --- 1. CHAINE D'EFFETS ---
// Filtre (Destination finale)
const filter = new Tone.Filter(20000, "lowpass").toDestination();
// Reverb (Connectée au filtre)
const reverb = new Tone.Reverb({ decay: 2, wet: 0 }).connect(filter);

// État de l'automation (16 steps par effet)
let autoData = {
    filter: new Array(16).fill(false),
    reverb: new Array(16).fill(false)
};


// hhfbghb
// hhfbghb
// hhfbghb
// hhfbghb
// hhfbghb


window.currentFXFocus = 'filter';

window.switchFXFocus = (type) => {
    window.currentFXFocus = type;
    
    // Update les boutons
    document.querySelectorAll('.fx-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === type);
    });

    // Update les lignes d'automation
    document.querySelectorAll('.automation-row').forEach(row => {
        row.classList.toggle('visible', row.id === `${type}-auto-row`);
    });
};
// --- 2. FONCTION DE CHARGEMENT DE KIT ---
window.loadBank = async () => {
    const filePath = await ipcRenderer.invoke('open-kit-file');
    if (!filePath) return;

    try {
        const rawData = fs.readFileSync(filePath);
        const content = JSON.parse(rawData);
        const baseDir = path.dirname(filePath);
        const samplesPath = path.join(baseDir, "samples").replace(/\\/g, '/');

        console.log(`⏳ Chargement : ${content.name}`);
        
        const newSampler = new Tone.Sampler({
            urls: content.mapping,
            baseUrl: "file:///" + samplesPath + "/",
            onload: () => {
                if (window.sampler) window.sampler.dispose();
                // ON CONNECTE LE SAMPLER A LA REVERB
                window.sampler = newSampler.connect(reverb);
                console.log("✅ Kit chargé !");
                
                // Update le texte dans la section FX pour le style
                document.querySelector('.fx-placeholder').innerText = content.name.toUpperCase();
            }
        });
    } catch (err) {
        console.error("❌ Erreur chargement :", err);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- 3. VARIABLES ET DOM ---
    const notes = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4", "C5", "C#5", "D5", "D#5"];
    let selectedPadIndex = 0;
    let isRecording = false;
    let isPlaying = false;
    let currentStepIndex = 0;
    let recordedPattern = Array.from({ length: 16 }, () => []);

    const pads = document.querySelectorAll('.pad');
    const steps = document.querySelectorAll('.step');
    const playBtn = document.getElementById('play-btn');
    const recordBtn = document.getElementById('record-btn');
    const bpmSlider = document.getElementById('bpm-slider');
    const bpmValue = document.getElementById('bpm-value');

    // --- 4. INITIALISATION DU SAMPLER PAR DÉFAUT ---
    window.sampler = new Tone.Sampler({
        urls: { "C4": "kick.wav" }, // Ajoute tes sons par défaut ici
        baseUrl: "./samples/"
    }).connect(reverb);

    // --- 5. GÉNÉRATION DE L'INTERFACE AUTOMATION ---
const autoSection = document.createElement('div');
autoSection.className = 'automation-section';

['filter', 'reverb'].forEach((type, index) => {
    const row = document.createElement('div');
    row.className = `automation-row ${index === 0 ? 'visible' : ''}`; // Filter visible par défaut
    row.id = `${type}-auto-row`;
    
    row.innerHTML = `
        <span class="auto-label">${type.toUpperCase()}</span>
        <div class="auto-steps" id="${type}-auto"></div>
    `;
    
    const stepsContainer = row.querySelector('.auto-steps');
    for (let i = 0; i < 16; i++) {
        const div = document.createElement('div');
        div.className = 'auto-step';
        // On initialise l'état visuel si des données existent déjà
        if (autoData[type][i]) div.classList.add('active');
        
        div.onclick = () => {
            autoData[type][i] = !autoData[type][i];
            div.classList.toggle('active', autoData[type][i]);
        };
        stepsContainer.appendChild(div);
    }
    autoSection.appendChild(row);
});
document.querySelector('.sequencer-container').appendChild(autoSection);
    // --- 6. LA BOUCLE (SEQUENCEUR) ---
    const loop = new Tone.Sequence((time, step) => {
        currentStepIndex = step;

        // Gestion Automation Audio
        // Filter : Si on coche, on descend à 800Hz, sinon 20000Hz (ouvert)
        const freq = autoData.filter[step] ? 800 : 20000;
        filter.frequency.setValueAtTime(freq, time);
        
        // Reverb : Si on coche, wet à 0.6, sinon 0
        reverb.wet.setValueAtTime(autoData.reverb[step] ? 0.6 : 0, time);

        // Visuels Steps
        Tone.Draw.schedule(() => {
            steps.forEach((s, idx) => {
                s.style.opacity = (idx === step) ? "1" : "0.5";
                s.style.borderColor = (idx === step) ? "#fff" : "#444";
            });
            // Animation des steps d'automation aussi
            document.querySelectorAll('.auto-step').forEach((as, idx) => {
                if (idx % 16 === step) as.style.filter = "brightness(1.5)";
                else as.style.filter = "brightness(1)";
            });
        }, time);

        // Trigger des notes
        recordedPattern[step].forEach(note => {
            window.sampler.triggerAttackRelease(note, "8n", time);
            Tone.Draw.schedule(() => {
                const padIdx = notes.indexOf(note);
                if (padIdx !== -1) { flashPad(padIdx); animateVuMeter(); }
            }, time);
        });
    }, [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], "16n");

    // --- 7. LOGIQUE PADS & CLAVIER ---
    function playPad(index) {
        const note = notes[index];
        selectedPadIndex = index;
        pads.forEach((p, i) => p.classList.toggle('selected', i === index));
        
        if (Tone.context.state !== 'running') Tone.start();
        window.sampler.triggerAttackRelease(note, "8n");
        
        flashPad(index);
        animateVuMeter();
        updateStepVisuals();

        if (isRecording && isPlaying) {
            if (!recordedPattern[currentStepIndex].includes(note)) {
                recordedPattern[currentStepIndex].push(note);
                updateStepVisuals();
            }
        }
    }

    function updateStepVisuals() {
        const selNote = notes[selectedPadIndex];
        steps.forEach((el, idx) => {
            el.classList.toggle('active', recordedPattern[idx].includes(selNote));
        });
    }

    function flashPad(i) {
        pads[i].classList.add('active');
        setTimeout(() => pads[i].classList.remove('active'), 100);
    }

    // --- 8. VU-METER ---
    const leftLeds = Array.from(document.querySelectorAll('#stack-left .led')).reverse();
    const rightLeds = Array.from(document.querySelectorAll('#stack-right .led')).reverse();
    let vuInterval;
    function animateVuMeter() {
        clearInterval(vuInterval);
        let level = 5;
        vuInterval = setInterval(() => {
            [leftLeds, rightLeds].forEach(stack => {
                stack.forEach((led, idx) => led.classList.toggle('on', idx < level));
            });
            level--;
            if (level < 0) clearInterval(vuInterval);
        }, 40);
    }

    // --- 9. BOUTONS ---
    playBtn.onclick = () => {
        if (!isPlaying) {
            Tone.Transport.start();
            loop.start(0);
            playBtn.innerText = "STOP";
        } else {
            Tone.Transport.stop();
            loop.stop();
            playBtn.innerText = "PLAY";
        }
        isPlaying = !isPlaying;
    };

    recordBtn.onclick = () => {
        isRecording = !isRecording;
        recordBtn.style.color = isRecording ? "red" : "white";
    };

    bpmSlider.oninput = (e) => {
        Tone.Transport.bpm.value = e.target.value;
        bpmValue.innerText = e.target.value;
    };

    pads.forEach((p, i) => p.onmousedown = () => playPad(i));

    const keyMap = { '1':0,'2':1,'3':2,'4':3,'a':4,'z':5,'e':6,'r':7,'q':8,'s':9,'d':10,'f':11,'w':12,'x':13,'c':14,'v':15 };
    document.onkeydown = (e) => {
        const i = keyMap[e.key.toLowerCase()];
        if (i !== undefined) playPad(i);
    };

    // Interaction séquenceur (clic pour ajouter une note)
    steps.forEach((el, idx) => {
        el.onclick = () => {
            const note = notes[selectedPadIndex];
            const nIdx = recordedPattern[idx].indexOf(note);
            if (nIdx === -1) recordedPattern[idx].push(note);
            else recordedPattern[idx].splice(nIdx, 1);
            updateStepVisuals();
        };
    });
});