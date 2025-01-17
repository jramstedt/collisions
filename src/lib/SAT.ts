import type {Body} from './Body';
import type {Circle} from './Circle';
import type {Polygon} from './Polygon';
import type {Result} from './Result';

import { isCircle, isPolygon } from './checks';

/**
 * Determines if two bodies are colliding using the Separating Axis Theorem
 * 		a: The source body to test
 * 		b: The target body to test against
 * 		result: A Result object on which to store information about the collision
 * 		aabb: Set to false to skip the AABB test (useful if you use your own collision heuristic)
 */
export function SAT(a: Body, b: Body, result: Result | null = null, aabb = true): boolean {
	const a_polygon = isPolygon(a);
	const a_circle = isCircle(a);
	const b_polygon = isPolygon(b);
	const b_circle = isCircle(b);

	let collision = false;

	if (result !== null) {
		result.a = a;
		result.b = b;
		result.a_in_b = true;
		result.b_in_a = true;
		result.overlap = 0;
		result.overlap_x = 0;
		result.overlap_y = 0;
	}

	if (a_polygon) {
		if (
			a._dirty_coords ||
			a.x !== a._x ||
			a.y !== a._y ||
			a.angle !== a._angle ||
			a.scale_x !== a._scale_x ||
			a.scale_y !== a._scale_y
		) {
			a._calculateCoords();
		}
	}

	if (b_polygon) {
		if (
			b._dirty_coords ||
			b.x !== b._x ||
			b.y !== b._y ||
			b.angle !== b._angle ||
			b.scale_x !== b._scale_x ||
			b.scale_y !== b._scale_y
		) {
			b._calculateCoords();
		}
	}

	if (!aabb || aabbAABB(a, b)) {
		if (a_polygon && a._dirty_normals) {
			a._calculateNormals();
		}

		if (b_polygon && b._dirty_normals) {
			b._calculateNormals();
		}

		if (a_polygon && b_polygon) collision = polygonPolygon(a, b, result)
		else if (a_polygon && b_circle) collision = polygonCircle(a, b as any, result, false)
		else if (a_circle && b_polygon) collision = polygonCircle(b, a as any, result, true)
		else if (a_circle && b_circle) collision = circleCircle(a as any, b as any, result)
	}

	if (result) {
		result.collision = collision;
	}

	return collision;
}

/**
 * Determines if two bodies' axis aligned bounding boxes are colliding
 * 		a: The source body to test
 * 		b: The target body to test against
 */
function aabbAABB(a: Body, b: Body): boolean {
	const a_polygon = isPolygon(a);
	const a_x = a_polygon ? 0 : a.x;
	const a_y = a_polygon ? 0 : a.y;
	const a_radius = isCircle(a) ? a.radius * a.scale : 0;
	const a_min_x = a_polygon ? a._min_x : a_x - a_radius;
	const a_min_y = a_polygon ? a._min_y : a_y - a_radius;
	const a_max_x = a_polygon ? a._max_x : a_x + a_radius;
	const a_max_y = a_polygon ? a._max_y : a_y + a_radius;

	const b_polygon = isPolygon(b);
	const b_x = b_polygon ? 0 : b.x;
	const b_y = b_polygon ? 0 : b.y;
	const b_radius = isCircle(b) ? b.radius * b.scale : 0;
	const b_min_x = b_polygon ? b._min_x : b_x - b_radius;
	const b_min_y = b_polygon ? b._min_y : b_y - b_radius;
	const b_max_x = b_polygon ? b._max_x : b_x + b_radius;
	const b_max_y = b_polygon ? b._max_y : b_y + b_radius;

	return a_min_x < b_max_x && a_min_y < b_max_y && a_max_x > b_min_x && a_max_y > b_min_y;
}

/**
 * Determines if two polygons are colliding
 * 		a: The source polygon to test
 * 		b: The target polygon to test against
 * 		result: A Result object on which to store information about the collision
 */
