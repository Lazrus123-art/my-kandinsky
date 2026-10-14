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

  // 确保有手的数据
  if (!hands || hands.length === 0) {
    return;
  }

  // 遍历每一只手，实现多点触控
  for (let hand of hands) {
    if (!hand || hand.length < 10) {
      continue;
    }

    const wrist = hand[WRIST];
    const palm = hand[MIDDLE_BASE];
    const thumb = hand[THUMB_TIP];
    const index = hand[INDEX_TIP];

    if (!wrist || !palm || !thumb || !index) {
      continue;
    }

    const handSize = dist(wrist.x, wrist.y, palm.x, palm.y);
    const pinchDistance = dist(thumb.x, thumb.y, index.x, index.y);
    const isPinching = handSize > 0 && pinchDistance / handSize < 0.3;

    const px = (thumb.x + index.x) / 2;
    const py = (thumb.y + index.y) / 2;

    noFill();
    stroke(241, 234, 216, 180);
    strokeWeight(2);
    circle(px, py, isPinching ? 16 : 34);
  }
  
  // 恢复默认设置
  noStroke();
  fill(255);
}

function keyPressed() {
  if (key === "v" || key === "V") {
    showCamera = !showCamera;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}