#!/usr/bin/env python3
import sys
import os
import json
import cv2
import numpy as np

def main():
    if len(sys.argv) < 2:
        print("Usage: annotate_map.py INPUT_IMAGE [OUT_IMAGE] [OUT_JSON]")
        return
    inp = sys.argv[1]
    out_img = sys.argv[2] if len(sys.argv) > 2 else "harita_annotated.png"
    out_json = sys.argv[3] if len(sys.argv) > 3 else "centers.json"

    img = cv2.imread(inp)
    if img is None:
        print(f"Failed to load image: {inp}")
        return

    orig_h, orig_w = img.shape[:2]
    scale = 1.0
    # Resize for speed if image is very large
    max_dim = 1200
    if max(orig_w, orig_h) > max_dim:
        scale = max_dim / max(orig_w, orig_h)
        img_small = cv2.resize(img, (0,0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    else:
        img_small = img.copy()

    h, w = img_small.shape[:2]

    # Blur slightly and convert to data for clustering
    blur = cv2.GaussianBlur(img_small, (5,5), 0)
    data = blur.reshape((-1,3)).astype(np.float32)

    # Try clustering into 8 regions (map has ~8 kingdoms)
    K = 9
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    attempts = 5
    flags = cv2.KMEANS_PP_CENTERS
    _, labels, centers = cv2.kmeans(data, K, None, criteria, attempts, flags)

    labels = labels.reshape((h, w))

    annotated = cv2.cvtColor(img.copy(), cv2.COLOR_BGR2RGB)
    results = []

    for i in range(K):
        mask = (labels == i).astype('uint8') * 255
        # Morphology to clean mask
        kernel = np.ones((7,7), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        # pick the largest contour
        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area < 500:  # ignore tiny speckles
            continue

        M = cv2.moments(largest)
        if M.get('m00', 0) == 0:
            continue
        cx = int((M['m10'] / M['m00']) / scale)
        cy = int((M['m01'] / M['m00']) / scale)

        # draw marker on annotated image (BGR)
        cv2.circle(annotated, (cx, cy), 14, (255,0,0), -1)
        cv2.putText(annotated, str(len(results)+1), (cx-8, cy+6), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2, cv2.LINE_AA)

        results.append({
            'id': len(results)+1,
            'cluster': int(i),
            'x': cx,
            'y': cy,
            'area_px': int(area / (scale*scale))
        })

    # Save annotated image and json
    # Convert back to BGR for saving with cv2
    annotated_bgr = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)
    cv2.imwrite(out_img, annotated_bgr)
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump({'centers': results, 'source': os.path.basename(inp)}, f, indent=2)

    print(f"Wrote annotated image: {out_img}")
    print(f"Wrote centers JSON: {out_json}")

if __name__ == '__main__':
    main()
