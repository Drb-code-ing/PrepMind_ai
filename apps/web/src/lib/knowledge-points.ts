export function getDisplayKnowledgePoints(points: string[], limit = points.length) {
  const displayPoints: string[] = [];
  const seen = new Set<string>();

  for (const point of points) {
    const normalized = point.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    displayPoints.push(normalized);

    if (displayPoints.length >= limit) {
      break;
    }
  }

  return displayPoints;
}
