import type {Body} from './Body';

import {BVHBranch, isBVHBranch} from './BVHBranch';
import { isCircle, isPolygon } from './checks';

/**
 * A Bounding Volume Hierarchy (BVH) used to find potential collisions quickly
 */
export class BVH {
	_hierarchy: BVHBranch | Body | null = null;
	_bodies: Body[] = [];
	_dirty_branches: BVHBranch[] = [];

	/**
	 * Inserts a body into the BVH
	 * 		body: The body to insert
	 * 		updating: Set to true if the body already exists in the BVH (used internally when updating the body's position)
	 */
	insert(body: Body, updating = false): void {
		if (!updating) {
			const bvh = body._bvh;

			if (bvh && bvh !== this) {
				throw new Error('Body belongs to another collision system');
			}

			body._bvh = this;
			this._bodies.push(body);
		}

		const polygon = isPolygon(body);
		const circle = isCircle(body);

		if (polygon) {
			if (
				body._dirty_coords ||
				body.x !== body._x ||
				body.y !== body._y ||
				body.angle !== body._angle ||
				body.scale_x !== body._scale_x ||
				body.scale_y !== body._scale_y
			) {
				body._calculateCoords();
			}
		}

		const padding = body._bvh_padding;
		const radius = circle ? body.radius * body.scale : 0
		const body_min_x = (polygon ? body._min_x : body.x - radius) - padding;
		const body_min_y = (polygon ? body._min_y : body.y - radius) - padding;
		const body_max_x = (polygon ? body._max_x : body.x + radius) + padding;
		const body_max_y = (polygon ? body._max_y : body.y + radius) + padding;

		body._bvh_min_x = body_min_x;
		body._bvh_min_y = body_min_y;
		body._bvh_max_x = body_max_x;
		body._bvh_max_y = body_max_y;

		let current = this._hierarchy;
		let sort = 0;

		if (current === null) {
			this._hierarchy = body;
		} else {
			while (current !== null) {
				if (isBVHBranch(current)) { // Branch
					if (current._bvh_left === null || current._bvh_right === null) break

					const left = current._bvh_left as Body | BVHBranch; // FIXME TypeScript bug
					const left_min_y = left._bvh_min_y;
					const left_max_x = left._bvh_max_x;
					const left_max_y = left._bvh_max_y;
					const left_new_min_x = body_min_x < left._bvh_min_x ? body_min_x : left._bvh_min_x;
					const left_new_min_y = body_min_y < left_min_y ? body_min_y : left_min_y;
					const left_new_max_x = body_max_x > left_max_x ? body_max_x : left_max_x;
					const left_new_max_y = body_max_y > left_max_y ? body_max_y : left_max_y;
					const left_volume = (left_max_x - left._bvh_min_x) * (left_max_y - left_min_y);
					const left_new_volume = (left_new_max_x - left_new_min_x) * (left_new_max_y - left_new_min_y);
					const left_difference = left_new_volume - left_volume;

					const right = current._bvh_right as Body | BVHBranch; // FIXME TypeScript bug
					const right_min_x = right._bvh_min_x;
					const right_min_y = right._bvh_min_y;
					const right_max_x = right._bvh_max_x;
					const right_max_y = right._bvh_max_y;
					const right_new_min_x = body_min_x < right_min_x ? body_min_x : right_min_x;
					const right_new_min_y = body_min_y < right_min_y ? body_min_y : right_min_y;
					const right_new_max_x = body_max_x > right_max_x ? body_max_x : right_max_x;
					const right_new_max_y = body_max_y > right_max_y ? body_max_y : right_max_y;
					const right_volume = (right_max_x - right_min_x) * (right_max_y - right_min_y);
					const right_new_volume = (right_new_max_x - right_new_min_x) * (right_new_max_y - right_new_min_y);
					const right_difference = right_new_volume - right_volume;

					current._bvh_sort = sort++;
					current._bvh_min_x = left_new_min_x < right_new_min_x ? left_new_min_x : right_new_min_x;
					current._bvh_min_y = left_new_min_y < right_new_min_y ? left_new_min_y : right_new_min_y;
					current._bvh_max_x = left_new_max_x > right_new_max_x ? left_new_max_x : right_new_max_x;
					current._bvh_max_y = left_new_max_y > right_new_max_y ? left_new_max_y : right_new_max_y;

					current = left_difference <= right_difference ? left : right;
				} else { // Leaf
					const grandparent = current._bvh_parent;
					const parent_min_x = current._bvh_min_x;
					const parent_min_y = current._bvh_min_y;
					const parent_max_x = current._bvh_max_x;
					const parent_max_y = current._bvh_max_y;
					const new_parent = (current._bvh_parent = body._bvh_parent = BVHBranch.getBranch());

					new_parent._bvh_parent = grandparent;
					new_parent._bvh_left = current;
					new_parent._bvh_right = body;
					new_parent._bvh_sort = sort++;
					new_parent._bvh_min_x = body_min_x < parent_min_x ? body_min_x : parent_min_x;
					new_parent._bvh_min_y = body_min_y < parent_min_y ? body_min_y : parent_min_y;
					new_parent._bvh_max_x = body_max_x > parent_max_x ? body_max_x : parent_max_x;
					new_parent._bvh_max_y = body_max_y > parent_max_y ? body_max_y : parent_max_y;

					if (!grandparent) {
						this._hierarchy = new_parent;
					} else if (grandparent._bvh_left === current) {
						grandparent._bvh_left = new_parent;
					} else {
						grandparent._bvh_right = new_parent;
					}

					break;
				}
			}
		}
	}

