let capturedImage = null;

document.getElementById("captureBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["html2canvas.min.js", "content.js"],
  });
  chrome.tabs.sendMessage(tab.id, { action: "startCapture" });
});

function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function initGauge() {
  const arc = document.getElementById("arc");
  arc.setAttribute("d", describeArc(100, 80, 50, -170, 180));
}

function updateGauge(confidence, predictedClass) {
  const fillPath = document.getElementById("fill");
  const valueText = document.getElementById("value");

  // Map confidence (0-1) to our angle range (-170 to 180)
  const startAngle = -170;
  const endAngle = 180;
  const angleRange = endAngle - startAngle;
  const mappedAngle = startAngle + angleRange * confidence;

  fillPath.setAttribute("d", describeArc(100, 80, 50, -170, mappedAngle));
  fillPath.setAttribute(
    "stroke",
    predictedClass == "real" ? "#2ecc71" : "#e74c3c"
  );
  valueText.textContent = `${(confidence * 100).toFixed(1)}%`;
}

document.addEventListener("DOMContentLoaded", initGauge);

document.getElementById("predictBtn").addEventListener("click", async () => {
  if (!capturedImage) return;

  try {
    const response = await fetch("http://localhost:5000/predict/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: capturedImage }),
    });

    const result = await response.json();
    const predDiv = document.getElementById("prediction");
    predDiv.textContent = `Prediction: ${result.predicted_class}`;
    predDiv.className = result.predicted_class.toLowerCase();

    updateGauge(result.confidence, result.predicted_class.toLowerCase());

    // Create prediction data object
    const predictionData = {
      class: result.predicted_class,
      confidence: result.confidence,
      image: capturedImage,
      heatMap: result.heatmap_image,
      localizedImage: result.localized_image,
      timestamp: Date.now(),
    };

    // Retrieve and update history
    chrome.storage.local.get("predictionsHistory", (data) => {
      let predictions = data.predictionsHistory || [];

      // Ensure only the 3 most recent predictions are stored
      predictions.push(predictionData);
      if (predictions.length > 3) {
        predictions.shift(); // Remove the oldest entry if exceeding 3
      }

      // Save updated history along with the last prediction
      chrome.storage.local.set({
        predictionsHistory: predictions,
        lastPrediction: predictionData,
      });
    });

    // Show dashboard button
    document.getElementById("dashboardBtn").style.display = "block";

    console.log(
      "Predicted:",
      result.predicted_class,
      "Confidence:",
      result.confidence
    );
  } catch (error) {
    console.error("Prediction error:", error);
    document.getElementById("prediction").textContent =
      "Error: Could not get prediction";
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "screenshotCaptured") {
    const img = document.getElementById("screenshot");
    img.src = message.screenshot;
    img.style.display = "block";

    capturedImage = message.screenshot.split(",")[1]; // Store base64 without data URL prefix
    document.getElementById("predictBtn").style.display = "block";
  }
});

document.getElementById("dashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "dashboard.html" });
});