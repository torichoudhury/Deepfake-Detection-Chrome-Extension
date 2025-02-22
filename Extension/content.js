let isSelecting = false;
let startX, startY;
let overlay, selection;

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "startCapture") {
    createOverlay();
  }
});

function createOverlay() {
  overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 10000;
    cursor: crosshair;
  `;

  selection = document.createElement("div");
  selection.style.cssText = `
    position: fixed;
    border: 2px solid #0074D9;
    background: rgba(0, 116, 217, 0.1);
    z-index: 10001;
    display: none;
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(selection);

  overlay.addEventListener("mousedown", startSelection);
  document.addEventListener("mousemove", updateSelection);
  document.addEventListener("mouseup", endSelection);
}

function startSelection(e) {
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;
  selection.style.display = "block";
}

function updateSelection(e) {
  if (!isSelecting) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selection.style.left = left + "px";
  selection.style.top = top + "px";
  selection.style.width = width + "px";
  selection.style.height = height + "px";
}

async function endSelection(e) {
  if (!isSelecting) return;

  isSelecting = false;
  const bounds = selection.getBoundingClientRect();

  // Remove overlay and selection before capturing
  overlay.remove();
  selection.remove();

  // Small delay to ensure UI elements are removed
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Now capture the screenshot
  captureScreenshot(bounds);

  // Clean up event listeners
  document.removeEventListener("mousemove", updateSelection);
  document.removeEventListener("mouseup", endSelection);
}

async function captureScreenshot(bounds) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = bounds.width;
  canvas.height = bounds.height;

  const imageData = await html2canvas(document.body, {
    x: bounds.left + window.scrollX,
    y: bounds.top + window.scrollY,
    width: bounds.width,
    height: bounds.height,
  });

  context.drawImage(imageData, 0, 0);

  const screenshot = canvas.toDataURL();
  chrome.runtime.sendMessage({
    action: "screenshotCaptured",
    screenshot: screenshot,
  });
}
