import type { Body } from './Body';
import type { Circle } from './Circle';
import type { Point } from './Point';
import type { Polygon } from './Polygon';

export function isCircle(body: Body): body is Circle {
	return body._circle
}

export function isPolygon(body: Body): body is Polygon {
	return body._polygon
}

export function isPoint(body: Body): body is Point {
	return body._point
}