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
  crystalEnergy: number; // 用于可视化
}

export interface SimulationParams {
  // 地幔层参数
  mantleTimeScale: number;
  expansionThreshold: number; // 地形扩张阈值
  shrinkThreshold: number;
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
  mantleAbsorption: number; // 吸收效率 (同时影响获得能量和地幔消耗)
  thunderstormEnergy: number;
  invasionThreshold: number;
  invasionEnergyFactor: number;
  harvestThreshold: number;
}

export const DEFAULT_PARAMS: SimulationParams = {
  // 地幔层
  mantleTimeScale: 0.002,
  expansionThreshold: 100.0,
  shrinkThreshold: 80.0,
  mantleEnergyLevel: 1.5, // 默认地幔能量充沛 (相对于晶石需求)
  maxRadius: 22.0,
  minRadius: 5.0,
  distortionSpeed: 0.01, // 缓慢扭曲
  
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
  
  // 噪声偏移量 (用于原地演化)
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
        // 初始圆形地形
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const initialRadius = Math.min(this.width, this.height) * 0.4;
        
        const exists = dist < initialRadius;
        
        // 初始晶石：在中心放置一些Alpha晶石
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
  
  // --- 地幔层更新 ---
  updateMantleLayer() {
    const { 
        mantleTimeScale, expansionThreshold, shrinkThreshold, 
        mantleEnergyLevel, maxRadius, minRadius, distortionSpeed 
    } = this.params;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // 1. 更新能量 (原地演化的扭曲噪声)
    // 使用 Domain Warping (域扭曲) 算法：f(p + f(p))
    // 这种算法会产生类似液体流动或大理石纹理的效果，但整体位置保持相对稳定
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) {
            cell.mantleEnergy = 0;
            continue;
        }
        
        // 基础坐标
        const nx = x * 0.1;
        const ny = y * 0.1;
        const time = this.timeStep * mantleTimeScale;
        
        // 第一层噪声：用于扭曲坐标
        const qx = Math.sin(nx + time);
        const qy = Math.cos(ny + time);
        
        // 第二层噪声：使用扭曲后的坐标采样
        // 加上 distortionSpeed 控制扭曲程度
        const noise = Math.sin(nx + qx * distortionSpeed + time) * 
                      Math.cos(ny + qy * distortionSpeed + time);
        
        // 映射到能量值 [0, 100] * EnergyLevel
        // 基础能量 50，波动幅度 50
        let energy = (noise * 0.5 + 0.5) * 100 * mantleEnergyLevel;
        
        // 保持当前能量与目标能量的平滑过渡 (惯性)
        cell.mantleEnergy += (energy - cell.mantleEnergy) * 0.1;
        cell.mantleEnergy = Math.max(0, cell.mantleEnergy); // 允许超过100
        
        // 2. 计算扩张势能
        const neighbors = this.getNeighbors(x, y);
        const existingNeighbors = neighbors.filter(n => n.exists);
        const avgNeighborEnergy = existingNeighbors.length > 0 
          ? existingNeighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / existingNeighbors.length
          : 0;
          
        const basePotential = cell.mantleEnergy - 50.0;
        const neighborInfluence = (avgNeighborEnergy - 50.0) * 0.3;
        cell.expansionPotential = basePotential + neighborInfluence;
        
        // 3. 扩张/缩减逻辑 (圆形约束)
        const isEdge = neighbors.some(n => !n.exists);
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (isEdge) {
            if (cell.expansionPotential > 0) {
                cell.expansionAccumulator += cell.expansionPotential * 0.1;
                if (cell.expansionAccumulator > expansionThreshold) {
                    // 扩张到随机空邻居，但受最大半径限制
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
                
                // 缩减逻辑：受最小半径限制
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
  
  // --- 气候层更新 ---
  updateClimateLayer() {
    const { diffusionRate, advectionRate, thunderstormThreshold, seasonalAmplitude } = this.params;
    
    // 1. 基础温度 (来自地幔 + 季节)
    const timeCycle = (this.timeStep % 1000) / 1000.0;
    const seasonalOffset = seasonalAmplitude * Math.sin(2 * Math.PI * timeCycle);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) {
            cell.temperature = -50; // 虚空极冷
            cell.hasThunderstorm = false;
            continue;
        }
        
        // 温度受地幔能量影响，但归一化到 [-25, 25] 范围
        // 假设标准地幔能量为 50 * EnergyLevel
        const normalizedEnergy = Math.min(100, cell.mantleEnergy); 
        cell.baseTemperature = (normalizedEnergy - 50.0) * 0.5 + seasonalOffset;
        
        // 2. 热扩散
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        if (neighbors.length > 0) {
            const avgTemp = neighbors.reduce((sum, n) => sum + n.temperature, 0) / neighbors.length;
            cell.temperatureChange = diffusionRate * (avgTemp - cell.temperature);
        }
        
        // 3. 晶石冷却效应
        if (cell.crystalState === 'ALPHA') cell.temperatureChange -= 0.5;
        if (cell.crystalState === 'BETA') cell.temperatureChange -= 0.2;
        
        // 应用变化
        cell.temperature += cell.temperatureChange;
        // 回归基础温度 (简单稳定性)
        cell.temperature += (cell.baseTemperature - cell.temperature) * 0.1; 
        
        // 限制范围
        cell.temperature = Math.max(-50, Math.min(50, cell.temperature));
      }
    }
    
    // 4. 雷暴状态 (后处理检查)
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
  
  // --- 晶石层更新 ---
  updateCrystalLayer() {
    const { 
        alphaEnergyDemand, betaEnergyDemand, mantleAbsorption, thunderstormEnergy,
        invasionThreshold, invasionEnergyFactor 
    } = this.params;
    
    // 临时网格存储下一状态
    const nextStates: CellType[][] = this.grid.map(row => row.map(c => c.crystalState));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        // 能量输入
        let energyInput = 0;
        if (cell.crystalState === 'ALPHA') {
            // 吸收地幔能量
            const absorbed = cell.mantleEnergy * mantleAbsorption;
            energyInput += absorbed;
            
            // 消耗地幔能量 (直接修改当前状态)
            cell.mantleEnergy = Math.max(0, cell.mantleEnergy - absorbed);
            
            if (cell.hasThunderstorm) energyInput += thunderstormEnergy;
        }
        
        // 存储用于可视化
        cell.crystalEnergy = energyInput;
        
        // 规则
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');
        const betaNeighbors = neighbors.filter(n => n.crystalState === 'BETA');
        
        if (cell.crystalState === 'EMPTY') {
            // 规则 1: 入侵
            // 需要邻居有剩余能量 (近似为高地幔能量 + 雷暴)
            const strongNeighbors = alphaNeighbors.filter(n => n.mantleEnergy > 60 || n.hasThunderstorm);
            
            if (alphaNeighbors.length >= invasionThreshold && strongNeighbors.length > 0) {
                nextStates[y][x] = 'ALPHA';
            }
        } else if (cell.crystalState === 'ALPHA') {
            // 规则 2: 硬化 (饥饿)
            if (energyInput < alphaEnergyDemand) {
                // 如果邻居富有，有机会存活
                const richNeighbors = alphaNeighbors.filter(n => n.crystalEnergy > alphaEnergyDemand * 1.5);
                if (richNeighbors.length < 2) {
                    nextStates[y][x] = 'BETA';
                }
            }
            
            // 规则 4: 孤立
            if (alphaNeighbors.length === 0 && betaNeighbors.length < 2) {
                nextStates[y][x] = 'EMPTY';
            }
        } else if (cell.crystalState === 'BETA') {
            // 规则 3: 不可逆
            nextStates[y][x] = 'BETA';
        }
      }
    }
    
    // 应用下一状态
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
