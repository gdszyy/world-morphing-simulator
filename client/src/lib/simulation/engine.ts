import { generatePerlinNoise } from './perlin';

// Types
export type CellType = 'EMPTY' | 'ALPHA' | 'BETA';

export interface Cell {
  x: number;
  y: number;
  
  // Mantle Layer
  exists: boolean;
  mantleEnergy: number;
  expansionPotential: number;
  expansionAccumulator: number;
  shrinkAccumulator: number;
  
  // Climate Layer
  temperature: number;
  baseTemperature: number;
  temperatureChange: number;
  hasThunderstorm: boolean;
  
  // Crystal Layer
  crystalState: CellType;
  crystalEnergy: number; // For visualization
}

export interface SimulationParams {
  // Mantle
  mantleTimeScale: number;
  expansionThreshold: number;
  shrinkThreshold: number;
  depletionRate: number;
  
  // Climate
  diffusionRate: number;
  advectionRate: number;
  thunderstormThreshold: number;
  seasonalAmplitude: number;
  
  // Crystal
  alphaEnergyDemand: number;
  betaEnergyDemand: number;
  mantleAbsorption: number;
  thunderstormEnergy: number;
  invasionThreshold: number;
  invasionEnergyFactor: number;
  harvestThreshold: number;
}

export const DEFAULT_PARAMS: SimulationParams = {
  // Mantle
  mantleTimeScale: 0.001,
  expansionThreshold: 100.0,
  shrinkThreshold: 80.0,
  depletionRate: 0.01,
  
  // Climate
  diffusionRate: 0.05,
  advectionRate: 0.02,
  thunderstormThreshold: 15.0,
  seasonalAmplitude: 5.0,
  
  // Crystal
  alphaEnergyDemand: 5.0,
  betaEnergyDemand: 2.0,
  mantleAbsorption: 0.1,
  thunderstormEnergy: 10.0,
  invasionThreshold: 2,
  invasionEnergyFactor: 1.5,
  harvestThreshold: 0.8,
};

export class SimulationEngine {
  width: number;
  height: number;
  grid: Cell[][];
  timeStep: number;
  cycleCount: number;
  params: SimulationParams;
  
  constructor(width: number, height: number, params: SimulationParams = DEFAULT_PARAMS) {
    this.width = width;
    this.height = height;
    this.params = params;
    this.timeStep = 0;
    this.cycleCount = 0;
    this.grid = this.initializeGrid();
  }
  
