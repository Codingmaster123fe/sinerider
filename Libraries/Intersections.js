/**
 * Utility functions for geometric intersections.
 * @returns {Object} The Intersections object.
 */
function Intersections() {
  /**
   * Checks if a point intersects with a circle.
   * @param {Object} point - The point with x and y properties.
   * @param {Object} circle - The circle with x, y, and radius properties.
   * @param {boolean} [hit=false] - Whether to return true if the point is on the edge.
   * @returns {boolean} True if the point intersects with the circle.
   */
  function pointCircle(point, circle, hit = false) {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return hit ? distance <= circle.radius : distance < circle.radius;
  }

  /**
   * Checks if a point intersects with a rectangle.
   * @param {Object} point - The point with x and y properties.
   * @param {Object} rect - The rectangle with x, y, width, and height properties.
   * @param {boolean} [hit=false] - Whether to return true if the point is on the edge.
   * @returns {boolean} True if the point intersects with the rectangle.
   */
  function pointRect(point, rect, hit = false) {
    const withinX = point.x > rect.x && point.x < rect.x + rect.width;
    const withinY = point.y > rect.y && point.y < rect.y + rect.height;
    if (hit) {
      const onEdgeX = point.x === rect.x || point.x === rect.x + rect.width;
      const onEdgeY = point.y === rect.y || point.y === rect.y + rect.height;
      return (withinX && withinY) || onEdgeX || onEdgeY;
    }
    return withinX && withinY;
  }

  /**
   * Checks if a point intersects with a polygon.
   * @param {Object} point - The point with x and y properties.
   * @param {Array} polygon - The polygon represented as an array of points.
   * @param {boolean} [hit=false] - Whether to return true if the point is on the edge.
   * @returns {boolean} True if the point intersects with the polygon.
   */
  function pointPolygon(point, polygon, hit = false) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
                        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  return {
    pointCircle,
    pointRect,
    pointPolygon,
  };
}
