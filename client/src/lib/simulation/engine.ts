import { generatePerlinNoise } from './perlin';

// 类型定义
export type CellType = 'EMPTY' | 'ALPHA' | 'BETA';

export interface Cell {
  x: number;
  y: number;
  
  // 地幔层
  exists: boolean;
  mantleEnergy: number;
  expansionPotential: number;
  expansionAccumulator: number;
  shrinkAccumulator: number;
  
  // 气候层
  temperature: number;
  baseTemperature: number;
  temperatureChange: number;
  hasThunderstorm: boolean;
  
  // 晶石层
  crystalState: CellType;
  crystalEnergy: number; // 当前帧获得的能量 (用于可视化)
  storedEnergy: number; // 累积能量 (用于扩张)
  isAbsorbing: boolean; // 是否正在吸收能量
}

export interface SimulationParams {
  // 地幔层参数
  mantleTimeScale: number;
  expansionThreshold: number; // 地形扩张阈值
  shrinkThreshold: number; // 地形缩减阈值
  mantleEnergyLevel: number; // 地幔能量等级 (倍率)
  maxRadius: number; // 最大半径限制 (硬限制)
  minRadius: number; // 最小半径限制 (硬限制)
  distortionSpeed: number; // 噪声扭曲速度
  
  // 气候层参数
  diffusionRate: number;
  advectionRate: number;
  thunderstormThreshold: number;
  seasonalAmplitude: number;
  
  // 晶石层参数
  alphaEnergyDemand: number;
  betaEnergyDemand: number;
  mantleAbsorption: number; // 吸收效率
  thunderstormEnergy: number;
  expansionCost: number; // 扩张所需能量
  maxCrystalEnergy: number; // 晶石能量上限
  harvestThreshold: number;
}

export const DEFAULT_PARAMS: SimulationParams = {
  // 地幔层
  mantleTimeScale: 0.002,
  expansionThreshold: 100.0,
  shrinkThreshold: 80.0,
  mantleEnergyLevel: 1.5,
  maxRadius: 22.0,
  minRadius: 5.0,
  distortionSpeed: 0.01,
  
  // 气候层
  diffusionRate: 0.05,
  advectionRate: 0.02,
  thunderstormThreshold: 15.0,
  seasonalAmplitude: 5.0,
  
  // 晶石层
  alphaEnergyDemand: 5.0,
  betaEnergyDemand: 2.0,
  mantleAbsorption: 0.1,
  thunderstormEnergy: 10.0,
  expansionCost: 20.0,
  maxCrystalEnergy: 50.0,
  harvestThreshold: 0.8,
};

export class SimulationEngine {
  width: number;
  height: number;
  grid: Cell[][];
  timeStep: number;
  cycleCount: number;
  params: SimulationParams;
  
  noiseOffsetX: number;
  noiseOffsetY: number;
  
  constructor(width: number, height: number, params: SimulationParams = DEFAULT_PARAMS) {
    this.width = width;
    this.height = height;
    this.params = params;
    this.timeStep = 0;
    this.cycleCount = 0;
    this.noiseOffsetX = Math.random() * 1000;
    this.noiseOffsetY = Math.random() * 1000;
    this.grid = this.initializeGrid();
  }
  
