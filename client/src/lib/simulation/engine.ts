import { generatePerlinNoise } from './perlin';

// 类型定义
export type CellType = 'EMPTY' | 'ALPHA' | 'BETA' | 'HUMAN';

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

  // 人类层
  prosperity: number; // 繁荣度
  isMining: boolean; // 是否正在开采Beta晶石
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

  // 人类层参数
  humanMinTemp: number; // 适宜温度下限
  humanMaxTemp: number; // 适宜温度上限
  humanSurvivalMinTemp: number; // 生存温度下限 (低于此值死亡)
  humanSurvivalMaxTemp: number; // 生存温度上限 (高于此值死亡)
  humanProsperityGrowth: number; // 适宜温度下的繁荣度增长
  humanProsperityDecay: number; // 不适宜温度下的繁荣度衰减
  humanExpansionThreshold: number; // 扩张所需的繁荣度阈值
  humanMiningReward: number; // 消除Beta晶石获得的繁荣度
  humanMigrationThreshold: number; // 低于此繁荣度开始迁移
  humanDeathThreshold: number; // 繁荣度低于此值时消灭聚落
  alphaRadiationDamage: number; // Alpha晶石辐射伤害 (每帧减少繁荣度)
  humanSpawnPoint?: {x: number, y: number}; // 人类重生点
}

