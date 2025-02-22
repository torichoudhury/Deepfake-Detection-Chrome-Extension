from transformers import AutoImageProcessor, AutoModelForImageClassification
from PIL import Image
import torch
import numpy as np
import cv2
import matplotlib.pyplot as plt

# Load the image processor and model
processor = AutoImageProcessor.from_pretrained("prithivMLmods/Deep-Fake-Detector-Model")
model = AutoModelForImageClassification.from_pretrained("prithivMLmods/Deep-Fake-Detector-Model")

# Load an image
image_path = "real.jpg"  # Replace with your image path
image = Image.open(image_path)

# Preprocess the image
inputs = processor(images=image, return_tensors="pt")

# # Perform inference
# with torch.no_grad():
#     outputs = model(**inputs)

# # Get predicted class
# logits = outputs.logits
# predicted_class = logits.argmax(-1).item()

# # Map predicted class to label
# labels = model.config.id2label
# print(f"Predicted Label: {labels[predicted_class]}")

# Perform inference
with torch.no_grad():
    outputs = model(**inputs)
    predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)

# Get the predicted class
class_names = model.config.id2label
predicted_class = class_names[torch.argmax(predictions).item()]
confidence = predictions.max().item()

print(f"Predicted class: {predicted_class} (Confidence: {confidence:.2f})")

# Region localization (example using an edge detection approach for visualization)
image_np = np.array(image)
gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
edges = cv2.Canny(gray, 100, 200)

# Overlay edges on original image
image_np[edges > 0] = [255, 0, 0]  # Highlight regions in red

# Display the image with detected regions
cv2.imshow("Localized Forgery Regions", image_np)
cv2.waitKey(0)
cv2.destroyAllWindows()

# # Generate a heatmap for localization
# image_np = np.array(image)
# height, width, _ = image_np.shape

# # Use model activations to identify manipulated regions
# activation_map = outputs.logits.squeeze().detach().cpu().numpy()
# activation_map = cv2.resize(activation_map, (width, height))  # Resize to match image dimensions

# # Normalize activation map
# heatmap = cv2.normalize(activation_map, None, 0, 1, cv2.NORM_MINMAX)

# # Apply colormap to highlight real (green) and fake (red) regions
# colormap = cv2.applyColorMap((heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET)
# blended = cv2.addWeighted(image_np, 0.6, colormap, 0.4, 0)

# # Display the heatmap overlay
# plt.figure(figsize=(8, 6))
# plt.imshow(blended)
# plt.axis("off")
# plt.title("Localized Forgery Heatmap")
# plt.show()