  initializeGrid(): Cell[][] {
    const grid: Cell[][] = [];
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    for (let y = 0; y < this.height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.width; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const initialRadius = Math.min(this.width, this.height) * 0.4;
        
        const exists = dist < initialRadius;
        
        let crystalState: CellType = 'EMPTY';
        if (exists && dist < 3) {
            crystalState = 'ALPHA';
        }
        
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
          crystalState,
          crystalEnergy: 0,
          storedEnergy: 10.0, // 初始能量
          isAbsorbing: false,
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
  
  updateMantleLayer() {
    const { 
        mantleTimeScale, expansionThreshold, shrinkThreshold, 
        mantleEnergyLevel, maxRadius, minRadius, distortionSpeed 
    } = this.params;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) {
            cell.mantleEnergy = 0;
            continue;
        }
        
        const nx = x * 0.1;
        const ny = y * 0.1;
        const time = this.timeStep * mantleTimeScale;
        
        const qx = Math.sin(nx + time);
        const qy = Math.cos(ny + time);
        
        const noise = Math.sin(nx + qx * distortionSpeed + time) * 
                      Math.cos(ny + qy * distortionSpeed + time);
        
        let energy = (noise * 0.5 + 0.5) * 100 * mantleEnergyLevel;
        
        cell.mantleEnergy += (energy - cell.mantleEnergy) * 0.1;
        cell.mantleEnergy = Math.max(0, cell.mantleEnergy);
        
        const neighbors = this.getNeighbors(x, y);
        const existingNeighbors = neighbors.filter(n => n.exists);
        const avgNeighborEnergy = existingNeighbors.length > 0 
          ? existingNeighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / existingNeighbors.length
          : 0;
          
        const basePotential = cell.mantleEnergy - 50.0;
        const neighborInfluence = (avgNeighborEnergy - 50.0) * 0.3;
        cell.expansionPotential = basePotential + neighborInfluence;
        
        const isEdge = neighbors.some(n => !n.exists);
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (isEdge) {
            if (cell.expansionPotential > 0) {
                cell.expansionAccumulator += cell.expansionPotential * 0.1;
                if (cell.expansionAccumulator > expansionThreshold) {
                    const emptyNeighbors = neighbors.filter(n => !n.exists);
                    if (emptyNeighbors.length > 0) {
                        const validTargets = emptyNeighbors.filter(n => {
                            const nDist = Math.sqrt((n.x - centerX) ** 2 + (n.y - centerY) ** 2);
                            return nDist <= maxRadius;
                        });
                        
                        if (validTargets.length > 0) {
                            const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                            target.exists = true;
                            target.mantleEnergy = cell.mantleEnergy * 0.8;
                            cell.expansionAccumulator = 0;
                        }
                    }
                }
            } else {
                cell.shrinkAccumulator += Math.abs(cell.expansionPotential) * 0.1;
                
                if (dist > minRadius && cell.shrinkAccumulator > shrinkThreshold) {
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
  
  updateClimateLayer() {
    const { diffusionRate, advectionRate, thunderstormThreshold, seasonalAmplitude } = this.params;
    
    const timeCycle = (this.timeStep % 1000) / 1000.0;
    const seasonalOffset = seasonalAmplitude * Math.sin(2 * Math.PI * timeCycle);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) {
            cell.temperature = -50;
            cell.hasThunderstorm = false;
            continue;
        }
        
        const normalizedEnergy = Math.min(100, cell.mantleEnergy); 
        cell.baseTemperature = (normalizedEnergy - 50.0) * 0.5 + seasonalOffset;
        
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        if (neighbors.length > 0) {
            const avgTemp = neighbors.reduce((sum, n) => sum + n.temperature, 0) / neighbors.length;
            cell.temperatureChange = diffusionRate * (avgTemp - cell.temperature);
        }
        
        if (cell.crystalState === 'ALPHA') cell.temperatureChange -= 0.5;
        if (cell.crystalState === 'BETA') cell.temperatureChange -= 0.2;
        
        cell.temperature += cell.temperatureChange;
        cell.temperature += (cell.baseTemperature - cell.temperature) * 0.1; 
        
        cell.temperature = Math.max(-50, Math.min(50, cell.temperature));
      }
    }
    
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
  
  updateCrystalLayer() {
    const { 
        alphaEnergyDemand, betaEnergyDemand, mantleAbsorption, thunderstormEnergy,
        expansionCost, maxCrystalEnergy 
    } = this.params;
    
    // 1. 能量获取与消耗 (直接更新当前状态)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists || cell.crystalState !== 'ALPHA') {
            cell.isAbsorbing = false;
            cell.crystalEnergy = 0;
            continue;
        }
        
        // 吸收能量
        let energyInput = 0;
        const absorbed = cell.mantleEnergy * mantleAbsorption;
        energyInput += absorbed;
        
        if (absorbed > 0.1) {
            cell.mantleEnergy = Math.max(0, cell.mantleEnergy - absorbed);
            cell.isAbsorbing = true;
        } else {
            cell.isAbsorbing = false;
        }
        
        if (cell.hasThunderstorm) energyInput += thunderstormEnergy;
        
        // 记录输入用于可视化
        cell.crystalEnergy = energyInput;
        
        // 能量结算
        const netEnergy = energyInput - alphaEnergyDemand;
        cell.storedEnergy += netEnergy;
        
        // 能量上限
        cell.storedEnergy = Math.min(cell.storedEnergy, maxCrystalEnergy);
      }
    }
    
    // 2. 状态转移 (基于 grid 计算 nextStates)
    const nextStates: CellType[][] = this.grid.map(row => row.map(c => c.crystalState));
    const nextStoredEnergy: number[][] = this.grid.map(row => row.map(c => c.storedEnergy));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');
        const betaNeighbors = neighbors.filter(n => n.crystalState === 'BETA');
        
        if (cell.crystalState === 'EMPTY') {
            // 规则 1: 扩张 (基于邻居能量)
            // 寻找能量充足的邻居
            const richNeighbors = alphaNeighbors.filter(n => n.storedEnergy >= expansionCost);
            
            if (richNeighbors.length > 0) {
                // 随机选择一个富裕邻居进行扩张
                const parent = richNeighbors[Math.floor(Math.random() * richNeighbors.length)];
                
                // 扣除父节点能量 (在 nextStoredEnergy 中扣除)
                // 注意：这里有并发问题，多个空地可能选择同一个父节点
                // 简单起见，我们允许透支，或者概率性扩张
                if (Math.random() < 0.3) { // 限制扩张速度
                    nextStates[y][x] = 'ALPHA';
                    nextStoredEnergy[y][x] = 5.0; // 新生晶石自带少量能量
                    
                    // 扣除父节点能量 (需要找到父节点在 nextStoredEnergy 中的位置)
                    nextStoredEnergy[parent.y][parent.x] -= expansionCost;
                }
            }
        } else if (cell.crystalState === 'ALPHA') {
            // 规则 2: 硬化 (能量耗尽)
            if (cell.storedEnergy <= 0) {
                nextStates[y][x] = 'BETA';
                nextStoredEnergy[y][x] = 0;
            }
            
            // 规则 3: 孤立死亡 (可选，防止孤点)
            if (alphaNeighbors.length === 0 && betaNeighbors.length < 2 && cell.storedEnergy < 5) {
                nextStates[y][x] = 'EMPTY';
                nextStoredEnergy[y][x] = 0;
            }
        } else if (cell.crystalState === 'BETA') {
            // 规则 4: 不可逆
            nextStates[y][x] = 'BETA';
        }
      }
    }
    
    // 应用下一状态
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x].crystalState = nextStates[y][x];
        this.grid[y][x].storedEnergy = nextStoredEnergy[y][x];
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
