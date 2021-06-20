const volume = document.getElementById('volume')
const range = document.getElementById('overdrive');
const bass = document.getElementById('bass')
const mid = document.getElementById('mid')
const treble = document.getElementById('treble')
const visualizer = document.getElementById('visualizer')
const muteButton = document.getElementById('mute')

const context = new AudioContext();
const gainNode = new GainNode(context, { gain: volume.value });
const makeUpGain = new GainNode(context, {
    gain: 50
  });
const bassEQ = new BiquadFilterNode(context, { 
    type: 'lowshelf', 
    frequency: 600,
    gain: bass.value
});
const middleEQ = new BiquadFilterNode(context, { 
    peaking: 'peaking', 
    frequency: 2000,
    gain: mid.value,
    Q: Math.SQRT1_2
});
const trebleEQ = new BiquadFilterNode(context, { 
    type: 'highshelf', 
    frequency: 4000,
    gain: treble.value
});
const overdriveNode = new WaveShaperNode(context, {
    curve: makeOverdriveCurve(range.value * 10),
    oversample: '4x'
})
const overdriveConvolver = new ConvolverNode(context);
const reverb = new ConvolverNode(context);
const analyserNode = new AnalyserNode(context, { fftSize: 1024 });

let muted = false;

function setRotation(id, multiplier, angleOffset = 0) {
    function rotate(angle) {
        const knob = $(`.control-${id}`);
        knob.css("transform", "rotate(" + (angle - 150) + "deg)");
    }
    const input = $(`#${id}`)
    const initialAngle = input.val() * multiplier + angleOffset;
 
    rotate(initialAngle);

    input.on("input", function () {
        const newAngle = $(this).val() * multiplier + angleOffset;
        rotate(newAngle);
    });
}

function setupEventListeners() {
    window.addEventListener('resize', resize);
    volume.addEventListener('input', e => {
        gainNode.gain.setTargetAtTime(parseFloat(e.target.value), context.currentTime, 0.01);
    });
    range.addEventListener('input', function(){
        const value = parseInt(this.value) * 5;
        overdriveNode.curve = makeOverdriveCurve(value);
      });
    bass.addEventListener('input', e => {
        bassEQ.gain.setTargetAtTime(parseInt(e.target.value), context.currentTime, 0.01);
    });
    mid.addEventListener('input', e => {
        middleEQ.gain.setTargetAtTime(parseInt(e.target.value), context.currentTime, 0.01);
    });
    treble.addEventListener('input', e => {
        trebleEQ.gain.setTargetAtTime(parseInt(e.target.value), context.currentTime, 0.01);
    });
    muteButton.addEventListener('click', () => {
        muted = !muted;
        if(muted) {
            gainNode.gain.setTargetAtTime(.0, context.currentTime, 0.01);
            muteButton.classList.add('muted');
        } else {
            gainNode.gain.setTargetAtTime(parseFloat(volume.value), context.currentTime, 0.01);
            muteButton.classList.remove('muted');
        }
    });
    setRotation('volume', 300);
    setRotation('overdrive', 15);
    setRotation('bass', 15, 150);
    setRotation('mid', 15, 150);
    setRotation('treble', 15, 150);
}

function decodeImpulse(url, convolverNode) {
    return fetch(url)
    .then(response => response.arrayBuffer())
    .then(buffer => {
        context.decodeAudioData(buffer, decoded => {
        convolverNode.buffer = decoded;
    })
    .catch((err) => console.error(err));
    });
}

async function setupContext() {
    const guitar = await getGuitar();
    if (context.state === 'suspended') {
        await context.resume();
    }
    await decodeImpulse('./impulses/overdrive.wav', overdriveConvolver);
    await decodeImpulse('./impulses/reverb.wav', reverb);
    const source = context.createMediaStreamSource(guitar);
    source
        .connect(overdriveConvolver)
        .connect(reverb)
        .connect(reverb)
        .connect(makeUpGain)
        .connect(bassEQ)
        .connect(middleEQ)
        .connect(trebleEQ)
        .connect(gainNode)
        .connect(overdriveNode)
        .connect(analyserNode)
        .connect(context.destination);
}

function getGuitar() {
    return navigator.mediaDevices.getUserMedia({
        audio: {
            latency: 0,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,

        }
    })
}

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteFrequencyData(dataArray);
    const width = visualizer.width;
    const height = visualizer.height;
    const barWidth = width * 4.5 / bufferLength;

    const canvasContext = visualizer.getContext('2d');
    canvasContext.clearRect(0, 0, width, height);

    dataArray.forEach((item, index) => {
        const y =  item / 255 * height / 2;
        const x = barWidth * index;

        canvasContext.fillStyle = 'purple';
        canvasContext.fillRect(x, height - y, barWidth, y);
    });
}

function makeOverdriveCurve( amount ) {
    var k = typeof amount === 'number' ? amount : 0,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;
    for ( ; i < n_samples; ++i ) {
      x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + k ) * x * 30 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
  };

function resize() {
    visualizer.width = visualizer.clientWidth * window.devicePixelRatio;
    visualizer.height = visualizer.clientHeight * window.devicePixelRatio;
}

setupEventListeners();
setupContext();
resize();
drawVisualizer();