function polygonPolygon(a: Polygon, b: Polygon, result: Result | null = null): boolean {
	const a_count = a._coords.length;
	const b_count = b._coords.length;

	// Handle points specially
	if (a_count === 2 && b_count === 2) {
		const a_coords = a._coords;
		const b_coords = b._coords;

		if (result) {
			result.overlap = 0;
		}

		return a_coords[0] === b_coords[0] && a_coords[1] === b_coords[1];
	}

	const a_coords = a._coords;
	const b_coords = b._coords;
	const a_normals = a._normals;
	const b_normals = b._normals;

	if (a_count > 2) {
		for (let ix = 0, iy = 1; ix < a_count; ix += 2, iy += 2) {
			if (separatingAxis(a_coords, b_coords, a_normals[ix], a_normals[iy], result)) {
				return false;
			}
		}
	}

	if (b_count > 2) {
		for (let ix = 0, iy = 1; ix < b_count; ix += 2, iy += 2) {
			if (separatingAxis(a_coords, b_coords, b_normals[ix], b_normals[iy], result)) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Determines if a polygon and a circle are colliding
 * 		a: The source polygon to test
 * 		b: The target circle to test against
 * 		result: A Result object on which to store information about the collision
 * 		reverse: Set to true to reverse a and b in the result parameter when testing circle->polygon instead of polygon->circle
 */
function polygonCircle(
	a: Polygon,
	b: Circle,
	result: Result | null = null,
	reverse = false,
): boolean {
	const a_coords = a._coords;
	const a_edges = a._edges;
	const a_normals = a._normals;
	const b_x = b.x;
	const b_y = b.y;
	const b_radius = b.radius * b.scale;
	const b_radius2 = b_radius * 2;
	const radius_squared = b_radius * b_radius;
	const count = a_coords.length;

	let a_in_b = true;
	let b_in_a = true;
	let overlap = 0;
	let overlap_x = 0;
	let overlap_y = 0;

	// Handle points specially
	if (count === 2) {
		const coord_x = b_x - a_coords[0];
		const coord_y = b_y - a_coords[1];
		const length_squared = coord_x * coord_x + coord_y * coord_y;

		if (length_squared > radius_squared) {
			return false;
		}

		if (result) {
			const length = Math.sqrt(length_squared);

			overlap = b_radius - length;
			if (length > 0) {
				overlap_x = coord_x / length;
				overlap_y = coord_y / length;
			} else {
				overlap_x = 1.0;
				overlap_y = 1.0;
			}

			b_in_a = false;
		}
	} else {
		for (let ix = 0, iy = 1; ix < count; ix += 2, iy += 2) {
			const coord_x = b_x - a_coords[ix];
			const coord_y = b_y - a_coords[iy];
			const edge_x = a_edges[ix];
			const edge_y = a_edges[iy];
			const dot = coord_x * edge_x + coord_y * edge_y;
			const region = dot < 0 ? -1 : dot > edge_x * edge_x + edge_y * edge_y ? 1 : 0;

			let tmp_overlapping = false;
			let tmp_overlap = 0;
			let tmp_overlap_x = 0;
			let tmp_overlap_y = 0;

			if (result && a_in_b && coord_x * coord_x + coord_y * coord_y > radius_squared) {
				a_in_b = false;
			}

			if (region) {
				const left = region === -1;
				const other_x = left ? (ix === 0 ? count - 2 : ix - 2) : ix === count - 2 ? 0 : ix + 2;
				const other_y = other_x + 1;
				const coord2_x = b_x - a_coords[other_x];
				const coord2_y = b_y - a_coords[other_y];
				const edge2_x = a_edges[other_x];
				const edge2_y = a_edges[other_y];
				const dot2 = coord2_x * edge2_x + coord2_y * edge2_y;
				const region2 = dot2 < 0 ? -1 : dot2 > edge2_x * edge2_x + edge2_y * edge2_y ? 1 : 0;

				if (region2 === -region) {
					const target_x = left ? coord_x : coord2_x;
					const target_y = left ? coord_y : coord2_y;
					const length_squared = target_x * target_x + target_y * target_y;

					if (length_squared > radius_squared) {
						return false;
					}

					if (result) {
						const length = Math.sqrt(length_squared);

						tmp_overlapping = true;
						tmp_overlap = b_radius - length;

						if (length > 0) {
							tmp_overlap_x = target_x / length;
							tmp_overlap_y = target_y / length;
						} else {
							tmp_overlap_x = 1.0;
							tmp_overlap_y = 1.0;
						}

						b_in_a = false;
					}
				}
			} else {
				const normal_x = a_normals[ix];
				const normal_y = a_normals[iy];
				const length = coord_x * normal_x + coord_y * normal_y;
				const absolute_length = length < 0 ? -length : length;

				if (length > 0 && absolute_length > b_radius) {
					return false;
				}

				if (result) {
					tmp_overlapping = true;
					tmp_overlap = b_radius - length;
					tmp_overlap_x = normal_x;
					tmp_overlap_y = normal_y;

					if ((b_in_a && length >= 0) || tmp_overlap < b_radius2) {
						b_in_a = false;
					}
				}
			}

			if (tmp_overlapping && (overlap === 0 || overlap > tmp_overlap)) {
				overlap = tmp_overlap;
				overlap_x = tmp_overlap_x;
				overlap_y = tmp_overlap_y;
			}
		}
	}

	if (result) {
		result.a_in_b = reverse ? b_in_a : a_in_b;
		result.b_in_a = reverse ? a_in_b : b_in_a;
		result.overlap = overlap;
		result.overlap_x = reverse ? -overlap_x : overlap_x;
		result.overlap_y = reverse ? -overlap_y : overlap_y;
	}

	return true;
}

/**
 * Determines if two circles are colliding
 * 		a: The source circle to test
 * 		b: The target circle to test against
 * 		result: A Result object on which to store information about the collision
 */
function circleCircle(a: Circle, b: Circle, result: Result | null = null): boolean {
	const a_radius = a.radius * a.scale;
	const b_radius = b.radius * b.scale;
	const difference_x = b.x - a.x;
	const difference_y = b.y - a.y;
	const radius_sum = a_radius + b_radius;
	const length_squared = difference_x * difference_x + difference_y * difference_y;

	if (length_squared > radius_sum * radius_sum) {
		return false;
	}

	if (result) {
		const length = Math.sqrt(length_squared);

		result.a_in_b = a_radius <= b_radius && length <= b_radius - a_radius;
		result.b_in_a = b_radius <= a_radius && length <= a_radius - b_radius;
		result.overlap = radius_sum - length;
		if (length > 0) {
			result.overlap_x = difference_x / length;
			result.overlap_y = difference_y / length;
		} else {
			result.overlap_x = 1.0;
			result.overlap_y = 1.0;
		}
	}

	return true;
}

/**
 * Determines if two polygons are separated by an axis
 * 		a_coords: The coordinates of the polygon to test
 * 		b_coords: The coordinates of the polygon to test against
 * 		x: The X direction of the axis
 * 		y: The Y direction of the axis
 * 		result: A Result object on which to store information about the collision
 */
function separatingAxis(
	a_coords: Float64Array,
	b_coords: Float64Array,
	x: number,
	y: number,
	result: Result | null = null,
): boolean {
	const a_count = a_coords.length;
	const b_count = b_coords.length;

	if (a_count === 0 || b_count === 0) {
		return true;
	}

	let a_start = Infinity;
	let a_end = -Infinity;
	let b_start = Infinity;
	let b_end = -Infinity;

	for (let ix = 0, iy = 1; ix < a_count; ix += 2, iy += 2) {
		const dot = a_coords[ix] * x + a_coords[iy] * y;

		if (a_start > dot) {
			a_start = dot;
		}

		if (a_end < dot) {
			a_end = dot;
		}
	}

	for (let ix = 0, iy = 1; ix < b_count; ix += 2, iy += 2) {
		const dot = b_coords[ix] * x + b_coords[iy] * y;

		if (b_start > dot) {
			b_start = dot;
		}

		if (b_end < dot) {
			b_end = dot;
		}
	}

	if (a_start > b_end || a_end < b_start) {
		return true;
	}

	if (result) {
		let overlap = 0;

		if (a_start < b_start) {
			result.a_in_b = false;

			if (a_end < b_end) {
				overlap = a_end - b_start;
				result.b_in_a = false;
			} else {
				const option1 = a_end - b_start;
				const option2 = b_end - a_start;

				overlap = option1 < option2 ? option1 : -option2;
			}
		} else {
			result.b_in_a = false;

			if (a_end > b_end) {
				overlap = a_start - b_end;
				result.a_in_b = false;
			} else {
				const option1 = a_end - b_start;
				const option2 = b_end - a_start;

				overlap = option1 < option2 ? option1 : -option2;
			}
		}

		const current_overlap = result.overlap;
		const absolute_overlap = overlap < 0 ? -overlap : overlap;

		if (current_overlap === 0 || current_overlap > absolute_overlap) {
			const sign = Math.sign(overlap);

			result.overlap = absolute_overlap;
			result.overlap_x = x * sign;
			result.overlap_y = y * sign;
		}
	}

	return false;
}
