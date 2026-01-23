const Tone = require('tone');

// --- FONCTION GLOBALE POUR LE JSON ---
window.loadBank = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = JSON.parse(e.target.result);
            if (!content.mapping) return console.error("Format JSON invalide (mapping manquant)");

            console.log("Chargement du nouveau kit...");
            const newSampler = new Tone.Sampler({
                urls: content.mapping,
                baseUrl: "./samples/",
                onload: () => {
                    if (window.sampler) window.sampler.dispose();
                    window.sampler = newSampler.toDestination();
                    console.log("✅ Nouveau kit chargé :", content.name || "Custom");
                }
            });
        } catch (err) {
            console.error("❌ Erreur lecture JSON:", err);
        }
    };
    reader.readAsText(file);
};

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. INITIALISATION ---
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

    // VU-mètre
    const leftLeds = Array.from(document.querySelectorAll('#stack-left .led')).reverse();
    const rightLeds = Array.from(document.querySelectorAll('#stack-right .led')).reverse();

    // --- 2. SAMPLER PAR DÉFAUT ---
    window.sampler = new Tone.Sampler({
        urls: { 
            "C4": "kick.wav", "C#4": "snare.wav", "D4": "hihat_cl.wav", "D#4": "hihat_op.wav",
            "E4": "clap.wav", "F4": "tom_low.wav", "F#4": "tom_mid.wav", "G4": "tom_hi.wav",
            "G#4": "perc1.wav", "A4": "perc2.wav", "A#4": "rim.wav", "B4": "crash.wav",
            "C5": "ride.wav", "C#5": "fx1.wav", "D5": "fx2.wav", "D#5": "sub.wav"
        },
        baseUrl: "./samples/"
    }).toDestination();

    // --- 3. BOUCLE ---
    const loop = new Tone.Sequence((time, step) => {
        currentStepIndex = step;
        
        Tone.Draw.schedule(() => {
            steps.forEach((s, idx) => {
                s.style.opacity = (idx === step) ? "1" : "0.5";
                s.style.borderColor = (idx === step) ? "#ffffff" : "#444";
            });
        }, time);

        recordedPattern[step].forEach(note => {
            window.sampler.triggerAttackRelease(note, "8n", time);
            Tone.Draw.schedule(() => {
                const padIdx = notes.indexOf(note);
                if (padIdx !== -1) { flashPad(padIdx); animateVuMeter(); }
            }, time);
        });
    }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "16n");

    // --- 4. LOGIQUE PADS & SEQUENCEUR ---
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

    steps.forEach((el, idx) => {
        el.addEventListener('click', () => {
            const note = notes[selectedPadIndex];
            const nIdx = recordedPattern[idx].indexOf(note);
            if (nIdx === -1) recordedPattern[idx].push(note);
            else recordedPattern[idx].splice(nIdx, 1);
            updateStepVisuals();
        });
    });

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

    // --- 5. VU-METER ---
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

    // --- 6. CONTROLES ---
    playBtn.addEventListener('click', () => {
        if (!isPlaying) {
            Tone.Transport.start();
            loop.start(0);
            playBtn.innerText = "STOP";
        } else {
            Tone.Transport.stop();
            loop.stop();
            playBtn.innerText = "PLAY";
            steps.forEach(s => { s.style.opacity = "1"; s.style.borderColor = "#444"; });
        }
        isPlaying = !isPlaying;
    });

    recordBtn.addEventListener('click', () => {
        isRecording = !isRecording;
        recordBtn.style.color = isRecording ? "red" : "white";
    });

    bpmSlider.addEventListener('input', (e) => {
        Tone.Transport.bpm.value = e.target.value;
        bpmValue.innerText = e.target.value;
    });

    pads.forEach((p, i) => p.addEventListener('mousedown', () => playPad(i)));

    // Clavier
    const keyMap = { '1':0,'2':1,'3':2,'4':3,'a':4,'z':5,'e':6,'r':7,'q':8,'s':9,'d':10,'f':11,'w':12,'x':13,'c':14,'v':15 };
    document.addEventListener('keydown', (e) => {
        const i = keyMap[e.key.toLowerCase()];
        if (i !== undefined) playPad(i);
    });

    pads[0].classList.add('selected');
});