import base64
import io
import torch
import numpy as np
import cv2
import torch.nn.functional as F
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from transformers import (
    AutoImageProcessor, 
    AutoModelForImageClassification,
    pipeline
)
import matplotlib.pyplot as plt
import librosa
import soundfile as sf

app = Flask(__name__)
CORS(app)

# Load Image Models & Processor
image_processor = AutoImageProcessor.from_pretrained("prithivMLmods/Deep-Fake-Detector-Model")
image_model = AutoModelForImageClassification.from_pretrained("prithivMLmods/Deep-Fake-Detector-Model")
image_model.eval()

# Load Audio Pipeline
audio_pipeline = pipeline("audio-classification", model="MelodyMachine/Deepfake-audio-detection-V2")

# Function to convert base64 string to PIL image
def base64_to_image(base64_str):
    img_data = base64.b64decode(base64_str)
    image = Image.open(io.BytesIO(img_data)).convert("RGB")
    return image

# Function to convert base64 string to audio array
def base64_to_audio(base64_str):
    audio_data = base64.b64decode(base64_str)
    audio_buffer = io.BytesIO(audio_data)
    audio_array, sample_rate = sf.read(audio_buffer)
    return audio_array, sample_rate

# Function to convert image to base64 string
def image_to_base64(image_np):
    image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
    _, buffer = cv2.imencode(".png", image_rgb)
    return base64.b64encode(buffer).decode("utf-8")

@app.route("/predict/image", methods=["POST"])
def predict_image():
    try:
        # Get base64 input
        data = request.json
        base64_str = data.get("image")

        if not base64_str:
            return jsonify({"error": "No image data received"}), 400

        # Convert base64 string to PIL image
        image = base64_to_image(base64_str)

        # Preprocess image
        inputs = image_processor(images=image, return_tensors="pt")

        # Perform inference
        outputs = image_model(**inputs, output_attentions=True)
        attn_weights = outputs.attentions[-1]

        predictions = F.softmax(outputs.logits, dim=-1)
        class_names = image_model.config.id2label
        predicted_class = class_names[torch.argmax(predictions).item()]
        confidence = predictions.max().item()

        # Generate visualizations
        image_np = np.array(image)
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 100, 200)

        attn_map = attn_weights.mean(dim=1).squeeze(0)
        cls_attn = attn_map[0, 1:].reshape(14, 14).detach().cpu().numpy()

        height, width, _ = image_np.shape
        attn_map_resized = cv2.resize(cls_attn, (width, height))
        attn_map_resized = np.maximum(attn_map_resized, 0)
        attn_map_resized = cv2.normalize(attn_map_resized, None, 0, 1, cv2.NORM_MINMAX)

        if predicted_class.lower() == "real":
            attn_map_resized = 1 - attn_map_resized

        colormap = cv2.applyColorMap((attn_map_resized * 255).astype(np.uint8), cv2.COLORMAP_JET)
        blended = cv2.addWeighted(image_np, 0.6, colormap, 0.4, 0)

        if predicted_class.lower() == "real":
            image_np[edges > 0] = [0, 0, 255]
        else:
            image_np[edges > 0] = [255, 0, 0]

        return jsonify({
            "predicted_class": predicted_class,
            "confidence": round(confidence, 2),
            "heatmap_image": image_to_base64(blended),
            "localized_image": image_to_base64(image_np)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/predict/audio", methods=["POST"])
def predict_audio():
    try:
        # Get base64 input
        data = request.json
        base64_str = data.get("audio")

        if not base64_str:
            return jsonify({"error": "No audio data received"}), 400

        # Convert base64 string to audio array
        audio_array, sample_rate = base64_to_audio(base64_str)

        # Ensure audio is mono and numpy array
        if len(audio_array.shape) > 1:
            audio_array = np.mean(audio_array, axis=1)
        
        # Convert to float32 if needed
        if audio_array.dtype != np.float32:
            audio_array = audio_array.astype(np.float32)

        # Perform inference using pipeline directly with numpy array
        result = audio_pipeline({"raw": audio_array, "sampling_rate": sample_rate})
        
        # Get the highest confidence prediction
        top_prediction = result[0]
        predicted_class = top_prediction["label"]
        confidence = top_prediction["score"]

        # Generate audio visualization
        plt.figure(figsize=(10, 4))
        
        # Plot waveform
        plt.subplot(2, 1, 1)
        plt.plot(audio_array)
        plt.title("Waveform")
        plt.xlabel("Sample")
        plt.ylabel("Amplitude")
        
        # Plot spectrogram
        plt.subplot(2, 1, 2)
        D = librosa.amplitude_to_db(np.abs(librosa.stft(audio_array)), ref=np.max)
        librosa.display.specshow(D, sr=sample_rate, x_axis='time', y_axis='hz')
        plt.colorbar(format='%+2.0f dB')
        plt.title("Spectrogram")
        
        # Save plot to base64
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        visualization_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        plt.close()

        return jsonify({
            "predicted_class": predicted_class,
            "confidence": round(confidence, 2),
            "visualization": visualization_base64
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)