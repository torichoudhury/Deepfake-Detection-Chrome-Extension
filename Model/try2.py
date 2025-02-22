from transformers import AutoImageProcessor, AutoModelForImageClassification
from PIL import Image
import torch
import numpy as np
import cv2
import matplotlib.pyplot as plt
import torch.nn.functional as F

# Load the image processor and model
processor = AutoImageProcessor.from_pretrained("prithivMLmods/Deep-Fake-Detector-Model")
model = AutoModelForImageClassification.from_pretrained("prithivMLmods/Deep-Fake-Detector-Model")

# Load an image
image_path = "real.jpg"  # Replace with your image path
image = Image.open(image_path)

# Preprocess the image
inputs = processor(images=image, return_tensors="pt")

# Enable gradient computation for the input tensors
for tensor in inputs.values():
    if isinstance(tensor, torch.Tensor):
        tensor.requires_grad_(True)

# Set the model to evaluation mode
model.eval()

# Perform inference
outputs = model(**inputs, output_attentions=True)

# Extract the attention weights from the last layer
attn_weights = outputs.attentions[-1]  # Last layer's attention weights
print("Attention Weights Shape:", attn_weights.shape)

predictions = F.softmax(outputs.logits, dim=-1)

# Get the predicted class
class_names = model.config.id2label
predicted_class = class_names[torch.argmax(predictions).item()]
confidence = predictions.max().item()

print(f"Predicted class: {predicted_class} (Confidence: {confidence:.2f})")

image_np = np.array(image)
gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
edges = cv2.Canny(gray, 100, 200)

# Overlay edges on original image
image_np[edges > 0] = [255, 0, 0]  # Highlight regions in red

# Average across attention heads
attn_map = attn_weights.mean(dim=1).squeeze(0)  # Shape: (197, 197)

# Focus on CLS token attention (token 0)
cls_attn = attn_map[0, 1:].reshape(14, 14).detach().cpu().numpy()  # Reshape to (patch_h, patch_w)

# Resize attention map to match original image size
image_np = np.array(image)
height, width, _ = image_np.shape
attn_map_resized = cv2.resize(cls_attn, (width, height))

# Normalize attention map
attn_map_resized = np.maximum(attn_map_resized, 0)
attn_map_resized = cv2.normalize(attn_map_resized, None, 0, 1, cv2.NORM_MINMAX)

# **First Image: Attention Heatmap**
# Invert the heatmap for real images (to make blue dominant)
if predicted_class.lower() == "real":
    attn_map_resized = 1 - attn_map_resized  # Invert intensity

# Apply JET colormap
colormap = cv2.applyColorMap((attn_map_resized * 255).astype(np.uint8), cv2.COLORMAP_JET)

# Blend the heatmap with the original image
blended = cv2.addWeighted(image_np, 0.6, colormap, 0.4, 0)

image_np = np.array(image)
gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
edges = cv2.Canny(gray, 100, 200)

# Overlay edges on original image
if predicted_class.lower() == "real":
    image_np[edges > 0] = [0, 0, 255]  # Highlight regions in blue
else:
    image_np[edges > 0] = [255, 0, 0]  # Highlight regions in red

# **Display Both Images**
fig, axes = plt.subplots(1, 2, figsize=(12, 6))

# Show heatmap overlay
axes[0].imshow(blended)
axes[0].axis("off")
axes[0].set_title(f"Attention Heatmap (Predicted: {predicted_class})")

# Show localized area
axes[1].imshow(image_np)
axes[1].axis("off")
axes[1].set_title("Localized Region")

plt.show()
