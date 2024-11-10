(function(root) {

	//---------------------------------------------------------------------
	// global functions
	//---------------------------------------------------------------------
	
	function update_RECOMPUTE() {
		for (const obj of this._globalObjects.values()) {
			const meta = obj.HSHG;
			const grid = meta.grid;
	
			const objAABB = obj.getAABB();
			const newObjHash = grid.toHash(objAABB.min[0], objAABB.min[1]);
	
			if (newObjHash !== meta.hash) {
				grid.removeObject(obj);
				grid.addObject(obj, newObjHash);
			}
		}
	}
	
	function testAABBOverlap(objA, objB) {
		const a = objA.getAABB(), b = objB.getAABB();
		return !(a.min[0] > b.max[0] || a.min[1] > b.max[1] || a.max[0] < b.min[0] || a.max[1] < b.min[1]);
	}
	
	function getLongestAABBEdge(min, max) {
		return Math.max(Math.abs(max[0] - min[0]), Math.abs(max[1] - min[1]));
	}
	
	//---------------------------------------------------------------------
	// entities
	//---------------------------------------------------------------------
	
	function HSHG() {
		this.MAX_OBJECT_CELL_DENSITY = 1 / 8;
		this.INITIAL_GRID_LENGTH = 256;
		this.HIERARCHY_FACTOR = 2;
		this.HIERARCHY_FACTOR_SQRT = Math.SQRT2;
		this.UPDATE_METHOD = update_RECOMPUTE;
	
		this._grids = [];
		this._globalObjects = new Map();
	}
	
	HSHG.prototype.addObject = function(obj) {
		const objAABB = obj.getAABB();
		const objSize = getLongestAABBEdge(objAABB.min, objAABB.max);
	
		obj.HSHG = { globalObjectsIndex: this._globalObjects.size };
		this._globalObjects.set(obj.HSHG.globalObjectsIndex, obj);
	
		if (this._grids.length === 0) {
			const cellSize = objSize * this.HIERARCHY_FACTOR_SQRT;
			const newGrid = new Grid(cellSize, this.INITIAL_GRID_LENGTH, this);
			newGrid.initCells();
			newGrid.addObject(obj);
			this._grids.push(newGrid);
		} else {
			let x;
			for (let i = 0; i < this._grids.length; i++) {
				const oneGrid = this._grids[i];
				x = oneGrid.cellSize;
				if (objSize < x) {
					while (objSize < (x /= this.HIERARCHY_FACTOR));
					const newGrid = new Grid(x * this.HIERARCHY_FACTOR, this.INITIAL_GRID_LENGTH, this);
					newGrid.initCells();
					newGrid.addObject(obj);
					this._grids.splice(i, 0, newGrid);
					return;
				}
			}
	
			while (objSize >= x) x *= this.HIERARCHY_FACTOR;
			const newGrid = new Grid(x, this.INITIAL_GRID_LENGTH, this);
			newGrid.initCells();
			newGrid.addObject(obj);
			this._grids.push(newGrid);
		}
	};
	
	HSHG.prototype.removeObject = function(obj) {
		const meta = obj.HSHG;
		this._globalObjects.delete(meta.globalObjectsIndex);
		meta.grid.removeObject(obj);
		delete obj.HSHG;
	};
	
	HSHG.prototype.update = function() {
		this.UPDATE_METHOD.call(this);
	};
	
	/*HSHG.prototype.queryForCollisionPairs = function(broadOverlapTestCallback) {
		const possibleCollisions = [];
		const broadOverlapTest = broadOverlapTestCallback || testAABBOverlap;
		const sapList = [];
	
		for (const grid of this._grids) {
			for (const cell of grid.occupiedCells) {
				const objects = cell.objectContainer;
				const objCount = objects.length;
	
				for (let i = 0; i < objCount; i++) {
					const objA = objects[i];
					for (let j = i + 1; j < objCount; j++) {
						const objB = objects[j];
						if (broadOverlapTest(objA, objB)) {
							possibleCollisions.push([objA, objB]);
						}
					}
				}
	
				for (const offset of cell.neighborOffsetArray) {
					const adjacentCell = grid.allCells[cell.allCellsIndex + offset];
					if (adjacentCell) {
						for (const objA of objects) {
							for (const objB of adjacentCell.objectContainer) {
								if (broadOverlapTest(objA, objB)) {
									possibleCollisions.push([objA, objB]);
								}
							}
						}
					}
				}
	
				sapList.push(...objects);
			}
		}
	
		return possibleCollisions.concat(sweepAndPrune(sapList));
	};
	
	function sweepAndPrune(objects) {
		const collisions = [];
		objects.sort((a, b) => a.getAABB().min[0] - b.getAABB().min[0]);
		const objCount = objects.length;
	
		for (let i = 0; i < objCount; i++) {
			const a = objects[i];
			const aMaxX = a.getAABB().max[0];
			for (let j = i + 1; j < objCount && objects[j].getAABB().min[0] < aMaxX; j++) {
				const b = objects[j];
				if (testAABBOverlap(a, b)) {
					collisions.push([a, b]);
				}
			}
		}
		return collisions;
	}*/

	HSHG.prototype.queryForCollisionPairs = function(broadOverlapTestCallback) {
		const possibleCollisions = [];
		const broadOverlapTest = broadOverlapTestCallback || testAABBOverlap;
		const sapList = [];
		const cachedPairs = new Set();
		
		for (const grid of this._grids) {
			for (const cell of grid.occupiedCells) {
				const objects = cell.objectContainer;
				const objCount = objects.length;
				
				for (let i = 0; i < objCount; i++) {
					const objA = objects[i];
					
					for (let j = i + 1; j < objCount; j++) {
						const objB = objects[j];
						const pairId = getPairId(objA, objB);
						
						if (!cachedPairs.has(pairId) && broadOverlapTest(objA, objB)) {
							possibleCollisions.push([objA, objB]);
							cachedPairs.add(pairId);
						}
					}
				}
				
				for (const offset of cell.neighborOffsetArray) {
					const adjacentCell = grid.allCells[cell.allCellsIndex + offset];
					if (adjacentCell) {
						for (const objA of objects) {
							for (const objB of adjacentCell.objectContainer) {
								const pairId = getPairId(objA, objB);
								if (!cachedPairs.has(pairId) && broadOverlapTest(objA, objB)) {
									possibleCollisions.push([objA, objB]);
									cachedPairs.add(pairId);
								}
							}
						}
					}
				}
				
				sapList.push(...objects);
			}
		}
		
		return possibleCollisions.concat(sweepAndPrune(sapList, cachedPairs));
	};
	
	function getPairId(objA, objB) {
		return objA.id < objB.id ? `${objA.id}-${objB.id}` : `${objB.id}-${objA.id}`;
	}
	
	function sweepAndPrune(objects, cachedPairs) {
		const collisions = [];
		objects.sort((a, b) => a.getAABB().min[0] - b.getAABB().min[0]);
	
		const objCount = objects.length;
		for (let i = 0; i < objCount; i++) {
			const a = objects[i];
			const aMaxX = a.getAABB().max[0];
	
			for (let j = i + 1; j < objCount && objects[j].getAABB().min[0] < aMaxX; j++) {
				const b = objects[j];
				const pairId = getPairId(a, b);

				if (!cachedPairs.has(pairId) && testAABBOverlap(a, b)) {
					collisions.push([a, b]);
					cachedPairs.add(pairId);
				}
			}
		}
	
		return collisions;
	}	
	
	function Grid(cellSize, cellCount, parentHierarchy) {
		this.cellSize = cellSize;
		this.inverseCellSize = 1 / cellSize;
		this.rowColumnCount = Math.sqrt(cellCount) | 0;
		this.xyHashMask = this.rowColumnCount - 1;
		this.occupiedCells = [];
		this.allCells = Array.from({ length: this.rowColumnCount ** 2 }, () => new Cell());
		this._parentHierarchy = parentHierarchy || null;
	}
	
	Grid.prototype.initCells = function() {
		const count = this.rowColumnCount;
		for (let i = 0; i < this.allCells.length; i++) {
			const cell = this.allCells[i];
			cell.allCellsIndex = i;
			const y = (i / count) | 0;
			const x = i % count;
			cell.neighborOffsetArray = [
				y > 0 ? -count : null,
				y < count - 1 ? count : null,
				x > 0 ? -1 : null,
				x < count - 1 ? 1 : null,
			].filter(Boolean);
		}
	};
	
	Grid.prototype.toHash = function(x, y) {
		const xHash = ((x * this.inverseCellSize) & this.xyHashMask) >>> 0;
		const yHash = ((y * this.inverseCellSize) & this.xyHashMask) >>> 0;
		return xHash + yHash * this.rowColumnCount;
	};
	
	Grid.prototype.addObject = function(obj, hash) {
		const objHash = hash || this.toHash(obj.getAABB().min[0], obj.getAABB().min[1]);
		const cell = this.allCells[objHash];
		if (cell.objectContainer.length === 0) this.occupiedCells.push(cell);
		cell.objectContainer.push(obj);
		obj.HSHG.grid = this;
		obj.HSHG.hash = objHash;
	};
	
	Grid.prototype.removeObject = function(obj) {
		const meta = obj.HSHG;
		const cell = this.allCells[meta.hash];
		const index = cell.objectContainer.indexOf(obj);
	
		if (index !== -1) cell.objectContainer.splice(index, 1);
		if (cell.objectContainer.length === 0) {
			const occupiedIndex = this.occupiedCells.indexOf(cell);
			if (occupiedIndex !== -1) this.occupiedCells.splice(occupiedIndex, 1);
		}
	};
	
	function Cell() {
		this.objectContainer = [];
		this.neighborOffsetArray = [];
		this.allCellsIndex = -1;
	}
	
	root.HSHG = HSHG;
	
	})(this);