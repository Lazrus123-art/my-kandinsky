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
const PALETTE = ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#8ab6d6", "#f1faee", "#6d3b8c", "#1d3557"];
let circles = [];
let growing = null;
let wasPinching = false;
function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  select("#start").mouseClicked(startExperience);
}

function startExperience() {
  userStartAudio();
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  select("#intro").hide();
  started = true;
  loadHandLandmarker();
}

function draw() {
  background(12, 18, 38);

  if (started === false) {
    return;
  }

  updateHands();
  if (showCamera === true) {
    drawCamera();
  }

  for (let i = 0; i < circles.length; i++) {
    drawKandinskyCircle(circles[i]);
  }

  if (!hands || hands.length === 0) {
    growing = null;
    wasPinching = false;
    return;
  }

  const hand = hands[0];
  const wrist = hand[WRIST];
  const palm = hand[MIDDLE_BASE];
  const thumb = hand[THUMB_TIP];
  const index = hand[INDEX_TIP];

  const handSize = max(dist(wrist.x, wrist.y, palm.x, palm.y), 1);
  const pinchDist = dist(thumb.x, thumb.y, index.x, index.y);
  const isPinching = pinchDist / handSize < 0.3;

  const px = (thumb.x + index.x) / 2;
  const py = (thumb.y + index.y) / 2;

  if (isPinching && !wasPinching) {
    growing = {
      x: px,
      y: py,
      r: 10,
      colors: shuffle(PALETTE).slice(0, 3)
    };
  }

  if (isPinching && growing !== null) {
    growing.r = min(growing.r + 2.5, 260);
    growing.x = lerp(growing.x, px, 0.3);
    growing.y = lerp(growing.y, py, 0.3);
    drawKandinskyCircle(growing);
  }

  if (!isPinching && wasPinching && growing !== null) {
    circles.push(growing);
    growing = null;
  }

  wasPinching = isPinching;

  noFill();
  stroke(241, 234, 216, 180);
  strokeWeight(2);
  circle(px, py, isPinching ? 16 : 34);
  noStroke();
}

function keyPressed() {
  if (key === "v" || key === "V") {
    showCamera = !showCamera;
  } else if (key === "c" || key === "C") {
    circles = [];
  } else if (key === "s" || key === "S") {
    saveCanvas("my-kandinsky", "png");
  }
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
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