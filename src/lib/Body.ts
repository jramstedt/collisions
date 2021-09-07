import type {BVH} from './BVH';
import type {BVHBranch} from './BVHBranch';

import {Result} from './Result';
import {SAT} from './SAT';

/**
 * The base class for bodies used to detect collisions
 */
export abstract class Body {
	x: number; // The X coordinate of the body
	y: number; // The Y coordinate of the body
	padding: number; // The amount to pad the bounding volume when testing for potential collisions

	readonly _circle: boolean = false;
	readonly _polygon: boolean = false;
	readonly _point: boolean = false;
	readonly _bvh_branch = false;

	_bvh: null | BVH = null;
	_bvh_parent: null | BVHBranch = null;
	_bvh_padding: number;
	_bvh_min_x = 0;
	_bvh_min_y = 0;
	_bvh_max_x = 0;
	_bvh_max_y = 0;

	/**
	 * x: The starting X coordinate
	 * y: The starting Y coordinate
	 * padding: The amount to pad the bounding volume when testing for potential collisions
	 */
	constructor(x = 0, y = 0, padding = 0) {
		this.x = x;
		this.y = y;
		this.padding = padding;
		this._bvh_padding = padding;
	}

	abstract draw(context: CanvasRenderingContext2D): void;

	/**
	 * Determines if the body is colliding with another body
	 * 		target: The target body to test against
	 * 		result: A `Result` object on which to store information about the collision
	 * 		aabb: Set to false to skip the AABB test (useful if you use your own potential collision heuristic)
	 */
	collides(target: Body, result: Result | null = null, aabb = true): boolean {
		return SAT(this, target, result, aabb);
	}

	/**
	 * Returns a list of potential collisions
	 */
	potentials(): Body[] {
		const bvh = this._bvh;

		if (bvh === null) {
			throw new Error('Body does not belong to a collision system');
		}

		return bvh.potentials(this);
	}

	/**
	 * Removes the body from its current collision system
	 */
	remove(): void {
		const bvh = this._bvh;

		if (bvh) {
			bvh.remove(this, false);
		}
	}

	/**
	 * Creates a `Result` used to collect the detailed results of a collision test
	 */
	createResult(): Result {
		return new Result();
	}

	/**
	 * Creates a `Result` used to collect the detailed results of a collision test
	 */
	static createResult(): Result {
		return new Result();
	}
}
