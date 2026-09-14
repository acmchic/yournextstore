from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def detect_repeated_print_regions(
    image_path: Path, fallback: dict[str, float]
) -> list[dict[str, float]]:
    """Detect repeated product columns from paired dark top/bottom anchors."""
    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        return [fallback]
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    dark = (gray < 105).astype(np.uint8) * 255
    dark = cv2.morphologyEx(
        dark, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 5))
    )
    component_count, _, stats, _ = cv2.connectedComponentsWithStats(dark)
    anchors = [
        tuple(int(value) for value in row[:4])
        for row in stats[1:component_count]
        if row[cv2.CC_STAT_AREA] >= width * height * 0.0005
        and width * 0.07 <= row[cv2.CC_STAT_WIDTH] <= width * 0.38
        and row[cv2.CC_STAT_HEIGHT] <= height * 0.22
    ]
    groups: list[list[tuple[int, int, int, int]]] = []
    for anchor in sorted(anchors, key=lambda box: box[0] + box[2] / 2):
        center_x = anchor[0] + anchor[2] / 2
        group = next(
            (
                candidate
                for candidate in groups
                if abs(center_x - np.mean([box[0] + box[2] / 2 for box in candidate]))
                < width * 0.16
            ),
            None,
        )
        if group is None:
            groups.append([anchor])
        else:
            group.append(anchor)

    regions = []
    for group in groups:
        ordered = sorted(group, key=lambda box: box[1])
        upper_row = [box for box in ordered if box[1] - ordered[0][1] < height * 0.06]
        upper = (
            min(box[0] for box in upper_row),
            min(box[1] for box in upper_row),
            max(box[0] + box[2] for box in upper_row) - min(box[0] for box in upper_row),
            max(box[1] + box[3] for box in upper_row) - min(box[1] for box in upper_row),
        )
        lower = ordered[-1]
        if len(ordered) < 2 or lower[1] - (upper[1] + upper[3]) < height * 0.25:
            continue
        left = upper[0] + width * 0.03
        right = upper[0] + upper[2] - width * 0.03
        top = upper[1] + upper[3] + height * 0.025
        bottom = lower[1] - height * 0.025
        if right - left < width * 0.08 or bottom - top < height * 0.18:
            continue
        regions.append(
            {
                "x": left / width,
                "y": top / height,
                "width": (right - left) / width,
                "height": (bottom - top) / height,
            }
        )
    return sorted(regions, key=lambda region: region["x"]) if len(regions) > 1 else [fallback]