  initializeGrid(): Cell[][] {
    const grid: Cell[][] = [];
    for (let y = 0; y < this.height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.width; x++) {
        // Initial circular terrain
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxRadius = Math.min(this.width, this.height) * 0.4;
        
        const exists = dist < maxRadius;
        
        row.push({
          x, y,
          exists,
          mantleEnergy: exists ? 50 + Math.random() * 20 : 0,
          expansionPotential: 0,
          expansionAccumulator: 0,
          shrinkAccumulator: 0,
          temperature: 0,
          baseTemperature: 0,
          temperatureChange: 0,
          hasThunderstorm: false,
          crystalState: 'EMPTY',
          crystalEnergy: 0,
        });
      }
      grid.push(row);
    }
    return grid;
  }
  
  update() {
    this.timeStep++;
    if (this.timeStep % 1000 === 0) {
      this.cycleCount++;
    }
    
    this.updateMantleLayer();
    this.updateClimateLayer();
    this.updateCrystalLayer();
  }
  
  // --- Mantle Layer ---
  updateMantleLayer() {
    const { mantleTimeScale, expansionThreshold, shrinkThreshold, depletionRate } = this.params;
    
    // 1. Update Energy (Simulated Perlin Noise for now)
    const depletionFactor = Math.max(0, 1.0 - this.cycleCount * depletionRate);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) {
            cell.mantleEnergy = 0;
            continue;
        }
        
        // Simple noise simulation (replace with real Perlin later)
        const noise = Math.sin(x * 0.1 + this.timeStep * mantleTimeScale) * 
                      Math.cos(y * 0.1 + this.timeStep * mantleTimeScale);
        
        let energy = (noise + 1) * 50; // [0, 100]
        energy *= depletionFactor;
        cell.mantleEnergy = Math.max(0, Math.min(100, energy));
        
        // 2. Calculate Expansion Potential
        const neighbors = this.getNeighbors(x, y);
        const existingNeighbors = neighbors.filter(n => n.exists);
        const avgNeighborEnergy = existingNeighbors.length > 0 
          ? existingNeighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / existingNeighbors.length
          : 0;
          
        const basePotential = cell.mantleEnergy - 50.0;
        const neighborInfluence = (avgNeighborEnergy - 50.0) * 0.3;
        cell.expansionPotential = basePotential + neighborInfluence;
        
        // 3. Expand/Shrink Logic (Simplified)
        const isEdge = neighbors.some(n => !n.exists);
        
        if (isEdge) {
            if (cell.expansionPotential > 0) {
                cell.expansionAccumulator += cell.expansionPotential * 0.1;
                if (cell.expansionAccumulator > expansionThreshold) {
                    // Expand to a random empty neighbor
                    const emptyNeighbors = neighbors.filter(n => !n.exists);
                    if (emptyNeighbors.length > 0) {
                        const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                        target.exists = true;
                        target.mantleEnergy = cell.mantleEnergy * 0.8;
                        cell.expansionAccumulator = 0;
                    }
                }
            } else {
                cell.shrinkAccumulator += Math.abs(cell.expansionPotential) * 0.1;
                if (cell.shrinkAccumulator > shrinkThreshold) {
                    cell.exists = false;
                    cell.mantleEnergy = 0;
                    cell.crystalState = 'EMPTY';
                    cell.shrinkAccumulator = 0;
                }
            }
        }
      }
    }
  }
  
  // --- Climate Layer ---
  updateClimateLayer() {
    const { diffusionRate, advectionRate, thunderstormThreshold, seasonalAmplitude } = this.params;
    
    // 1. Base Temperature from Mantle + Season
    const timeCycle = (this.timeStep % 1000) / 1000.0;
    const seasonalOffset = seasonalAmplitude * Math.sin(2 * Math.PI * timeCycle);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) {
            cell.temperature = -50; // Void is cold
            cell.hasThunderstorm = false;
            continue;
        }
        
        cell.baseTemperature = (cell.mantleEnergy - 50.0) * 0.5 + seasonalOffset;
        
        // 2. Diffusion
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        if (neighbors.length > 0) {
            const avgTemp = neighbors.reduce((sum, n) => sum + n.temperature, 0) / neighbors.length;
            cell.temperatureChange = diffusionRate * (avgTemp - cell.temperature);
        }
        
        // 3. Crystal Cooling
        if (cell.crystalState === 'ALPHA') cell.temperatureChange -= 0.5;
        if (cell.crystalState === 'BETA') cell.temperatureChange -= 0.2;
        
        // Apply Change
        cell.temperature += cell.temperatureChange;
        // Pull towards base temperature (simple stability)
        cell.temperature += (cell.baseTemperature - cell.temperature) * 0.1; 
        
        // Clamp
        cell.temperature = Math.max(-50, Math.min(50, cell.temperature));
      }
    }
    
    // 4. Thunderstorm State (Post-update check)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        let maxDiff = 0;
        for (const n of neighbors) {
            maxDiff = Math.max(maxDiff, Math.abs(n.temperature - cell.temperature));
        }
        
        cell.hasThunderstorm = maxDiff > thunderstormThreshold;
      }
    }
  }
  
  // --- Crystal Layer ---
  updateCrystalLayer() {
    const { 
        alphaEnergyDemand, betaEnergyDemand, mantleAbsorption, thunderstormEnergy,
        invasionThreshold, invasionEnergyFactor 
    } = this.params;
    
    // Temporary grid for next state
    const nextStates: CellType[][] = this.grid.map(row => row.map(c => c.crystalState));
    
    // 1. Calculate Energy Input & Network Sharing (Simplified for MVP: Local + Neighbor Avg)
    // Full BFS network sharing is expensive for JS loop every frame, using localized approximation
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        // Energy Input
        let energyInput = 0;
        if (cell.crystalState === 'ALPHA') {
            energyInput = cell.mantleEnergy * mantleAbsorption;
            if (cell.hasThunderstorm) energyInput += thunderstormEnergy;
        }
        
        // Store for visualization
        cell.crystalEnergy = energyInput;
        
        // Rules
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');
        const betaNeighbors = neighbors.filter(n => n.crystalState === 'BETA');
        
        if (cell.crystalState === 'EMPTY') {
            // Rule 1: Invasion
            // Need neighbors with surplus energy (approximated by high mantle energy + thunderstorm)
            const strongNeighbors = alphaNeighbors.filter(n => n.mantleEnergy > 60 || n.hasThunderstorm);
            
            if (alphaNeighbors.length >= invasionThreshold && strongNeighbors.length > 0) {
                nextStates[y][x] = 'ALPHA';
            }
        } else if (cell.crystalState === 'ALPHA') {
            // Rule 2: Hardening (Starvation)
            // Simplified: If local input < demand (assuming network can't save it forever)
            // In full version, this would check network surplus
            if (energyInput < alphaEnergyDemand) {
                // Chance to survive if neighbors are rich
                const richNeighbors = alphaNeighbors.filter(n => n.crystalEnergy > alphaEnergyDemand * 1.5);
                if (richNeighbors.length < 2) {
                    nextStates[y][x] = 'BETA';
                }
            }
            
            // Rule 4: Isolation
            if (alphaNeighbors.length === 0 && betaNeighbors.length < 2) {
                nextStates[y][x] = 'EMPTY';
            }
        } else if (cell.crystalState === 'BETA') {
            // Rule 3: Irreversible (unless harvested - player interaction not in auto-sim)
            nextStates[y][x] = 'BETA';
        }
      }
    }
    
    // Apply Next States
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x].crystalState = nextStates[y][x];
      }
    }
  }
  
  getNeighbors(x: number, y: number): Cell[] {
    const neighbors: Cell[] = [];
    const dirs = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];
    
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        neighbors.push(this.grid[ny][nx]);
      }
    }
    return neighbors;
  }
  
  resize(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.timeStep = 0;
      this.cycleCount = 0;
      this.grid = this.initializeGrid();
  }
}
