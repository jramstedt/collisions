import {BVH} from './BVH';
import {Circle} from './Circle';
import {Point} from './Point';
import {Polygon} from './Polygon';
import {Result} from './Result';
import type {Body} from './Body';
import {SAT} from './SAT';

/**
 * A collision system used to track bodies in order to improve collision detection performance
 */
export class Collisions {
	_bvh: BVH;

	constructor() {
		this._bvh = new BVH();
	}

	/**
	 * Creates a `Circle` and inserts it into the collision system
	 * 		x: The starting X coordinate
	 * 		y: The starting Y coordinate
	 * 		radius
	 * 		scale
	 * 		padding: The amount to pad the bounding volume when testing for potential collisions
	 */
	createCircle(x = 0, y = 0, radius = 0, scale = 1, padding = 0): Circle {
		const body = new Circle(x, y, radius, scale, padding);

		this._bvh.insert(body);

		return body;
	}

	/**
	 * Creates a `Polygon` and inserts it into the collision system
	 * 		x: The starting X coordinate
	 * 		y: The starting Y coordinate
	 * 		points: An array of coordinate pairs making up the polygon - [[x1, y1], [x2, y2], ...]
	 * 		angle: The starting rotation in radians
	 * 		scale_x: The starting scale along the X axis
	 * 		scale_y: The starting scale long the Y axis
	 * 		padding: The amount to pad the bounding volume when testing for potential collisions
	 */
	createPolygon(
		x = 0,
		y = 0,
		points = [[0, 0]],
		angle = 0,
		scale_x = 1,
		scale_y = 1,
		padding = 0,
	): Polygon {
		const body = new Polygon(x, y, points, angle, scale_x, scale_y, padding);

		this._bvh.insert(body);

		return body;
	}

	/**
	 * Creates a `Point` and inserts it into the collision system
	 * 		x: The starting X coordinate
	 * 		y: The starting Y coordinate
	 * 		padding: The amount to pad the bounding volume when testing for potential collisions
	 */
	createPoint(x = 0, y = 0, padding = 0): Point {
		const body = new Point(x, y, padding);

		this._bvh.insert(body);

		return body;
	}

	/**
	 * Creates a `Result` used to collect the detailed results of a collision test
	 */
	createResult(): Result {
		return new Result();
	}

	/**
	 * Creates a Result used to collect the detailed results of a collision test
	 */
	static createResult(): Result {
		return new Result();
	}

	/**
	 * Inserts bodies into the collision system
	 */
	insert(...bodies: Body[]): Collisions {
		for (const body of bodies) {
			this._bvh.insert(body, false);
		}

		return this;
	}

	/**
	 * Removes bodies from the collision system
	 */
	remove(...bodies: Body[]): Collisions {
		for (const body of bodies) {
			this._bvh.remove(body, false);
		}

		return this;
	}

	/**
	* Attached already existing bodies into the collision system bvh tree
	*/
	attach(...bodies: Body[]): Collisions {
		for (const body of bodies) {
			this._bvh.insert(body, true);
		}

		return this;
	}

	/**
	 * Detach bodies from the collision system bvh tree
	 */
	detach(...bodies: Body[]): Collisions {
		for (const body of bodies) {
			this._bvh.remove(body, true);
		}

		return this;
	}

	/**
	 * Updates the collision system. This should be called before any collisions are tested.
	 */
	update(): Collisions {
		this._bvh.update();

		return this;
	}

	/**
	 * Draws the bodies within the system to a `CanvasRenderingContext2D`'s current path
	 * 		context: The context to draw to
	 */
	draw(context: CanvasRenderingContext2D): void {
		this._bvh.draw(context);
	}

	/**
	 * Draws the system's BVH to a `CanvasRenderingContext2D`'s current path.
	 * This is useful for testing out different padding values for bodies.
	 * 		context: The context to draw to
	 */
	drawBVH(context: CanvasRenderingContext2D): void {
		this._bvh.drawBVH(context);
	}

	/**
	 * Returns a list of potential collisions for a body
	 * 		body: The body to test for potential collisions against
	 */
	potentials(body: Body): Body[] {
		return this._bvh.potentials(body);
	}

	/**
	 * Determines if two bodies are colliding
	 * 		source: The source body
	 * 		target: The target body to test against
	 * 		result: A Result object on which to store information about the collision
	 * 		aabb: Set to false to skip the AABB test (useful if you use your own potential collision heuristic)
	 */
	collides(source: Body, target: Body, result: Result | null = null, aabb = true): boolean {
		return SAT(source, target, result, aabb);
	}
}
