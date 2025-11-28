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
}

export const DEFAULT_PARAMS: SimulationParams = {
  // 地幔层
  mantleTimeScale: 0.002, // Not in screenshot, keeping default
  expansionThreshold: 123,
  shrinkThreshold: 20,
  mantleEnergyLevel: 100,
  maxRadius: 25,
  minRadius: 5,
  distortionSpeed: 0.01,
  edgeGenerationWidth: 2,
  edgeGenerationEnergy: 10,
  edgeGenerationOffset: 0,
  edgeSupplyPointCount: 3,
  edgeSupplyPointSpeed: 0.05,
  
  // 气候层
  diffusionRate: 0.12,
  advectionRate: 0.02, // Not in screenshot, keeping default
  thunderstormThreshold: 18,
  seasonalAmplitude: 5.0, // Not in screenshot, keeping default
  
  // 晶石层
  alphaEnergyDemand: 1.5,
  betaEnergyDemand: 2.0, // Not in screenshot, keeping default
  mantleAbsorption: 0.1, // Not in screenshot, keeping default
  thunderstormEnergy: 10.0, // Will be updated later if needed, currently 10 in default
  expansionCost: 8,
  maxCrystalEnergy: 80,
  energySharingRate: 0.1,
  harvestThreshold: 0.8,

  // 人类层
  humanMinTemp: -10,
  humanMaxTemp: 25,
  humanSurvivalMinTemp: -30,
  humanSurvivalMaxTemp: 45,
  humanProsperityGrowth: 0.5,
  humanProsperityDecay: 1.0,
  humanExpansionThreshold: 80,
  humanMiningReward: 20,
  humanMigrationThreshold: 40,
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
          storedEnergy: 10.0, // 初始能量
          isAbsorbing: false,
          energyFlow: [],
          prosperity: 0,
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

  // initializeGrid 已经在前面定义过了，这里不需要重复定义
  // 我们将人类初始化的逻辑整合到 updateHumanLayer 中，或者在构造函数中调用一个单独的初始化方法
  // 但为了保持代码结构清晰，我们删除这里重复且错误的 initializeGrid 定义
  // updateHumanLayer 已经包含了初始化逻辑 (如果人类数量为0则生成)
  
  updateHumanLayer() {
    const {
        humanMinTemp, humanMaxTemp, humanSurvivalMinTemp, humanSurvivalMaxTemp,
        humanProsperityGrowth, humanProsperityDecay, humanExpansionThreshold,
        humanMiningReward, humanMigrationThreshold
    } = this.params;

    // 1. 检查是否需要初始化人类 (如果没有人类存在)
    let humanCount = 0;
    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            if (this.grid[y][x].crystalState === 'HUMAN') {
                humanCount++;
            }
        }
    }

    if (humanCount === 0) {
        // 随机生成一个人类聚落
        let attempts = 0;
        while (attempts < 100) {
            const rx = Math.floor(Math.random() * this.width);
            const ry = Math.floor(Math.random() * this.height);
            const cell = this.grid[ry][rx];
            // 优先选择温度适宜的地方
            const isTempSuitable = cell.temperature >= humanMinTemp && cell.temperature <= humanMaxTemp;
            
            if (cell.exists && cell.crystalState !== 'ALPHA' && (isTempSuitable || attempts > 50)) {
                cell.crystalState = 'HUMAN';
                cell.prosperity = 50;
                break;
            }
            attempts++;
        }
        return; //这一帧只做初始化
    }

    // 2. 更新人类状态
    // 使用临时网格记录变更，避免顺序依赖
    const changes: {x: number, y: number, type: 'PROSPERITY' | 'STATE' | 'MIGRATE', value?: number, toX?: number, toY?: number}[] = [];

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            if (cell.crystalState !== 'HUMAN') continue;

            // A. 温度检查
            if (cell.temperature < humanSurvivalMinTemp || cell.temperature > humanSurvivalMaxTemp) {
                // 极端温度，直接抹杀
                changes.push({x, y, type: 'STATE', value: 0}); // 0 for EMPTY (or just not HUMAN)
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
            prosperityChange += humanNeighbors.length * 0.1; // 每个邻居提供少量加成

            // C. 采矿 (消除相邻 Beta 晶石)
            const betaNeighbors = neighbors.filter(n => n.crystalState === 'BETA');
            if (betaNeighbors.length > 0) {
                // 随机选择一个开采
                const target = betaNeighbors[Math.floor(Math.random() * betaNeighbors.length)];
                // 记录消除 Beta
                changes.push({x: target.x, y: target.y, type: 'STATE', value: 0}); // 变为 EMPTY
                prosperityChange += humanMiningReward;
            }

            // 应用繁荣度变化
            changes.push({x, y, type: 'PROSPERITY', value: cell.prosperity + prosperityChange});

            // D. 扩张
            if (cell.prosperity + prosperityChange > humanExpansionThreshold) {
                // 尝试扩张到空地或 Beta 格
                const validTargets = neighbors.filter(n => n.exists && n.crystalState !== 'ALPHA' && n.crystalState !== 'HUMAN');
                if (validTargets.length > 0) {
                    const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                    changes.push({x: target.x, y: target.y, type: 'STATE', value: 1}); // 1 for HUMAN
                    // 扩张消耗繁荣度
                    changes.push({x, y, type: 'PROSPERITY', value: (cell.prosperity + prosperityChange) * 0.6});
                }
            }

            // E. 迁移
            if (cell.prosperity + prosperityChange < humanMigrationThreshold) {
                // 繁荣度越低，迁移意愿越强 (这里简化为每帧尝试迁移)
                // 寻找更好的位置：温度更适宜 或 有 Beta 晶石
                const bestNeighbor = neighbors
                    .filter(n => n.exists && n.crystalState === 'EMPTY')
                    .sort((a, b) => {
                        // 评分标准：温度适宜度 + Beta 邻居数量
                        const scoreA = (a.temperature >= humanMinTemp && a.temperature <= humanMaxTemp ? 10 : 0) + 
                                       this.getNeighbors(a.x, a.y).filter(nn => nn.crystalState === 'BETA').length * 5;
                        const scoreB = (b.temperature >= humanMinTemp && b.temperature <= humanMaxTemp ? 10 : 0) + 
                                       this.getNeighbors(b.x, b.y).filter(nn => nn.crystalState === 'BETA').length * 5;
                        return scoreB - scoreA;
                    })[0];

                if (bestNeighbor) {
                    // 迁移概率与繁荣度成反比 (繁荣度越低越快)
                    const migrationChance = 1 - (cell.prosperity / humanMigrationThreshold);
                    if (Math.random() < migrationChance) {
                        changes.push({x, y, type: 'MIGRATE', toX: bestNeighbor.x, toY: bestNeighbor.y, value: cell.prosperity});
                    }
                }
            }
        }
    }

    // 应用变更
    for (const change of changes) {
        const targetCell = this.grid[change.y][change.x];
        
        if (change.type === 'STATE') {
            if (change.value === 0) { // Become EMPTY
                if (targetCell.crystalState === 'HUMAN' || targetCell.crystalState === 'BETA') {
                    targetCell.crystalState = 'EMPTY';
                    targetCell.prosperity = 0;
                }
            } else if (change.value === 1) { // Become HUMAN
                targetCell.crystalState = 'HUMAN';
                targetCell.prosperity = 30; // 新扩张的初始繁荣度
            }
        } else if (change.type === 'PROSPERITY') {
            if (targetCell.crystalState === 'HUMAN') {
                targetCell.prosperity = Math.max(0, Math.min(100, change.value!));
            }
        } else if (change.type === 'MIGRATE') {
            // 确保源还是 HUMAN (可能被其他事件改变)
            if (targetCell.crystalState === 'HUMAN') {
                const destCell = this.grid[change.toY!][change.toX!];
                if (destCell.crystalState === 'EMPTY') {
                    // 移动
                    destCell.crystalState = 'HUMAN';
                    destCell.prosperity = change.value!;
                    targetCell.crystalState = 'EMPTY';
                    targetCell.prosperity = 0;
                }
            }
        }
    }
    
    // Alpha 覆盖 Human (在 updateCrystalLayer 中处理，或者在这里补充)
    // 规则：扩展的alpha晶石格可以直接覆盖人类格
    // 这部分逻辑应该在 updateCrystalLayer 的扩张逻辑中，确保 Alpha 视 Human 为可占据目标
  }

  updateMantleLayer() {
    const { 
        mantleTimeScale, expansionThreshold, shrinkThreshold, 
        mantleEnergyLevel, maxRadius, minRadius 
    } = this.params;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // 1. 计算化学势 (Chemical Potential) - 基于 Cahn-Hilliard 方程简化
    // 目标：相分离 (Phase Separation) -> 自动聚团 + 填补空缺
    // 能量守恒：通过扩散实现，不直接生成/销毁能量
    
    const diffusionCoeff = 0.2; // 扩散系数
    const interfaceWidth = 1.5; // 界面宽度参数
    
    // 临时存储能量变化
    const energyChanges = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        const neighbors = this.getNeighbors(x, y).filter(n => n.exists);
        if (neighbors.length === 0) continue;
        
        // 计算局部平均能量
        const avgEnergy = neighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / neighbors.length;
        
        // Cahn-Hilliard 动力学简化：
        // 能量流向 = -∇μ (化学势梯度)
        // μ = f'(c) - k∇²c
        // 简化为：流向倾向于使能量接近 0 或 100 (相分离)，同时平滑界面
        
        // 1. 相分离力 (Double-well potential): 推动能量向 0 或 100 极化
        // f'(c) ~ c * (c - 1) * (c - 0.5)
        // 这里我们用更简单的逻辑：如果能量高，吸取周围能量；如果能量低，流出能量
        // 但要保持总能量守恒，必须是交换
        
        // 2. 表面张力 (Surface Tension): 最小化界面 -> 填补空缺，平滑边缘
        // 表现为扩散项：使局部能量趋于一致
        
        // 结合算法：
        // 每个细胞与邻居交换能量
        for (const neighbor of neighbors) {
            // 能量差
            const diff = neighbor.mantleEnergy - cell.mantleEnergy;
            
            // 交换量 = 扩散 + 聚集驱动
            // 聚集驱动：如果两者都较高(>50)，倾向于均分保持高位；如果一高一低，高的吸取低的(Ostwald ripening)
            // 但为了填补空缺，我们需要"高能量流向低能量" (常规扩散)
            // 为了维持团块，我们需要"反向扩散" (Up-hill diffusion) 在特定条件下
            
            // 采用简单的非线性扩散：
            // J = -D * ∇E + v * E * (1-E)
            // 这里简化为：总是试图平滑 (填补空缺)，但受到"相"的牵引
            
            // 缓慢迁徙：引入一个随时间变化的偏置场
            const time = this.timeStep * mantleTimeScale;
            const biasX = Math.sin(time * 0.5);
            const biasY = Math.cos(time * 0.5);
            
            // 基础扩散 (填补空缺)
            let flow = diff * diffusionCoeff * 0.1;
            
            // 迁徙偏置 (缓慢流动)
            const dx = neighbor.x - cell.x;
            const dy = neighbor.y - cell.y;
            const biasFlow = (dx * biasX + dy * biasY) * 0.05;
            
            flow += biasFlow;
            
            // 限制流速
            flow = Math.max(-2.0, Math.min(2.0, flow));
            
            // 累积变化 (注意方向：flow > 0 表示 neighbor -> cell)
            energyChanges[y][x] += flow;
            energyChanges[neighbor.y][neighbor.x] -= flow;
        }
      }
    }
    
    // 应用能量变化
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (cell.exists) {
            cell.mantleEnergy += energyChanges[y][x];
            // 软限制，允许轻微溢出但会被拉回
            cell.mantleEnergy = Math.max(0, Math.min(150, cell.mantleEnergy));
        }
      }
    }
    
    // 边缘能量生成机制 (随机迁移点供给)
    const { edgeGenerationWidth, edgeGenerationEnergy, edgeGenerationOffset, edgeSupplyPointSpeed } = this.params;
    
    // 更新供给点位置
    this.edgeSupplyPoints.forEach(point => {
      point.angle += point.speed * (Math.random() * 0.5 + 0.75); // 随机扰动速度
      if (point.angle > Math.PI * 2) point.angle -= Math.PI * 2;
      if (point.angle < 0) point.angle += Math.PI * 2;
      
      // 偶尔改变速度方向
      if (Math.random() < 0.01) {
        point.speed = (Math.random() - 0.5) * (edgeSupplyPointSpeed || 0.05);
      }
    });

    if (edgeGenerationEnergy > 0) {
        // 密度配置函数：计算某点受到所有供给点的影响
        const getDensity = (angle: number) => {
          let density = 0;
          for (const point of this.edgeSupplyPoints) {
            // 计算角度差 (考虑周期性)
            let diff = Math.abs(angle - point.angle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            
            // 高斯分布影响
            // 宽度由 edgeGenerationWidth 控制 (这里作为角度宽度的影响因子)
            // 假设 width=2 对应约 30度 (PI/6) 的影响范围
            const sigma = (edgeGenerationWidth || 2) * 0.15; 
            density += Math.exp(-(diff * diff) / (2 * sigma * sigma));
          }
          return density;
        };

        // 计算每个点到最近边缘的距离（BFS）
        const distToEdge = Array(this.height).fill(0).map(() => Array(this.width).fill(Infinity));
        const queue: {x: number, y: number, dist: number}[] = [];

        // 初始化：找到所有直接边缘点（距离为0）
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;

                const neighbors = this.getNeighbors(x, y);
                // 如果有不存在的邻居，或者是地图边界，则是边缘
                if (neighbors.some(n => !n.exists) || neighbors.length < 8) {
                    distToEdge[y][x] = 0;
                    queue.push({x, y, dist: 0});
                }
            }
        }

        // BFS 扩散距离
        let head = 0;
        while(head < queue.length) {
            const {x, y, dist} = queue[head++];
            
            // 如果距离已经超过需要的最大范围（offset + width），可以停止扩散该分支
            // 但为了准确性，我们通常计算全图或足够大的范围
            // 这里优化：只计算到 offset + width + 1
            const maxDist = (edgeGenerationOffset || 0) + (edgeGenerationWidth || 2) + 1;
            if (dist >= maxDist) continue;

            const neighbors = this.getNeighbors(x, y);
            for (const n of neighbors) {
                if (n.exists && distToEdge[n.y][n.x] === Infinity) {
                    distToEdge[n.y][n.x] = dist + 1;
                    queue.push({x: n.x, y: n.y, dist: dist + 1});
                }
            }
        }

        // 应用能量
        const offset = edgeGenerationOffset || 0;
        const width = edgeGenerationWidth || 2;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;

                const dist = distToEdge[y][x];
                
                // 判断是否在生成范围内：[offset, offset + width)
                // 例如 offset=0, width=2 => dist 0, 1
                // offset=1, width=2 => dist 1, 2
                if (dist >= offset && dist < offset + width) {
                    // 计算当前点的角度
                    const dx = x - centerX;
                    const dy = y - centerY;
                    let angle = Math.atan2(dy, dx);
                    if (angle < 0) angle += Math.PI * 2;
                    
                    // 获取供给密度
                    const density = getDensity(angle);
                    
                    // 应用能量供给
                    cell.mantleEnergy += edgeGenerationEnergy * density;
                }
            }
        }
    }

    // 边缘扩张/缩减逻辑 (保持不变，但基于新的能量分布)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        const neighbors = this.getNeighbors(x, y);
        const isEdge = neighbors.some(n => !n.exists);
        
        if (isEdge) {
            // 简单的扩张逻辑：能量过剩则扩张
            if (cell.mantleEnergy > expansionThreshold) {
                const emptyNeighbors = neighbors.filter(n => !n.exists);
                if (emptyNeighbors.length > 0) {
                    const validTargets = emptyNeighbors.filter(n => {
                        const nDist = Math.sqrt((n.x - centerX) ** 2 + (n.y - centerY) ** 2);
                        return nDist <= maxRadius;
                    });
                    
                    if (validTargets.length > 0) {
                        const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                        target.exists = true;
                        target.mantleEnergy = cell.mantleEnergy * 0.5; // 分裂能量
                        cell.mantleEnergy *= 0.5;
                    }
                }
            } 
            // 简单的缩减逻辑：能量过低则消失
            else if (cell.mantleEnergy < shrinkThreshold) {
                const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (dist > minRadius) {
                    // 能量回流给邻居 (守恒)
                    const existingNeighbors = neighbors.filter(n => n.exists);
                    if (existingNeighbors.length > 0) {
                        const energyPerNeighbor = cell.mantleEnergy / existingNeighbors.length;
                        existingNeighbors.forEach(n => n.mantleEnergy += energyPerNeighbor);
                    }
                    
                    cell.exists = false;
                    cell.mantleEnergy = 0;
                    cell.crystalState = 'EMPTY';
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

    // 1.5 能量共享 (Energy Sharing)
    // 连通的 ALPHA 晶石可以共享能量，使得能量分布更均匀，防止局部枯竭
    // 简单实现：每个晶石与周围的 ALPHA 邻居交换能量
    const { energySharingRate } = this.params;
    const energyChanges = Array(this.height).fill(0).map(() => Array(this.width).fill(0));

    // 清空上一帧的能量流记录
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x]) this.grid[y][x].energyFlow = [];
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists || cell.crystalState !== 'ALPHA') continue;

        const neighbors = this.getNeighbors(x, y).filter(n => n.exists && n.crystalState === 'ALPHA');
        for (const neighbor of neighbors) {
            const diff = neighbor.storedEnergy - cell.storedEnergy;
            // 能量从高流向低
            // 注意：这里我们只计算流入流出，为了避免重复计算，我们只处理 diff > 0 的情况 (neighbor -> cell)
            // 或者简单地，每个 cell 计算与所有 neighbor 的交换，最终除以 2 (因为双向计算)
            // 但为了流向记录，我们需要明确方向
            
            if (diff > 0) {
                const flow = diff * (energySharingRate || 0.1);
                energyChanges[y][x] += flow;
                energyChanges[neighbor.y][neighbor.x] -= flow;
                
                // 记录流向: neighbor -> cell
                // 我们在 neighbor 上记录流出到 cell
                // 或者在 cell 上记录从 neighbor 流入
                // 为了可视化连线，我们在源头记录目标
                neighbor.energyFlow.push({ x: cell.x, y: cell.y, amount: flow });
            }
        }
      }
    }

    // 应用能量共享
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists || cell.crystalState !== 'ALPHA') continue;
        
        cell.storedEnergy += energyChanges[y][x];
        // 再次确保不超限
        cell.storedEnergy = Math.max(0, Math.min(cell.storedEnergy, maxCrystalEnergy));
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