	/**
	 * Removes a body from the BVH
	 * 		body: The body to remove
	 * 		updating: Set to true if this is a temporary removal (used internally when updating the body's position)
	 */
	remove(body: Body, updating = false): void {
		if (!updating) {
			const bvh = body._bvh;

			if (bvh && bvh !== this) {
				throw new Error('Body belongs to another collision system');
			}

			body._bvh = null;
			this._bodies.splice(this._bodies.indexOf(body), 1);
		}

		if (this._hierarchy === body) {
			this._hierarchy = null;

			return;
		}

		const parent = body._bvh_parent;
		if (parent === null || parent._bvh_left === null || parent._bvh_right === null) return

		const grandparent = parent._bvh_parent;
		const parent_left = parent._bvh_left;
		const sibling = parent_left === body ? parent._bvh_right : parent_left;

		sibling._bvh_parent = grandparent;

		if (isBVHBranch(sibling)) {
			sibling._bvh_sort = parent._bvh_sort;
		}

		if (grandparent) {
			if (grandparent._bvh_left === parent) {
				grandparent._bvh_left = sibling;
			} else {
				grandparent._bvh_right = sibling;
			}

			let branch: BVHBranch | null = grandparent;

			while (branch !== null) {
				if (branch._bvh_left === null || branch._bvh_right === null) break

				const left = branch._bvh_left;
				const left_min_x = left._bvh_min_x;
				const left_min_y = left._bvh_min_y;
				const left_max_x = left._bvh_max_x;
				const left_max_y = left._bvh_max_y;

				const right = branch._bvh_right;
				const right_min_x = right._bvh_min_x;
				const right_min_y = right._bvh_min_y;
				const right_max_x = right._bvh_max_x;
				const right_max_y = right._bvh_max_y;

				branch._bvh_min_x = left_min_x < right_min_x ? left_min_x : right_min_x;
				branch._bvh_min_y = left_min_y < right_min_y ? left_min_y : right_min_y;
				branch._bvh_max_x = left_max_x > right_max_x ? left_max_x : right_max_x;
				branch._bvh_max_y = left_max_y > right_max_y ? left_max_y : right_max_y;

				branch = branch._bvh_parent;
			}
		} else {
			this._hierarchy = sibling;
		}

		BVHBranch.releaseBranch(parent);
	}

