import { generatePerlinNoise } from './perlin';

// 类型定义
export type CellType = 'EMPTY' | 'ALPHA' | 'BETA' | 'BIO';

export interface BioAttributes {
  minTemp: number;
  maxTemp: number;
  survivalMinTemp: number;
  survivalMaxTemp: number;
  prosperityGrowth: number;
  prosperityDecay: number;
  expansionThreshold: number;
  miningReward: number;
  migrationThreshold: number;
  alphaRadiationDamage: number;
  speciesId: number; // 种群ID
  color: string; // 种群颜色
}

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
  energyFlow: { x: number, y: number, amount: number }[]; // 能量流向记录 (目标x, 目标y, 数量)

  // 生物层 (通用)
  prosperity: number; // 繁荣度
  isMining: boolean; // 是否正在开采Beta晶石
  bioAttributes?: BioAttributes; // 生物属性
}

export interface SimulationParams {
  // 地幔层参数
  mantleTimeScale: number;
  expansionThreshold: number; // 地形扩张阈值
  shrinkThreshold: number; // 地形缩减阈值
  mantleEnergyLevel: number; // 地幔能量等级 (倍率)
  maxRadius: number; // 最大半径限制 (硬限制)
  minRadius: number; // 最小半径限制 (硬限制)
  distortionSpeed: number;
  edgeGenerationWidth: number;
  edgeGenerationEnergy: number; // 噪声扭曲速度
  edgeGenerationOffset: number; // 边缘生成偏移（从边缘第几层开始）
  edgeSupplyPointCount: number; // 边缘供给点数量
  edgeSupplyPointSpeed: number; // 边缘供给点迁移速度
  mantleHeatFactor: number; // 地幔热量系数 (影响地表温度)
  
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
  energySharingRate: number; // 能量共享率
  energySharingLimit: number; // 能量共享上限 (倍率)
  energyDecayRate: number; // 能量传输衰减率
  harvestThreshold: number;

  // 生物层通用参数
  extinctionBonus: number; // 灭绝时提供的能量/繁荣度
  competitionPenalty: number; // 种群竞争惩罚
  mutationRate: number; // 变异概率
  mutationStrength: number; // 变异强度 (0-1)
  newSpeciesThreshold: number; // 成为新物种的变异阈值 (0.2)
  minProsperityGrowth: number; // 非人类生物的最小繁荣度增长值
  sameSpeciesBonus: number; // 相同种群邻居提供的繁荣度加成
  
  // 人类初始参数 (作为默认生物模板)
  humanMinTemp: number;
  humanMaxTemp: number;
  humanSurvivalMinTemp: number;
  humanSurvivalMaxTemp: number;
  humanProsperityGrowth: number;
  humanProsperityDecay: number;
  humanExpansionThreshold: number;
  humanMiningReward: number;
  humanMigrationThreshold: number;
  alphaRadiationDamage: number;
  humanSpawnPoint?: {x: number, y: number};
  humanRespawnDelay: number; // 人类重生延迟 (步数)
  bioAutoSpawnCount: number; // 自动生成物种的触发数量阈值
  bioAutoSpawnInterval: number; // 自动生成物种的时间间隔
}

