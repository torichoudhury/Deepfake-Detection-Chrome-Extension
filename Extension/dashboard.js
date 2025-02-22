// Function to handle file upload and convert to base64
function handleFileUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Function to update the dashboard UI with new prediction results
function updateDashboardUI(predictionData) {
  document.getElementById(
    "originalImage"
  ).src = `data:image/png;base64,${predictionData.image}`;
  document.getElementById(
    "heatMap"
  ).src = `data:image/png;base64,${predictionData.heatMap}`;
  document.getElementById(
    "localizedImage"
  ).src = `data:image/png;base64,${predictionData.localizedImage}`;

  const predictionClass = document.querySelector(".fake");
  predictionClass.textContent = predictionData.class;

  const deepfakeLabel = document.querySelector(".deepfake-label");

  if (predictionData.class.toLowerCase() === "real") {
    predictionClass.classList.remove("fake");
    predictionClass.classList.add("real");

    // Hide deepfake label
    deepfakeLabel.style.display = "none";
  } else {
    predictionClass.classList.remove("real");
    predictionClass.classList.add("fake");

    // Show deepfake label
    deepfakeLabel.style.display = "block";
  }

  document.querySelector(".confidence").textContent = `${(
    predictionData.confidence * 100
  ).toFixed(1)}% confidence`;
}

// Function to save prediction to history
function savePredictionToHistory(predictionData) {
  // Add timestamp to the prediction data
  const predictionWithTimestamp = {
    ...predictionData,
    timestamp: Date.now(),
  };

  // Get existing history
  chrome.storage.local.get("predictionsHistory", (data) => {
    const predictions = data.predictionsHistory || [];

    // Add new prediction to history (limit to most recent 3)
    predictions.push(predictionWithTimestamp);
    if (predictions.length > 3) {
      predictions.shift(); // Remove oldest entry if exceeding 3
    }

    // Save updated history
    chrome.storage.local.set({
      predictionsHistory: predictions,
      lastPrediction: predictionWithTimestamp,
    });
  });
}

// Function to make prediction request
async function getPrediction(imageBase64) {
  try {
    const response = await fetch("http://localhost:5000/predict/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: imageBase64 }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Create prediction data object
    const predictionData = {
      class: result.predicted_class,
      confidence: result.confidence,
      image: imageBase64,
      heatMap: result.heatmap_image,
      localizedImage: result.localized_image,
    };

    // Save to history
    savePredictionToHistory(predictionData);

    // Update the dashboard
    updateDashboardUI(predictionData);
  } catch (error) {
    console.error("Prediction error:", error);
    alert("Error getting prediction. Please try again.");
  }
}

// Create hidden file input
const imageInput = document.createElement("input");
imageInput.type = "file";
imageInput.accept = "image/*";
imageInput.style.display = "none";
document.body.appendChild(imageInput);

// Handle file selection
imageInput.addEventListener("change", async (event) => {
  if (event.target.files && event.target.files[0]) {
    const file = event.target.files[0];
    try {
      const imageBase64 = await handleFileUpload(file);
      await getPrediction(imageBase64);
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Error processing file. Please try again.");
    }
  }
});

// Function to handle audio file upload and convert to base64
function handleAudioUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Function to update the audio UI with new prediction results
function updateAudioDashboardUI(predictionData) {
  const audioPlayer = document.getElementById("audioPlayer");
  audioPlayer.src = `data:audio/wav;base64,${predictionData.audio}`;

  const predictionClass = document.querySelector(".audio-fake");
  predictionClass.textContent = predictionData.class;

  if (predictionData.class.toLowerCase() === "real") {
    predictionClass.classList.remove("fake");
    predictionClass.classList.add("real");
  } else {
    predictionClass.classList.remove("real");
    predictionClass.classList.add("fake");
  }

  document.querySelector(".audio-confidence").textContent = `${(
    predictionData.confidence * 100
  ).toFixed(1)}% confidence`;

  // Update feature bars
  document.getElementById(
    "pitchBar"
  ).style.width = `${predictionData.features.pitch_consistency}%`;
  document.getElementById(
    "naturalBar"
  ).style.width = `${predictionData.features.voice_naturalness}%`;
  document.getElementById(
    "noiseBar"
  ).style.width = `${predictionData.features.background_noise}%`;

  // Draw waveform
  drawWaveform(predictionData.waveform);
}

// Function to draw audio waveform
function drawWaveform(waveformData) {
  const canvas = document.getElementById("waveformCanvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.strokeStyle = "#3B82F6";
  ctx.lineWidth = 2;

  const step = Math.ceil(waveformData.length / width);
  const amp = height / 2;

  for (let i = 0; i < width; i++) {
    const x = i;
    const y = (1 + waveformData[i * step]) * amp;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

// Function to make audio prediction request
async function getAudioPrediction(audioBase64) {
  try {
    const response = await fetch("http://localhost:5000/predict/audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio: audioBase64 }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Create prediction data object
    const predictionData = {
      class: result.predicted_class,
      confidence: result.confidence,
      audio: audioBase64,
      features: result.features,
      waveform: result.waveform_data,
    };

    // Save to history
    savePredictionToHistory({
      ...predictionData,
      type: "audio",
    });

    // Update the dashboard
    updateAudioDashboardUI(predictionData);
  } catch (error) {
    console.error("Audio prediction error:", error);
    alert("Error analyzing audio. Please try again.");
  }
}

const audioInput = document.createElement("input");
audioInput.type = "file";
audioInput.accept = "audio/*";
audioInput.style.display = "none";
document.body.appendChild(audioInput);

audioInput.addEventListener("change", async (event) => {
  if (event.target.files && event.target.files[0]) {
    const file = event.target.files[0];
    try {
      const audioBase64 = await handleAudioUpload(file);
      await getAudioPrediction(audioBase64);
    } catch (error) {
      console.error("Error processing audio:", error);
      alert("Error processing audio. Please try again.");
    }
  }
});

// Initial load and event listeners
document.addEventListener("DOMContentLoaded", async () => {
  chrome.storage.local.get(["lastPrediction"], (data) => {
    if (data.lastPrediction) {
      if (data.lastPrediction.type === "audio") {
        updateAudioDashboardUI(data.lastPrediction);
      } else {
        updateDashboardUI(data.lastPrediction);
      }
    }
  });

  // Add click handlers to upload buttons
  const imageUploadBtn = document.querySelector(".image-upload");
  imageUploadBtn.addEventListener("click", () => {
    imageInput.click();
  });

  const audioUploadBtn = document.querySelector(".audio-upload");
  audioUploadBtn.addEventListener("click", () => {
    audioInput.click();
  });
});

document.addEventListener("DOMContentLoaded", function () {
  document
    .querySelector(".nav-buttons button:nth-child(1)")
    .addEventListener("click", function () {
      window.location.href = "dashboard.html";
    });

  document
    .querySelector(".nav-buttons button:nth-child(2)")
    .addEventListener("click", function () {
      window.location.href = "history.html";
    });

  document
    .querySelector(".nav-buttons button:nth-child(3)")
    .addEventListener("click", function () {
      window.location.href = "about.html";
    });
});
