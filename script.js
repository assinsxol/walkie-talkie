// =====================================================
// VIDEO CONTROL
// =====================================================

const video = document.querySelector("#lessonVideo");

const videoScreen = document.querySelector("#videoScreen");

videoScreen.addEventListener("click", () => {

  if (video.paused) {

    video.play();

  } else {

    video.pause();

  }

});

// =====================================================
// IMAGE UPLOAD
// =====================================================

const imageInput = document.querySelector("#imageInput");

imageInput.addEventListener("change", (event) => {

  const file = event.target.files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  document
    .querySelector("#imagePanel")
    .setAttribute("src", url);

});

// =====================================================
// VIDEO UPLOAD
// =====================================================

const videoInput = document.querySelector("#videoInput");

videoInput.addEventListener("change", (event) => {

  const file = event.target.files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  video.src = url;

  video.load();

});

// =====================================================
// PDF OPEN
// =====================================================

const pdfInput = document.querySelector("#pdfInput");

pdfInput.addEventListener("change", (event) => {

  const file = event.target.files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  // فتح PDF
  window.open(url, "_blank");

});

// =====================================================
// VR DRAWING SYSTEM
// =====================================================

let drawing = false;

let currentLine = [];

let lineEntity = null;

const scene = document.querySelector("a-scene");

const rightHand = document.querySelector("#rightHand");

// ===========================================
// START DRAWING
// ===========================================

rightHand.addEventListener("triggerdown", () => {

  drawing = true;

  currentLine = [];

  lineEntity = document.createElement("a-entity");

  scene.appendChild(lineEntity);

});

// ===========================================
// STOP DRAWING
// ===========================================

rightHand.addEventListener("triggerup", () => {

  drawing = false;

});

// ===========================================
// DRAW LOOP
// ===========================================

scene.addEventListener("tick", () => {

  if (!drawing) return;

  const position = rightHand.object3D.position;

  currentLine.push({

    x: position.x,
    y: position.y,
    z: position.z

  });

  if (currentLine.length < 2) return;

  let pathString = "";

  currentLine.forEach((point) => {

    pathString += `
      ${point.x}
      ${point.y}
      ${point.z},
    `;

  });

  lineEntity.setAttribute("line", {

    path: pathString,

    color: "#0000FF"

  });

});