export const DEFAULT_PARAMS: SimulationParams = {
  // 地幔层
  mantleTimeScale: 0.002,
  expansionThreshold: 123,
  shrinkThreshold: 2,
  mantleEnergyLevel: 100,
  maxRadius: 25,
  minRadius: 5,
  distortionSpeed: 0.01,
  edgeGenerationWidth: 2,
  edgeGenerationEnergy: 4,
  edgeGenerationOffset: 1,
  edgeSupplyPointCount: 3,
  edgeSupplyPointSpeed: 0.05,
  mantleHeatFactor: 0.1,
  
  // 气候层
  diffusionRate: 0.12,
  advectionRate: 0.02,
  thunderstormThreshold: 18,
  seasonalAmplitude: 5.0,
  
  // 晶石层
  alphaEnergyDemand: 1.5,
  betaEnergyDemand: 2.0,
  mantleAbsorption: 0.1,
  thunderstormEnergy: 10.0,
  expansionCost: 8,
  maxCrystalEnergy: 80,
  energySharingRate: 1.2,
  energySharingLimit: 1.2,
  energyDecayRate: 0.05,
  harvestThreshold: 0.8,

  // 人类层
  humanMinTemp: 15,
  humanMaxTemp: 25,
  humanSurvivalMinTemp: -50,
  humanSurvivalMaxTemp: 50,
  humanProsperityGrowth: 0.5,
  humanProsperityDecay: 1.0,
  humanExpansionThreshold: 80,
  humanMiningReward: 20,
  humanMigrationThreshold: 40,
  humanDeathThreshold: 10,
  alphaRadiationDamage: 2.0,
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
  
  // 人类重生控制
  humanExtinctionStep: number | null = null; // 记录人类灭绝的时间步
  isFirstSpawn: boolean = true; // 是否是第一次生成
  
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
    this.updateHumanLayer();
  }

  updateHumanLayer() {
    const {
        humanMinTemp, humanMaxTemp, humanSurvivalMinTemp, humanSurvivalMaxTemp,
        humanProsperityGrowth, humanProsperityDecay, humanExpansionThreshold,
        humanMiningReward, humanMigrationThreshold, humanDeathThreshold
    } = this.params;

    // 1. 检查人类数量
    let humanCount = 0;
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            if (this.grid[y][x].crystalState === 'HUMAN') {
                humanCount++;
            }
        }
    }

    // 2. 处理人类生成/重生逻辑
    if (humanCount === 0) {
        // 如果是第一次运行，且步数达到50，生成初始人类
        if (this.isFirstSpawn) {
            if (this.timeStep >= 50) {
                this.spawnHuman(100); // 初始生成繁荣度为100
                this.isFirstSpawn = false;
            }
        } 
        // 如果不是第一次（灭绝后重生），记录灭绝时间
        else {
            if (this.humanExtinctionStep === null) {
                this.humanExtinctionStep = this.timeStep;
            }
            
            // 灭绝后经过20个迭代重生
            if (this.timeStep - this.humanExtinctionStep >= 20) {
                this.spawnHuman(100); // 重生繁荣度为100
                this.humanExtinctionStep = null;
            }
        }
        
        // 如果本帧进行了生成（或等待生成），则不进行后续更新
        if (humanCount === 0) return; 
    } else {
        // 如果有人类存在，重置灭绝计时器
        this.humanExtinctionStep = null;
        // 确保 isFirstSpawn 被标记为 false (防止手动放置人类后逻辑错误)
        if (humanCount > 0) this.isFirstSpawn = false;
    }

    // 3. 更新人类状态
    const changes: {x: number, y: number, type: 'PROSPERITY' | 'STATE' | 'MIGRATE' | 'MINING_STATE', value?: number, toX?: number, toY?: number}[] = [];

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            if (cell.crystalState !== 'HUMAN') continue;

            // A. 温度检查 (生存极限)
            if (cell.temperature < humanSurvivalMinTemp || cell.temperature > humanSurvivalMaxTemp) {
                changes.push({x, y, type: 'STATE', value: 0}); // 0 for EMPTY
                continue;
            }

            // B. 繁荣度更新
            let prosperityChange = 0;
            if (cell.temperature >= humanMinTemp && cell.temperature <= humanMaxTemp) {
                prosperityChange += humanProsperityGrowth;
            } else {
                prosperityChange -= humanProsperityDecay;
            }

            // 邻居加成
            const neighbors = this.getNeighbors(x, y);
            const humanNeighbors = neighbors.filter(n => n.crystalState === 'HUMAN');
            prosperityChange += humanNeighbors.length * 0.1;

            // Alpha 辐射伤害
            const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');
            if (alphaNeighbors.length > 0) {
                prosperityChange -= alphaNeighbors.length * this.params.alphaRadiationDamage;
            }

            // C. 采矿 (消除相邻 Beta 晶石)
            const betaNeighbors = neighbors.filter(n => n.crystalState === 'BETA');
            let isMining = false;
            if (betaNeighbors.length > 0) {
                const target = betaNeighbors[Math.floor(Math.random() * betaNeighbors.length)];
                changes.push({x: target.x, y: target.y, type: 'STATE', value: 0}); // 变为 EMPTY
                prosperityChange += humanMiningReward;
                isMining = true;
            }
            
            changes.push({x, y, type: 'MINING_STATE', value: isMining ? 1 : 0});

            // 应用繁荣度变化
            const newProsperity = cell.prosperity + prosperityChange;
            changes.push({x, y, type: 'PROSPERITY', value: newProsperity});

            // D. 死亡判定 (繁荣度过低)
            if (newProsperity < humanDeathThreshold) {
                changes.push({x, y, type: 'STATE', value: 0}); // 变为 EMPTY
                continue;
            }

            // E. 扩张 (繁荣度足够高)
            if (newProsperity > humanExpansionThreshold) {
                // 寻找可扩张的空地
                const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
                if (emptyNeighbors.length > 0) {
                    // 优先选择温度适宜的
                    const suitableNeighbors = emptyNeighbors.filter(n => n.temperature >= humanMinTemp && n.temperature <= humanMaxTemp);
                    const target = suitableNeighbors.length > 0 
                        ? suitableNeighbors[Math.floor(Math.random() * suitableNeighbors.length)]
                        : emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                    
                    // 扩张消耗繁荣度
                    changes.push({x, y, type: 'PROSPERITY', value: newProsperity - 30});
                    // 新聚落初始繁荣度为30 (默认值)
                    changes.push({x: target.x, y: target.y, type: 'STATE', value: 1}); // 1 for HUMAN
                    changes.push({x: target.x, y: target.y, type: 'PROSPERITY', value: 30});
                }
            }

            // F. 迁移 (繁荣度较低但不致死，且环境不适宜)
            if (newProsperity < humanMigrationThreshold && (cell.temperature < humanMinTemp || cell.temperature > humanMaxTemp)) {
                const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
                // 寻找更好的环境
                const betterNeighbors = emptyNeighbors.filter(n => {
                    const tempDiffCurrent = Math.min(Math.abs(cell.temperature - humanMinTemp), Math.abs(cell.temperature - humanMaxTemp));
                    const tempDiffNew = Math.min(Math.abs(n.temperature - humanMinTemp), Math.abs(n.temperature - humanMaxTemp));
                    return tempDiffNew < tempDiffCurrent;
                });

                if (betterNeighbors.length > 0) {
                    const target = betterNeighbors[Math.floor(Math.random() * betterNeighbors.length)];
                    changes.push({x, y, type: 'MIGRATE', toX: target.x, toY: target.y, value: newProsperity});
                }
            }
        }
    }

    // 应用变更
    for (const change of changes) {
        if (change.type === 'PROSPERITY') {
            this.grid[change.y][change.x].prosperity = change.value!;
        } else if (change.type === 'STATE') {
            const cell = this.grid[change.y][change.x];
            if (change.value === 0) {
                cell.crystalState = 'EMPTY';
                cell.prosperity = 0;
                cell.isMining = false;
            } else if (change.value === 1) {
                cell.crystalState = 'HUMAN';
                // prosperity set separately
            }
        } else if (change.type === 'MINING_STATE') {
            this.grid[change.y][change.x].isMining = change.value === 1;
        } else if (change.type === 'MIGRATE') {
            // 确保源位置还是人类（可能被其他规则杀死了）
            if (this.grid[change.y][change.x].crystalState === 'HUMAN') {
                // 移出
                this.grid[change.y][change.x].crystalState = 'EMPTY';
                this.grid[change.y][change.x].prosperity = 0;
                this.grid[change.y][change.x].isMining = false;
                
                // 移入
                if (change.toX !== undefined && change.toY !== undefined) {
                    const target = this.grid[change.toY][change.toX];
                    // 确保目标位置还是空的（可能被其他规则占用了）
                    if (target.crystalState === 'EMPTY') {
                        target.crystalState = 'HUMAN';
                        target.prosperity = change.value!;
                    }
                }
            }
        }
    }
  }

  // 辅助方法：生成人类
  spawnHuman(initialProsperity: number) {
    // 优先使用设定的重生点
    if (this.params.humanSpawnPoint) {
        const { x, y } = this.params.humanSpawnPoint;
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const cell = this.grid[y][x];
            if (cell.exists && cell.crystalState !== 'ALPHA') {
                cell.crystalState = 'HUMAN';
                cell.prosperity = initialProsperity;
                return;
            }
        }
    }

    // 随机生成一个人类聚落
    let attempts = 0;
    while (attempts < 100) {
        const rx = Math.floor(Math.random() * this.width);
        const ry = Math.floor(Math.random() * this.height);
        const cell = this.grid[ry][rx];
        // 优先选择温度适宜的地方
        const isTempSuitable = cell.temperature >= this.params.humanMinTemp && cell.temperature <= this.params.humanMaxTemp;
        
        if (cell.exists && cell.crystalState !== 'ALPHA' && (isTempSuitable || attempts > 50)) {
            cell.crystalState = 'HUMAN';
            cell.prosperity = initialProsperity;
            break;
        }
        attempts++;
    }
  }

  updateMantleLayer() {
    const { 
        expansionThreshold, shrinkThreshold, mantleEnergyLevel, 
        maxRadius, minRadius, distortionSpeed,
        edgeGenerationWidth, edgeGenerationEnergy, edgeGenerationOffset,
        edgeSupplyPointSpeed
    } = this.params;
    
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // 更新噪声偏移
    this.noiseOffsetX += distortionSpeed;
    this.noiseOffsetY += distortionSpeed;
    
    // 更新边缘供给点位置
    this.edgeSupplyPoints.forEach(point => {
        point.angle += point.speed;
        // 保持在 0-2PI
        if (point.angle > Math.PI * 2) point.angle -= Math.PI * 2;
        if (point.angle < 0) point.angle += Math.PI * 2;
    });

    // 第一步：计算能量变化 (Cahn-Hilliard 简化版 + 噪声源)
    const newEnergies = this.grid.map(row => row.map(c => c.mantleEnergy));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        // 1. 基础噪声能量源 (模拟地幔对流)
        const noiseVal = generatePerlinNoise(x * 0.1 + this.noiseOffsetX, y * 0.1 + this.noiseOffsetY);
        // 将噪声值映射到能量波动 (-1~1 -> 0.9~1.1)
        const energyFluctuation = 1 + noiseVal * 0.1;
        
        // 2. 邻居平均 (扩散)
        const neighbors = this.getNeighbors(x, y);
        const avgEnergy = neighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / neighbors.length;
        
        // 3. 趋向稳定值 (相分离)
        // 如果能量高，倾向于更高；如果能量低，倾向于更低 (但在一定范围内)
        // 这里简化为趋向于当前环境的平均能量等级
        const targetEnergy = mantleEnergyLevel * energyFluctuation;
        
        // 综合更新
        let newEnergy = avgEnergy * 0.95 + targetEnergy * 0.05;
        
        // 4. 边缘能量生成 (模拟外部能量注入)
        // 计算到中心的距离
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // 找到当前方向上的最外层边界
        // 简化算法：如果当前点存在，且向外延伸方向的邻居不存在，则为边缘
        // 或者直接基于距离判断，假设地形大致是圆形的
        
        // 更精确的边缘检测：检查8邻域是否有不存在的点
        const hasVoidNeighbor = neighbors.length < 8 || neighbors.some(n => !n.exists);
        
        if (hasVoidNeighbor) {
            // 这是一个边缘点
            // 检查是否在供给点附近
            const angle = Math.atan2(y - centerY, x - centerX);
            let normalizedAngle = angle;
            if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
            
            let isNearSupplyPoint = false;
            for (const point of this.edgeSupplyPoints) {
                let diff = Math.abs(normalizedAngle - point.angle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                
                // 供给范围约为 45度 (PI/4)
                if (diff < Math.PI / 4) {
                    isNearSupplyPoint = true;
                    break;
                }
            }
            
            if (isNearSupplyPoint) {
                // 只有在供给点附近的边缘才生成能量
                // 使用 edgeGenerationOffset 控制从边缘向内第几层开始生成
                // 这里简单处理：直接给边缘点加能量，扩散逻辑会将其传导进去
                // 如果需要更精确的"向内偏移"，需要BFS或其他方式找到向内N层的点，这里暂简化
                newEnergy += edgeGenerationEnergy;
            }
        }
        
        // 5. 晶石吸收 (能量汇)
        if (cell.crystalState !== 'EMPTY') {
            // 晶石吸收地幔能量
            const absorption = newEnergy * this.params.mantleAbsorption;
            newEnergy -= absorption;
            // 能量转移给晶石 (在 updateCrystalLayer 中处理增加，这里只处理减少)
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
    
    // 第二步：地形演变 (扩张/缩减)
    // 使用单独的循环，避免更新顺序影响
    const terrainChanges: {x: number, y: number, action: 'expand' | 'shrink'}[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        if (cell.exists) {
            // 检查缩减
            // 能量过低且不是核心区域 (minRadius)
            if (cell.mantleEnergy < shrinkThreshold && dist > minRadius) {
                cell.shrinkAccumulator += (shrinkThreshold - cell.mantleEnergy);
                if (cell.shrinkAccumulator > 100) {
                    // 只有当没有晶石时才缩减
                    if (cell.crystalState === 'EMPTY') {
                        terrainChanges.push({x, y, action: 'shrink'});
                    }
                    cell.shrinkAccumulator = 0;
                }
            } else {
                cell.shrinkAccumulator = Math.max(0, cell.shrinkAccumulator - 1);
            }
            
            // 检查扩张 (向空邻居)
            if (cell.mantleEnergy > expansionThreshold && dist < maxRadius) {
                const emptyNeighbors = this.getNeighbors(x, y, true).filter(n => !n.exists);
                if (emptyNeighbors.length > 0) {
                    // 随机选择一个空邻居扩张
                    const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                    // 检查目标点是否在最大半径内
                    const targetDist = Math.sqrt((target.x - centerX) ** 2 + (target.y - centerY) ** 2);
                    if (targetDist < maxRadius) {
                        terrainChanges.push({x: target.x, y: target.y, action: 'expand'});
                        // 消耗能量
                        cell.mantleEnergy -= 20; 
                    }
                }
            }
        }
      }
    }
    
    // 应用地形变化
    for (const change of terrainChanges) {
        const cell = this.grid[change.y][change.x];
        if (change.action === 'expand') {
            cell.exists = true;
            cell.mantleEnergy = 30; // 新生土地初始能量
        } else if (change.action === 'shrink') {
            cell.exists = false;
            cell.mantleEnergy = 0;
            cell.crystalState = 'EMPTY'; // 确保清除晶石(虽然前面检查了)
        }
    }
  }
  
  updateClimateLayer() {
    const { diffusionRate, advectionRate, thunderstormThreshold, mantleHeatFactor } = this.params;
    
    // 1. 计算温度变化 (扩散 + 对流 + 地幔加热)
    const newTemps = this.grid.map(row => row.map(c => c.temperature));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        // 扩散 (热传导)
        const neighbors = this.getNeighbors(x, y);
        const avgTemp = neighbors.reduce((sum, n) => sum + n.temperature, 0) / neighbors.length;
        let newTemp = cell.temperature * (1 - diffusionRate) + avgTemp * diffusionRate;
        
        // 地幔加热 (地热)
        // 基础温度 -100度
        // 地幔能量 (0-100+) 贡献温度，受 mantleHeatFactor (0-200) 控制
        // 逻辑：Temp = -100 + (MantleEnergy / 100) * MantleHeatFactor
        // 但为了平滑过渡，我们使用混合更新：
        // TargetTemp = -100 + (cell.mantleEnergy / 100) * mantleHeatFactor
        // newTemp = currentTemp * 0.9 + TargetTemp * 0.1 (趋向目标温度)
        
        const targetTemp = -100 + (cell.mantleEnergy / 100) * mantleHeatFactor;
        
        // 移除之前的累加逻辑，改为趋向目标值，这样更稳定且符合用户要求的"加权得到一个值"
        // 使用较小的混合系数模拟热容
        newTemp = newTemp * 0.9 + targetTemp * 0.1;
        
        // 季节性波动 (正弦波)
        // const season = Math.sin(this.timeStep * 0.01) * this.params.seasonalAmplitude;
        // newTemp += season * 0.01;
        
        newTemps[y][x] = newTemp;
      }
    }
    
    // 应用温度并检测雷暴
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].exists) {
            this.grid[y][x].temperature = newTemps[y][x];
            
            // 雷暴生成逻辑
            // 温度剧烈变化区域容易产生雷暴
            // 这里简化为：局部温度差异大
            const neighbors = this.getNeighbors(x, y);
            let maxDiff = 0;
            for (const n of neighbors) {
                maxDiff = Math.max(maxDiff, Math.abs(n.temperature - this.grid[y][x].temperature));
            }
            
            this.grid[y][x].hasThunderstorm = maxDiff > thunderstormThreshold;
        } else {
            this.grid[y][x].temperature = 0;
            this.grid[y][x].hasThunderstorm = false;
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
    
    // 1. 能量获取与消耗
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists || cell.crystalState === 'EMPTY' || cell.crystalState === 'HUMAN') continue;
        
        cell.isAbsorbing = false;
        cell.crystalEnergy = 0; // 重置当帧能量增益
        
        // 吸收地幔能量
        if (cell.mantleEnergy > 10) {
            const absorbed = cell.mantleEnergy * mantleAbsorption;
            cell.storedEnergy += absorbed;
            cell.crystalEnergy += absorbed; // 用于可视化
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
                // Alpha 晶石死亡转化为 Beta 晶石 (硬化)
                cell.crystalState = 'BETA';
                // Beta 晶石不需要能量维持，但也没有能量
                cell.storedEnergy = 0;
            } else {
                // Beta 晶石或其他状态死亡变为空
                cell.crystalState = 'EMPTY';
                cell.storedEnergy = 0;
            }
        }
      }
    }

    // 2. 能量共享 (ALPHA 晶石网络) - 迭代式扩散
    // 清除上一帧的流量记录
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            this.grid[y][x].energyFlow = [];
        }
    }

    // 简单的迭代扩散：高能量向低能量流动
    // 为了避免顺序影响，使用临时数组记录变化
    const energyChanges = Array(this.height).fill(0).map(() => Array(this.width).fill(0));

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            if (cell.crystalState !== 'ALPHA') continue;

            const neighbors = this.getNeighbors(x, y);
            const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');

            // 向能量较低的邻居输送能量
            for (const neighbor of alphaNeighbors) {
                if (cell.storedEnergy > neighbor.storedEnergy) {
                    const diff = cell.storedEnergy - neighbor.storedEnergy;
                    // 传输量与差异成正比，受 sharingRate 控制
                    // 同时也受 decayRate 限制（模拟阻力）
                    let transferAmount = diff * 0.1 * energySharingRate; 
                    
                    // 限制单次传输最大值，防止震荡
                    if (transferAmount > 5) transferAmount = 5;
                    
                    // 确保自己不会因为传输而低于邻居 (考虑到多对多传输，这里只是简单估算)
                    if (cell.storedEnergy - transferAmount < neighbor.storedEnergy + transferAmount) {
                        transferAmount = diff * 0.4; // 平分差异
                    }

                    if (transferAmount > 0.1) {
                        // 记录能量变化
                        energyChanges[y][x] -= transferAmount;
                        
                        // 接收方收到的能量要扣除衰减
                        const receivedAmount = transferAmount * (1 - energyDecayRate);
                        energyChanges[neighbor.y][neighbor.x] += receivedAmount;

                        // 记录流向用于可视化
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

    // 应用能量共享变化
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            if (this.grid[y][x].crystalState === 'ALPHA') {
                this.grid[y][x].storedEnergy += energyChanges[y][x];
                // 再次检查上限和下限
                if (this.grid[y][x].storedEnergy > maxCrystalEnergy * energySharingLimit) {
                    this.grid[y][x].storedEnergy = maxCrystalEnergy * energySharingLimit;
                }
                if (this.grid[y][x].storedEnergy < 0) {
                    this.grid[y][x].storedEnergy = 0;
                }
            }
        }
    }
    
    // 3. 晶石扩张
    const crystalChanges: {x: number, y: number, type: CellType}[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (cell.crystalState === 'ALPHA' && cell.storedEnergy > expansionCost * 2) {
            // 尝试扩张
            const neighbors = this.getNeighbors(x, y);
            const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
            
            if (emptyNeighbors.length > 0) {
                const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                
                // 决定生成 Alpha 还是 Beta
                // 简单逻辑：距离中心越远，越容易生成 Beta
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
        // 再次检查是否为空 (可能被多个晶石同时选中)
        if (cell.crystalState === 'EMPTY') {
            cell.crystalState = change.type;
            cell.storedEnergy = 10; // 初始能量
        }
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