	/**
	 * Updates the BVH. Moved bodies are removed/inserted.
	 */
	update(): void {
		const bodies = this._bodies;
		const count = bodies.length;

		for (let i = 0; i < count; ++i) {
			let body = bodies[i];

			let update = false;

			if (!update && body.padding !== body._bvh_padding) {
				body._bvh_padding = body.padding;
				update = true;
			}

			if (!update) {
				if (isPolygon(body)) {
					if (
						body._dirty_coords ||
						body.x !== body._x ||
						body.y !== body._y ||
						body.angle !== body._angle ||
						body.scale_x !== body._scale_x ||
						body.scale_y !== body._scale_y
					) {
						body._calculateCoords();
					}
				}

				const x = body.x;
				const y = body.y;
				const radius = isCircle(body) ? body.radius * body.scale : 0
				const min_x = isPolygon(body) ? body._min_x : x - radius;
				const min_y = isPolygon(body) ? body._min_y : y - radius;
				const max_x = isPolygon(body) ? body._max_x : x + radius;
				const max_y = isPolygon(body) ? body._max_y : y + radius;

				update =
					min_x < body._bvh_min_x ||
					min_y < body._bvh_min_y ||
					max_x > body._bvh_max_x ||
					max_y > body._bvh_max_y;
			}

			if (update) {
				this.remove(body, true);
				this.insert(body, true);
			}
		}
	}

	/**
	 * Returns a list of potential collisions for a body
	 * 		body: The body to test
	 */
	potentials(body: Body): Body[] {
		const results: Body[] = [];
		const min_x = body._bvh_min_x;
		const min_y = body._bvh_min_y;
		const max_x = body._bvh_max_x;
		const max_y = body._bvh_max_y;

		let current = this._hierarchy;
		let traverse_left = true;

		if (!isBVHBranch(current)) {
			return results;
		}

		while (current !== null) {
			if (traverse_left) {
				traverse_left = false;

				let left: Body | BVHBranch | null = isBVHBranch(current) ? current._bvh_left : null;

				while (
					left &&
					left._bvh_max_x >= min_x &&
					left._bvh_max_y >= min_y &&
					left._bvh_min_x <= max_x &&
					left._bvh_min_y <= max_y
				) {
					current = left;
					left = isBVHBranch(current) ? current._bvh_left : null;
				}
			}
			
			const right: Body | BVHBranch | null = isBVHBranch(current) ? current._bvh_right : null;

			if (
				right &&
				right._bvh_max_x > min_x &&
				right._bvh_max_y > min_y &&
				right._bvh_min_x < max_x &&
				right._bvh_min_y < max_y
			) {
				current = right;
				traverse_left = true;
			} else {
				if (current === null) break;

				if (!isBVHBranch(current) && current !== body) {
					results.push(current);
				}

				let parent: BVHBranch | null = current._bvh_parent;

				if (parent) {
					while (parent && parent._bvh_right === current) {
						current = parent;
						parent = current._bvh_parent;
					}

					current = parent;
				} else {
					break;
				}
			}
		}

		return results;
	}

	/**
	 * Draws the bodies within the BVH to a CanvasRenderingContext2D's current path
	 * 		context: The context to draw to
	 */
	draw(context: CanvasRenderingContext2D): void {
		const bodies = this._bodies;
		const count = bodies.length;

		for (let i = 0; i < count; ++i) {
			bodies[i].draw(context);
		}
	}

	/**
	 * Draws the BVH to a CanvasRenderingContext2D's current path. This is useful for testing out different padding values for bodies.
	 * 		context: The context to draw to
	 */
	drawBVH(context: CanvasRenderingContext2D): void {
		let current = this._hierarchy;
		let traverse_left = true;

		while (current) {
			if (traverse_left) {
				traverse_left = false;

				let left = isBVHBranch(current) ? current._bvh_left : null;

				while (left) {
					current = left;
					left = isBVHBranch(current) ? current._bvh_left : null;
				}
			}

			const min_x = current._bvh_min_x;
			const min_y = current._bvh_min_y;
			const max_x = current._bvh_max_x;
			const max_y = current._bvh_max_y;
			const right = isBVHBranch(current) ? current._bvh_right : null;

			context.moveTo(min_x, min_y);
			context.lineTo(max_x, min_y);
			context.lineTo(max_x, max_y);
			context.lineTo(min_x, max_y);
			context.lineTo(min_x, min_y);

			if (right !== null) {
				current = right;
				traverse_left = true;
			} else {
				let parent = current._bvh_parent;

				if (parent !== null) {
					while (parent && parent._bvh_right === current) {
						current = parent;
						parent = current._bvh_parent;
					}

					current = parent;
				} else {
					break;
				}
			}
		}
	}
}
