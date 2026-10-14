// =====================================================================
//  STARTER FILE
//  PART A (below) is the hand-tracking engine. Don't change it.
//  PART B (at the bottom) is your artwork, and Qwen writes it.
// =====================================================================

// ---------------------------------------------------------------------
//  PART A — HAND TRACKING (identical in all three projects)
// ---------------------------------------------------------------------
const MP_VERSION = "0.10.21";
const MP_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let video;
let handLandmarker = null;
let hands = [];
let lastVideoTime = -1;
let started = false;
let showCamera = false;

// Landmark numbers we use
const WRIST = 0, THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_BASE = 9;

async function loadHandLandmarker() {
  setStatus("Loading hand model…");
  const vision = await import(`${MP_URL}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: 2,
  });
  try {
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch (e) {
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

let cameraOk = null;

function updateHands() {
  if (!handLandmarker || !video) return;

  const ok = video.elt.readyState >= 2;
  if (ok !== cameraOk) {
    cameraOk = ok;
    setStatus(ok ? "Show your hand to the camera ✋"
                 : "Waiting for the camera… click Allow, or the camera icon in the address bar, then reload");
  }
  if (!ok) return;
  if (video.elt.currentTime === lastVideoTime) return;
  lastVideoTime = video.elt.currentTime;

  const result = handLandmarker.detectForVideo(video.elt, performance.now());
  hands = result.landmarks.map((hand, i) => {
    const pts = hand.map((p) => ({ x: (1 - p.x) * width, y: p.y * height, z: p.z }));
    pts.side = result.handedness[i][0].categoryName;
    return pts;
  });
}

function drawCamera() {
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 70);
  image(video, 0, 0, width, height);
  pop();
}

function setStatus(msg) {
  select("#status").html(msg);
}

// =====================================================================
//  PART B — YOUR ARTWORK
// =====================================================================
// =====================================================================
//  PART B — YOUR ARTWORK
// =====================================================================
const PALETTE = ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#8ab6d6", "#f1faee", "#6d3b8c", "#1d3557"];
let circles = [];
let growing = null;
let wasPinching = false;
let hum;
let bell;
let bellEnv;

// 五声音阶 (Pentatonic Scale)
const SCALE = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  select("#start").mouseClicked(startExperience);
}

function startExperience() {
  if (started) return;
  userStartAudio();
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 初始化振荡器和包络
  hum = new p5.Oscillator("triangle");
  hum.amp(0);
  hum.start();

  bell = new p5.Oscillator("sine");
  bell.amp(0);
  bell.start();

  bellEnv = new p5.Envelope();
  bellEnv.setADSR(0.005, 0.4, 0, 0.1);
  bellEnv.setRange(0.5, 0);

  select("#intro").hide();
  started = true;
  loadHandLandmarker();
}

function draw() {
  background(12, 18, 38);
  if (!started) return;

  updateHands();
  if (showCamera) drawCamera();

  // 绘制已保存的圆圈
  for (const c of circles) drawKandinskyCircle(c);

  // 如果没有检测到手，重置状态并关闭嗡嗡声
  if (hands.length === 0) {
    hum.amp(0, 0.2);
    growing = null;
    wasPinching = false;
    return;
  }

  // 在手部关键点上画白色小圆点
  fill(255);
  for (const h of hands) {
    for (const p of h) {
      circle(p.x, p.y, 8);
    }
  }

  const hand = hands[0];
  const handSize = dist(hand[0].x, hand[0].y, hand[9].x, hand[9].y);
  let isPinching = false;
  const px = (hand[4].x + hand[8].x) / 2;
  const py = (hand[4].y + hand[8].y) / 2;
  
  if (handSize > 0) {
    isPinching = dist(hand[4].x, hand[4].y, hand[8].x, hand[8].y) / handSize < 0.3;
  }

  // 捏合逻辑与声音
  if (isPinching && !wasPinching) {
    growing = { x: px, y: py, r: 10, colors: shuffle(PALETTE).slice(0, 3) };
  } else if (isPinching && growing !== null) {
    growing.r = min(growing.r + 2.5, 260);
    growing.x = lerp(growing.x, px, 0.3);
    growing.y = lerp(growing.y, py, 0.3);
    drawKandinskyCircle(growing);
    
    // 圆圈越大，频率越低（音调变低）
    hum.freq(map(growing.r, 10, 260, 660, 110));
    hum.amp(0.12, 0.1);
  } else if (!isPinching && wasPinching && growing !== null) {
    circles.push(growing);
    ringBell(growing.r); // 松开时敲响铃铛
    hum.amp(0, 0.15);
    growing = null;
  }

  wasPinching = isPinching;

  // 画一个空心光标，提示当前手势状态
  noFill();
  stroke(241, 234, 216, 180);
  strokeWeight(2);
  circle(px, py, isPinching ? 16 : 34);
  noStroke();
}

function drawKandinskyCircle(c) {
  noStroke();

  let halo = color(c.colors[0]);
  halo.setAlpha(70);
  fill(halo);
  circle(c.x, c.y, c.r * 2.4);

  let body = color(c.colors[1]);
  body.setAlpha(215);
  fill(body);
  circle(c.x, c.y, c.r * 2);

  let core = color(c.colors[2]);
  core.setAlpha(230);
  fill(core);
  circle(c.x + c.r * 0.18, c.y - c.r * 0.12, c.r * 0.9);
}

function ringBell(r) {
  // 半径映射到五声音阶的音符上
  const i = floor(map(r, 10, 260, SCALE.length - 1, 0, true));
  bell.freq(midiToFreq(SCALE[i]));
  bellEnv.play(bell);
}

function keyPressed() {
  if (key === 'v' || key === 'V') {
    showCamera = !showCamera;
  } else if (key === 'c' || key === 'C') {
    circles = [];
  } else if (key === 's' || key === 'S') {
    saveCanvas("my-kandinsky", "png");
  }
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}