export const DEFAULT_PARAMS: SimulationParams = {
  // 地幔层
  mantleTimeScale: 0.002,
  expansionThreshold: 82,
  shrinkThreshold: 22,
  mantleEnergyLevel: 100,
  maxRadius: 15,
  minRadius: 10,
  distortionSpeed: 0.01,
  edgeGenerationWidth: 3,
  edgeGenerationEnergy: 19.5,
  edgeGenerationOffset: 1,
  edgeSupplyPointCount: 6,
  edgeSupplyPointSpeed: 0.05,
  mantleHeatFactor: 197,
  
  // 气候层
  diffusionRate: 0.2,
  advectionRate: 0.02,
  thunderstormThreshold: 39,
  seasonalAmplitude: 5.0,
  
  // 晶石层
  alphaEnergyDemand: 4.5,
  betaEnergyDemand: 2.0, // 保持默认，未在截图中找到
  mantleAbsorption: 0.1, // 保持默认
  thunderstormEnergy: 32,
  expansionCost: 8.5,
  maxCrystalEnergy: 50,
  energySharingRate: 1.45,
  energySharingLimit: 1.2, // 保持默认
  energyDecayRate: 0.09,
  harvestThreshold: 0.8,

  // 生物层通用
  extinctionBonus: 50,
  competitionPenalty: 5,
  mutationRate: 0.1,
  mutationStrength: 0.1,
  newSpeciesThreshold: 0.2,
  minProsperityGrowth: 5,
  sameSpeciesBonus: 0.5, // 默认值

  // 人类层 (默认生物)
  humanMinTemp: 7,
  humanMaxTemp: 34,
  humanSurvivalMinTemp: -50,
  humanSurvivalMaxTemp: 50,
  humanProsperityGrowth: 0.5,
  humanProsperityDecay: 1.4,
  humanExpansionThreshold: 80,
  humanMiningReward: 27,
  humanMigrationThreshold: 80,
  alphaRadiationDamage: 10,
  humanRespawnDelay: 20,
  bioAutoSpawnCount: 5,
  bioAutoSpawnInterval: 10,
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
  edgeSupplyPoints: { angle: number, speed: number }[];
  
  // 生物重生控制
  bioExtinctionStep: number | null = null;
  isFirstSpawn: boolean = true;
  
  constructor(width: number, height: number, params: SimulationParams = DEFAULT_PARAMS) {
    this.width = width;
    this.height = height;
    this.params = params;
    this.timeStep = 0;
    this.cycleCount = 0;
    this.noiseOffsetX = Math.random() * 1000;
    this.noiseOffsetY = Math.random() * 1000;
    this.edgeSupplyPoints = Array(params.edgeSupplyPointCount || 3).fill(0).map(() => ({
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() - 0.5) * (params.edgeSupplyPointSpeed || 0.05)
    }));
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
          storedEnergy: 10.0,
          isAbsorbing: false,
          energyFlow: [],
          prosperity: 0,
          isMining: false,
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
    this.updateBioLayer();
  }

  updateMantleLayer() {
    const { 
        mantleTimeScale, expansionThreshold, shrinkThreshold, 
        mantleEnergyLevel, maxRadius, minRadius, distortionSpeed,
        edgeGenerationWidth, edgeGenerationEnergy, edgeGenerationOffset
    } = this.params;
    
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // 更新噪声偏移
    this.noiseOffsetX += distortionSpeed;
    this.noiseOffsetY += distortionSpeed;
    
    // 更新供给点位置
    for (const point of this.edgeSupplyPoints) {
        point.angle += point.speed;
        if (point.angle > Math.PI * 2) point.angle -= Math.PI * 2;
        if (point.angle < 0) point.angle += Math.PI * 2;
    }

    // 第一步：计算能量变化
    const newEnergies = this.grid.map(row => row.map(c => c.mantleEnergy));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        // 1. 基础噪声能量源
        const noiseVal = generatePerlinNoise(x * 0.1 + this.noiseOffsetX, y * 0.1 + this.noiseOffsetY);
        const energyFluctuation = 1 + noiseVal * 0.1;
        
        // 2. 邻居平均 (扩散)
        const neighbors = this.getNeighbors(x, y);
        const avgEnergy = neighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / neighbors.length;
        
        // 3. 趋向稳定值
        const targetEnergy = mantleEnergyLevel * energyFluctuation;
        let newEnergy = cell.mantleEnergy * (1 - mantleTimeScale) + targetEnergy * mantleTimeScale;
        
        // 扩散混合
        if (!isNaN(avgEnergy)) {
            newEnergy = newEnergy * 0.9 + avgEnergy * 0.1;
        }
        
        // 防止 NaN 或 无限值
        if (isNaN(newEnergy) || !isFinite(newEnergy)) {
            newEnergy = mantleEnergyLevel;
        }
        
        // 4. 边缘能量生成
        // 计算到中心的距离
        const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // 检查是否在边缘生成范围内
        // 边缘定义为：距离中心最远的有效点附近
        // 这里简化为：如果邻居中有无效点，或者距离中心足够远
        const hasVoidNeighbor = neighbors.length < 8 || neighbors.some(n => !n.exists);
        
        // 只有在边缘区域才生成能量
        if (hasVoidNeighbor) {
            const angle = Math.atan2(y - centerY, x - centerX);
            let normalizedAngle = angle;
            if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
            
            // 计算供给点的影响
            let maxInfluence = 0;
            for (const point of this.edgeSupplyPoints) {
                let diff = Math.abs(normalizedAngle - point.angle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                
                // 供给点影响范围 (PI/4 = 45度)
                if (diff < Math.PI / 4) {
                    // 角度影响因子 (余弦衰减)
                    const angleInfluence = Math.cos(diff * 4); 
                    
                    // 距离影响因子 (基于edgeGenerationOffset和edgeGenerationWidth)
                    // 假设边缘是在当前半径附近
                    // 我们需要找到当前角度上的最大半径
                    // 这里简化处理：直接使用当前点是否为边缘点
                    
                    maxInfluence = Math.max(maxInfluence, angleInfluence);
                }
            }
            
            if (maxInfluence > 0) {
                newEnergy += edgeGenerationEnergy * maxInfluence;
            }
        }
        
        // 5. 晶石吸收 (仅Alpha晶石吸收地幔能量)
        if (cell.crystalState === 'ALPHA') {
            const absorption = newEnergy * this.params.mantleAbsorption;
            newEnergy -= absorption;
        }
        
        newEnergies[y][x] = newEnergy;
      }
    }
    
    // 应用能量更新
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].exists) {
            this.grid[y][x].mantleEnergy = newEnergies[y][x];
        }
      }
    }
    
    // 第二步：地形演变
    const terrainChanges: {x: number, y: number, action: 'expand' | 'shrink'}[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        if (cell.exists) {
            // 检查缩减
            // 只有当距离大于最小半径时才允许缩减
            if (dist > minRadius) {
                if (cell.mantleEnergy < shrinkThreshold) {
                    cell.shrinkAccumulator += (shrinkThreshold - cell.mantleEnergy);
                    // 增加缩减难度，避免连锁反应
                    if (cell.shrinkAccumulator > 200) {
                        terrainChanges.push({x, y, action: 'shrink'});
                        // 重置累加器，防止连续帧重复触发
                        cell.shrinkAccumulator = 0;
                    }
                } else {
                    cell.shrinkAccumulator = Math.max(0, cell.shrinkAccumulator - 2);
                }
            } else {
                // 最小半径内强制存在
                if (!cell.exists) {
                    terrainChanges.push({x, y, action: 'expand'});
                }
                cell.shrinkAccumulator = 0;
            }
            
            // 检查扩张
            if (cell.mantleEnergy > expansionThreshold && dist < maxRadius) {
                cell.expansionAccumulator += (cell.mantleEnergy - expansionThreshold);
                if (cell.expansionAccumulator > 100) {
                    // 寻找虚空邻居
                    const neighbors = this.getNeighbors(x, y, true);
                    const voidNeighbors = neighbors.filter(n => !n.exists);
                    
                    if (voidNeighbors.length > 0) {
                        const target = voidNeighbors[Math.floor(Math.random() * voidNeighbors.length)];
                        terrainChanges.push({x: target.x, y: target.y, action: 'expand'});
                        cell.mantleEnergy -= 20; 
                    }
                    cell.expansionAccumulator = 0;
                }
            } else {
                cell.expansionAccumulator = Math.max(0, cell.expansionAccumulator - 1);
            }
        }
      }
    }
    
    // 应用地形变化
    for (const change of terrainChanges) {
        const cell = this.grid[change.y][change.x];
        if (change.action === 'expand') {
            cell.exists = true;
            cell.mantleEnergy = 30;
        } else if (change.action === 'shrink') {
            cell.exists = false;
            cell.mantleEnergy = 0;
            cell.crystalState = 'EMPTY';
        }
    }
  }
  
  updateClimateLayer() {
    const { diffusionRate, advectionRate, thunderstormThreshold, mantleHeatFactor } = this.params;
    
    const newTemps = this.grid.map(row => row.map(c => c.temperature));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        // 扩散
        const neighbors = this.getNeighbors(x, y);
        const avgTemp = neighbors.reduce((sum, n) => sum + n.temperature, 0) / neighbors.length;
        let newTemp = cell.temperature * (1 - diffusionRate) + avgTemp * diffusionRate;
        
        // 地幔加热
        const targetTemp = -100 + (cell.mantleEnergy / 100) * mantleHeatFactor;
        newTemp = newTemp * 0.9 + targetTemp * 0.1;
        
        // 环境冷却
        newTemp -= 0.5;
        
        newTemps[y][x] = newTemp;
        
        // 雷暴判定
        const tempDiff = Math.abs(cell.temperature - avgTemp);
        if (tempDiff > thunderstormThreshold && Math.random() < 0.1) {
            cell.hasThunderstorm = true;
        } else {
            cell.hasThunderstorm = false;
        }
      }
    }
    
    // 应用温度更新
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].exists) {
            this.grid[y][x].temperature = newTemps[y][x];
        }
      }
    }
  }
  
  updateCrystalLayer() {
    const { 
        alphaEnergyDemand, betaEnergyDemand, mantleAbsorption, 
        thunderstormEnergy, expansionCost, maxCrystalEnergy,
        energySharingRate, energySharingLimit, energyDecayRate
    } = this.params;
    
    const crystalChanges: {x: number, y: number, type: CellType}[] = [];

    // 1. 能量获取与消耗
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists || cell.crystalState === 'EMPTY' || cell.crystalState === 'BIO') continue;
        
        cell.isAbsorbing = false;
        cell.crystalEnergy = 0;
        
        // 吸收地幔能量
        if (cell.mantleEnergy > 10) {
            const absorbed = cell.mantleEnergy * mantleAbsorption;
            cell.storedEnergy += absorbed;
            cell.crystalEnergy += absorbed;
            cell.isAbsorbing = true;
        }
        
        // 雷暴充能
        if (cell.hasThunderstorm) {
            cell.storedEnergy += thunderstormEnergy;
            cell.crystalEnergy += thunderstormEnergy;
        }
        
        // 维持消耗
        const demand = cell.crystalState === 'ALPHA' ? alphaEnergyDemand : betaEnergyDemand;
        cell.storedEnergy -= demand;
        
        // 能量上限
        if (cell.storedEnergy > maxCrystalEnergy) {
            cell.storedEnergy = maxCrystalEnergy;
        }
        
        // 能量枯竭
        if (cell.storedEnergy <= 0) {
            if (cell.crystalState === 'ALPHA') {
                cell.crystalState = 'BETA';
                cell.storedEnergy = 0;
            } 
            // Beta 晶石不会因为能量耗尽而消失，只能被生物开采
        }
      }
    }

    // 2. 能量共享 (ALPHA 晶石网络)
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            this.grid[y][x].energyFlow = [];
        }
    }

    const energyChanges = Array(this.height).fill(0).map(() => Array(this.width).fill(0));

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            if (cell.crystalState !== 'ALPHA') continue;

            const neighbors = this.getNeighbors(x, y);
            const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');

            for (const neighbor of alphaNeighbors) {
                if (cell.storedEnergy > neighbor.storedEnergy) {
                    const diff = cell.storedEnergy - neighbor.storedEnergy;
                    let transferAmount = diff * 0.1 * energySharingRate; 
                    
                    if (transferAmount > 5) transferAmount = 5;
                    
                    if (cell.storedEnergy - transferAmount < neighbor.storedEnergy + transferAmount) {
                        transferAmount = diff * 0.4;
                    }

                    if (transferAmount > 0.1) {
                        energyChanges[y][x] -= transferAmount;
                        const receivedAmount = transferAmount * (1 - energyDecayRate);
                        energyChanges[neighbor.y][neighbor.x] += receivedAmount;

                        cell.energyFlow.push({
                            x: neighbor.x,
                            y: neighbor.y,
                            amount: transferAmount
                        });
                    }
                }
            }
        }
    }

    // 应用能量共享
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            if (cell.crystalState === 'ALPHA') {
                cell.storedEnergy += energyChanges[y][x];
                if (cell.storedEnergy < 0) cell.storedEnergy = 0;
                if (cell.storedEnergy > maxCrystalEnergy) cell.storedEnergy = maxCrystalEnergy;
            }
        }
    }

    // 3. 晶石扩张
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (cell.crystalState === 'ALPHA' && cell.storedEnergy > expansionCost * 2) {
            const neighbors = this.getNeighbors(x, y);
            const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
            
            if (emptyNeighbors.length > 0) {
                const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                
                const dist = Math.sqrt((target.x - this.width/2)**2 + (target.y - this.height/2)**2);
                const betaChance = Math.min(0.8, Math.max(0, (dist - 5) / 15));
                
                const newType = Math.random() < betaChance ? 'BETA' : 'ALPHA';
                
                crystalChanges.push({x: target.x, y: target.y, type: newType});
                cell.storedEnergy -= expansionCost;
            }
        }
      }
    }
    
    // 应用扩张
    for (const change of crystalChanges) {
        const cell = this.grid[change.y][change.x];
        if (cell.crystalState === 'EMPTY') {
            cell.crystalState = change.type;
            cell.storedEnergy = 10;
        }
    }
  }

  updateBioLayer() {
    const {
        extinctionBonus, competitionPenalty, mutationRate, mutationStrength, newSpeciesThreshold
    } = this.params;

    // 1. 检查生物数量
    let bioCount = 0;
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            if (this.grid[y][x].crystalState === 'BIO') {
                bioCount++;
            }
        }
    }

    // 2. 处理生物生成/重生逻辑
    
    // 统计当前物种数量和人类是否存在
    const speciesSet = new Set<number>();
    let humanExists = false;
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            if (cell.crystalState === 'BIO' && cell.bioAttributes) {
                speciesSet.add(cell.bioAttributes.speciesId);
                if (cell.bioAttributes.speciesId === 0) {
                    humanExists = true;
                }
            }
        }
    }
    
    // 规则：物种数量少于阈值时，每隔一定步数尝试生成随机新物种
    const autoSpawnCount = this.params.bioAutoSpawnCount || 5;
    const autoSpawnInterval = this.params.bioAutoSpawnInterval || 10;
    if (speciesSet.size < autoSpawnCount && this.timeStep % autoSpawnInterval === 0) {
        this.spawnRandomSpecies();
    }

    // 人类重生逻辑：如果人类不存在，且满足重生条件，则重生人类
    if (!humanExists) {
        if (this.isFirstSpawn) {
            if (this.timeStep >= 50) {
                this.spawnHuman(100); // 初始生成人类(ID=0)
                this.isFirstSpawn = false;
            }
        } else {
            if (this.bioExtinctionStep === null) {
                this.bioExtinctionStep = this.timeStep;
            }
            
            // 使用参数化的重生延迟
            const respawnDelay = this.params.humanRespawnDelay || 20;
            if (this.timeStep - this.bioExtinctionStep >= respawnDelay) {
                this.spawnHuman(100);
                this.bioExtinctionStep = null;
            }
        }
    } else {
        this.bioExtinctionStep = null;
        this.isFirstSpawn = false;
    }

    // 3. 更新生物状态
    const changes: {x: number, y: number, type: 'PROSPERITY' | 'STATE' | 'MIGRATE' | 'MINING_STATE' | 'NEW_BIO', value?: any, toX?: number, toY?: number}[] = [];

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            if (cell.crystalState !== 'BIO' || !cell.bioAttributes) continue;

            const attrs = cell.bioAttributes;

            // A. 温度检查 (生存极限)
            if (cell.temperature < attrs.survivalMinTemp || cell.temperature > attrs.survivalMaxTemp) {
                changes.push({x, y, type: 'STATE', value: 0}); // 死亡
                // 灭绝奖励
                this.distributeExtinctionBonus(x, y, extinctionBonus);
                continue;
            }

            // B. 繁荣度更新
            let prosperityChange = 0;
            if (cell.temperature >= attrs.minTemp && cell.temperature <= attrs.maxTemp) {
                let growth = attrs.prosperityGrowth;
                // 规则：非人类生物(ID!=0)的繁荣度增长必须 >= minProsperityGrowth
                if (attrs.speciesId !== 0) {
                    growth = Math.max(growth, this.params.minProsperityGrowth);
                }
                prosperityChange += growth;
            } else {
                prosperityChange -= attrs.prosperityDecay;
            }

            // 邻居影响
            const neighbors = this.getNeighbors(x, y);
            const bioNeighbors = neighbors.filter(n => n.crystalState === 'BIO' && n.bioAttributes);
            
            // 同种群加成，异种群惩罚
            for (const n of bioNeighbors) {
                if (n.bioAttributes!.speciesId === attrs.speciesId) {
                    prosperityChange += this.params.sameSpeciesBonus;
                } else {
                    // 竞争：繁荣度低的一方受到惩罚
                    if (cell.prosperity < n.prosperity) {
                        prosperityChange -= competitionPenalty;
                    }
                }
            }

            // Alpha 辐射伤害 (永远大于增长)
            const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');
            if (alphaNeighbors.length > 0) {
                // 确保伤害大于最大可能的自然增长
                const damage = Math.max(attrs.prosperityGrowth + 0.2, this.params.alphaRadiationDamage);
                prosperityChange -= alphaNeighbors.length * damage;
            }

            // C. 采矿
            const betaNeighbors = neighbors.filter(n => n.crystalState === 'BETA');
            let isMining = false;
            if (betaNeighbors.length > 0) {
                const target = betaNeighbors[Math.floor(Math.random() * betaNeighbors.length)];
                changes.push({x: target.x, y: target.y, type: 'STATE', value: 0});
                prosperityChange += attrs.miningReward;
                isMining = true;
            }
            
            changes.push({x, y, type: 'MINING_STATE', value: isMining ? 1 : 0});

            // 应用繁荣度变化
            const newProsperity = cell.prosperity + prosperityChange;
            changes.push({x, y, type: 'PROSPERITY', value: newProsperity});

            // D. 死亡判定 (繁荣度 <= 0)
            if (newProsperity <= 0) {
                changes.push({x, y, type: 'STATE', value: 0});
                this.distributeExtinctionBonus(x, y, extinctionBonus);
                continue;
            }

            // E. 扩张与变异
            if (newProsperity > attrs.expansionThreshold) {
                const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
                if (emptyNeighbors.length > 0) {
                    const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                    
                    // 变异逻辑
                    let newAttrs = {...attrs};
                    let isNewSpecies = false;
                    
                    // 随机变异属性
                    const keys: (keyof BioAttributes)[] = ['minTemp', 'maxTemp', 'prosperityGrowth', 'prosperityDecay', 'expansionThreshold', 'miningReward', 'migrationThreshold'];
                    
                    for (const key of keys) {
                        if (Math.random() < mutationRate) {
                            const val = newAttrs[key] as number;
                            const change = val * mutationStrength * (Math.random() > 0.5 ? 1 : -1);
                            (newAttrs[key] as number) += change;
                            
                            // 检查是否成为新物种
                            if (Math.abs(change) > Math.abs(val) * newSpeciesThreshold) {
                                isNewSpecies = true;
                            }
                        }
                    }
                    
                    if (isNewSpecies) {
                        newAttrs.speciesId = Math.floor(Math.random() * 100000);
                        newAttrs.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                    }
                    
                    changes.push({
                        x: target.x, 
                        y: target.y, 
                        type: 'NEW_BIO', 
                        value: { prosperity: 30, attrs: newAttrs }
                    });
                    
                    changes.push({x, y, type: 'PROSPERITY', value: newProsperity - 30});
                }
            }
            
            // F. 迁移
            if (newProsperity < attrs.migrationThreshold) {
                const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
                if (emptyNeighbors.length > 0) {
                    // 寻找温度最适宜的邻居
                    let bestTarget = emptyNeighbors[0];
                    let minTempDiff = Math.abs(bestTarget.temperature - (attrs.minTemp + attrs.maxTemp)/2);
                    
                    for (const n of emptyNeighbors) {
                        const diff = Math.abs(n.temperature - (attrs.minTemp + attrs.maxTemp)/2);
                        if (diff < minTempDiff) {
                            minTempDiff = diff;
                            bestTarget = n;
                        }
                    }
                    
                    changes.push({x: bestTarget.x, y: bestTarget.y, type: 'MIGRATE', value: {prosperity: newProsperity, attrs}, toX: x, toY: y});
                    changes.push({x, y, type: 'STATE', value: 0});
                }
            }
        }
    }

    // 应用生物层变化
    for (const change of changes) {
        const cell = this.grid[change.y][change.x];
        
        if (change.type === 'STATE') {
            if (change.value === 0) {
                cell.crystalState = 'EMPTY';
                cell.prosperity = 0;
                cell.bioAttributes = undefined;
            }
        } else if (change.type === 'PROSPERITY') {
            cell.prosperity = change.value;
        } else if (change.type === 'MINING_STATE') {
            cell.isMining = change.value === 1;
        } else if (change.type === 'NEW_BIO') {
            if (cell.crystalState === 'EMPTY') {
                cell.crystalState = 'BIO';
                cell.prosperity = change.value.prosperity;
                cell.bioAttributes = change.value.attrs;
            }
        } else if (change.type === 'MIGRATE') {
            if (cell.crystalState === 'EMPTY') {
                cell.crystalState = 'BIO';
                cell.prosperity = change.value.prosperity;
                cell.bioAttributes = change.value.attrs;
            }
        }
    }
  }

  distributeExtinctionBonus(x: number, y: number, bonus: number) {
      const neighbors = this.getNeighbors(x, y);
      for (const n of neighbors) {
          if (n.crystalState === 'ALPHA' || n.crystalState === 'BETA') {
              n.storedEnergy += bonus;
          } else if (n.crystalState === 'BIO') {
              n.prosperity += bonus;
          }
      }
  }

  spawnBio(prosperity: number) {
    const { humanSpawnPoint } = this.params;
    let targetX = -1, targetY = -1;

    if (humanSpawnPoint) {
        targetX = humanSpawnPoint.x;
        targetY = humanSpawnPoint.y;
    } else {
        // 寻找适宜区域
        const candidates: Cell[] = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (cell.exists && cell.crystalState === 'EMPTY') {
                    const temp = cell.temperature;
                    if (temp >= this.params.humanMinTemp && temp <= this.params.humanMaxTemp) {
                        candidates.push(cell);
                    }
                }
            }
        }
        
        if (candidates.length > 0) {
            const target = candidates[Math.floor(Math.random() * candidates.length)];
            targetX = target.x;
            targetY = target.y;
        }
    }

    // 如果有指定生成点，强制生成（覆盖原有物体）
    // 如果是随机寻找的点，则必须是EMPTY
    let canSpawn = false;
    if (humanSpawnPoint && targetX === humanSpawnPoint.x && targetY === humanSpawnPoint.y) {
        canSpawn = true;
    } else if (targetX !== -1 && this.grid[targetY][targetX].crystalState === 'EMPTY') {
        canSpawn = true;
    }

    if (canSpawn && targetX !== -1) {
        const cell = this.grid[targetY][targetX];
        // 强制覆盖：清除原有状态
        cell.crystalState = 'BIO';
        cell.prosperity = prosperity;
        cell.storedEnergy = 0; // 清除可能存在的晶石能量
        cell.isMining = false;
        
        // 初始生物为人类
        cell.bioAttributes = {
            minTemp: this.params.humanMinTemp,
            maxTemp: this.params.humanMaxTemp,
            survivalMinTemp: this.params.humanSurvivalMinTemp,
            survivalMaxTemp: this.params.humanSurvivalMaxTemp,
            prosperityGrowth: this.params.humanProsperityGrowth,
            prosperityDecay: this.params.humanProsperityDecay,
            expansionThreshold: this.params.humanExpansionThreshold,
            miningReward: this.params.humanMiningReward,
            migrationThreshold: this.params.humanMigrationThreshold,
            alphaRadiationDamage: this.params.alphaRadiationDamage,
            speciesId: 0, // 0 代表人类
            color: '#FFA500' // 橙色
        };
    }
  }
  
  spawnHuman(prosperity: number) {
      this.spawnBio(prosperity);
  }

  spawnRandomSpecies() {
      // 寻找符合条件的随机位置：
      // 1. 是空地
      // 2. 附近3格内没有Alpha晶石
      // 3. 温度适宜（可选，为了存活率）
      
      const candidates: Cell[] = [];
      const safeDistance = 3;
      
      for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
              const cell = this.grid[y][x];
              if (!cell.exists || cell.crystalState !== 'EMPTY') continue;
              
              // 检查附近3格内是否有Alpha晶石
              let isSafe = true;
              for (let dy = -safeDistance; dy <= safeDistance; dy++) {
                  for (let dx = -safeDistance; dx <= safeDistance; dx++) {
                      const nx = x + dx;
                      const ny = y + dy;
                      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                          if (this.grid[ny][nx].crystalState === 'ALPHA') {
                              isSafe = false;
                              break;
                          }
                      }
                  }
                  if (!isSafe) break;
              }
              
              if (isSafe) {
                  candidates.push(cell);
              }
          }
      }
      
      if (candidates.length > 0) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          
          // 生成随机属性的新物种
          const speciesId = Math.floor(Math.random() * 100000) + 1; // +1 避免与人类(0)冲突
          const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
          
          // 基于人类参数进行大幅随机变异
          const baseAttrs = {
            minTemp: this.params.humanMinTemp,
            maxTemp: this.params.humanMaxTemp,
            survivalMinTemp: this.params.humanSurvivalMinTemp,
            survivalMaxTemp: this.params.humanSurvivalMaxTemp,
            prosperityGrowth: this.params.humanProsperityGrowth,
            prosperityDecay: this.params.humanProsperityDecay,
            expansionThreshold: this.params.humanExpansionThreshold,
            miningReward: this.params.humanMiningReward,
            migrationThreshold: this.params.humanMigrationThreshold,
            alphaRadiationDamage: this.params.alphaRadiationDamage,
          };
          
          // 随机波动 +/- 50%
          const randomize = (val: number) => val * (0.5 + Math.random());
          
          target.crystalState = 'BIO';
          target.prosperity = 50; // 初始繁荣度
          target.bioAttributes = {
              minTemp: baseAttrs.minTemp + (Math.random() - 0.5) * 20,
              maxTemp: baseAttrs.maxTemp + (Math.random() - 0.5) * 20,
              survivalMinTemp: baseAttrs.survivalMinTemp, // 保持极限生存范围不变，避免秒死
              survivalMaxTemp: baseAttrs.survivalMaxTemp,
              prosperityGrowth: randomize(baseAttrs.prosperityGrowth),
              prosperityDecay: randomize(baseAttrs.prosperityDecay),
              expansionThreshold: randomize(baseAttrs.expansionThreshold),
              miningReward: randomize(baseAttrs.miningReward),
              migrationThreshold: randomize(baseAttrs.migrationThreshold),
              alphaRadiationDamage: baseAttrs.alphaRadiationDamage,
              speciesId,
              color
          };
      }
  }

  getNeighbors(x: number, y: number, includeVoid: boolean = false): Cell[] {
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
        const cell = this.grid[ny][nx];
        if (includeVoid || cell.exists) {
          neighbors.push(cell);
        }
      }
    }
    
    return neighbors;
  }
}
