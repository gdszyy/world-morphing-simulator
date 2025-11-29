import { generatePerlinNoise } from './perlin';

// 类型定义
export type CellType = 'EMPTY' | 'ALPHA' | 'BETA' | 'BIO';

/**
 * 生物属性接口
 * 定义了物种的生存、繁衍、扩张等核心行为参数
 */
export interface BioAttributes {
  /** 适宜生存的最低温度，低于此温度繁荣度增长受限 */
  minTemp: number;
  /** 适宜生存的最高温度，高于此温度繁荣度增长受限 */
  maxTemp: number;
  /** 极限生存最低温度，低于此温度生物开始死亡 */
  survivalMinTemp: number;
  /** 极限生存最高温度，高于此温度生物开始死亡 */
  survivalMaxTemp: number;
  /** 繁荣度自然增长率 (每帧) */
  prosperityGrowth: number;
  /** 繁荣度自然衰减率 (每帧，用于环境不适宜时) */
  prosperityDecay: number;
  /** 触发扩张行为所需的繁荣度阈值 */
  expansionThreshold: number;
  /** 开采 Beta 晶石获得的繁荣度奖励 */
  miningReward: number;
  /** 触发迁移行为所需的繁荣度阈值 (通常在环境恶化时) */
  migrationThreshold: number;
  /** 受到 Alpha 晶石辐射造成的伤害值 */
  alphaRadiationDamage: number;
  /** 种群唯一标识 ID (0 为人类) */
  speciesId: number;
  /** 种群显示颜色 (Hex 字符串) */
  color: string;
}

/**
 * 地图单元格接口
 * 包含地幔、气候、晶石、生物四个层级的所有状态数据
 */
export interface Cell {
  x: number;
  y: number;
  
  // --- 地幔层 (Mantle Layer) ---
  /** 该地块是否存在 (true: 陆地, false: 虚空) */
  exists: boolean;
  /** 地幔能量值，决定地形扩张与缩减 */
  mantleEnergy: number;
  /** 扩张潜力值 (暂未使用) */
  expansionPotential: number;
  /** 扩张累积值，当能量超过阈值时累积，达到一定程度触发扩张 */
  expansionAccumulator: number;
  /** 缩减累积值，当能量低于阈值时累积，达到一定程度触发塌陷 */
  shrinkAccumulator: number;
  
  // --- 气候层 (Climate Layer) ---
  /** 当前地表温度 */
  temperature: number;
  /** 基础温度 (受地幔能量和季节影响) */
  baseTemperature: number;
  /** 温度变化量 (用于可视化) */
  temperatureChange: number;
  /** 是否存在雷暴天气 */
  hasThunderstorm: boolean;
  
  // --- 晶石层 (Crystal Layer) ---
  /** 晶石状态: EMPTY(无), ALPHA(绿色), BETA(蓝色), BIO(生物) */
  crystalState: CellType;
  /** 当前帧获得的能量 (仅用于可视化效果) */
  crystalEnergy: number;
  /** 内部存储的能量 (用于维持生存和扩张) */
  storedEnergy: number;
  /** 是否正在从地幔吸收能量 (仅 Alpha 晶石) */
  isAbsorbing: boolean;
  /** 能量流向记录列表，用于绘制能量传输连线 */
  energyFlow: { x: number, y: number, amount: number }[];

  // --- 生物层 (Bio Layer) ---
  /** 生物聚落繁荣度 (仅当 crystalState === 'BIO' 时有效) */
  prosperity: number;
  /** 是否正在开采相邻的 Beta 晶石 (仅聚落有效) */
  isMining: boolean;
  /** 生物聚落属性 (仅当 crystalState === 'BIO' 时有效) */
  bioAttributes?: BioAttributes;

  /** 
   * 迁徙生物 (Migrant)
   * 独立于晶石/聚落层，可以与任何方块共存
   */
  migrant?: {
    prosperity: number;
    attributes: BioAttributes;
    /** 迁徙目标 (如果有) */
    target?: {x: number, y: number};
  } | null;
}

/**
 * 模拟参数接口
 * 控制整个模拟系统的物理法则和数值平衡
 */
export interface SimulationParams {
  // --- 地幔层参数 (Mantle Layer) ---
  /** 地幔能量更新的时间尺度 (平滑系数) */
  mantleTimeScale: number;
  /** 地形扩张阈值：地幔能量超过此值可能触发地形扩张 */
  expansionThreshold: number;
  /** 地形缩减阈值：地幔能量低于此值可能触发地形塌陷 */
  shrinkThreshold: number;
  /** 地幔基础能量等级 (倍率) */
  mantleEnergyLevel: number;
  /** 世界最大半径限制 (硬限制) */
  maxRadius: number;
  /** 世界最小半径限制 (硬限制，保护核心区域) */
  minRadius: number;
  /** 噪声扭曲速度 (影响能量场的动态变化) */
  distortionSpeed: number;
  /** 边缘能量生成的宽度范围 */
  edgeGenerationWidth: number;
  /** 边缘能量生成的基础强度 */
  edgeGenerationEnergy: number;
  /** 边缘生成偏移量（从边缘向内第几层开始生效） */
  edgeGenerationOffset: number;
  /** 边缘能量供给点的数量 */
  edgeSupplyPointCount: number;
  /** 边缘供给点的旋转速度 */
  edgeSupplyPointSpeed: number;
  /** 地幔热量系数：地幔能量转化为地表温度的比例 */
  mantleHeatFactor: number;
  
  // --- 气候层参数 (Climate Layer) ---
  /** 温度扩散率：相邻地块热量交换的速度 */
  diffusionRate: number;
  /** 温度平流率：模拟风带来的热量移动 */
  advectionRate: number;
  /** 雷暴触发阈值：能量积聚超过此值生成雷暴 */
  thunderstormThreshold: number;
  /** 季节性温度变化的幅度 */
  seasonalAmplitude: number;
  
  // --- 晶石层参数 (Crystal Layer) ---
  /** Alpha 晶石每帧消耗的基础能量 */
  alphaEnergyDemand: number;
  /** Beta 晶石每帧消耗的基础能量 */
  betaEnergyDemand: number;
  /** Alpha 晶石从地幔吸收能量的效率 */
  mantleAbsorption: number;
  /** 雷暴击中晶石时提供的瞬间能量 */
  thunderstormEnergy: number;
  /** 晶石扩张（分裂）所需的能量成本 */
  expansionCost: number;
  /** 晶石可存储的最大能量上限 */
  maxCrystalEnergy: number;
  /** Alpha 晶石网络能量共享的速率 */
  energySharingRate: number;
  /** 能量共享的上限倍率 (相对于自身能量) */
  energySharingLimit: number;
  /** 能量在传输过程中的衰减率 (损耗) */
  energyDecayRate: number;
  /** 生物开采 Beta 晶石的效率阈值 */
  harvestThreshold: number;

  // --- 生物层通用参数 (Bio Layer) ---
  /** 生物灭绝时向周围释放的能量/繁荣度总量 */
  extinctionBonus: number;
  /** 不同物种相邻时的竞争惩罚系数 */
  competitionPenalty: number;
  /** 生物扩张时发生基因变异的概率 (0-1) */
  mutationRate: number;
  /** 基因变异的强度 (属性改变幅度) */
  mutationStrength: number;
  /** 判定为新物种的属性差异阈值 */
  newSpeciesThreshold: number;
  /** 非人类生物的最小繁荣度自然增长值 */
  minProsperityGrowth: number;
  /** 相同物种相邻提供的繁荣度协作加成 */
  sameSpeciesBonus: number;
  
  // --- 人类参数 (Human / Default Template) ---
  /** 人类适宜生存最低温度 */
  humanMinTemp: number;
  /** 人类适宜生存最高温度 */
  humanMaxTemp: number;
  /** 人类极限生存最低温度 */
  humanSurvivalMinTemp: number;
  /** 人类极限生存最高温度 */
  humanSurvivalMaxTemp: number;
  /** 人类繁荣度自然增长率 */
  humanProsperityGrowth: number;
  /** 人类繁荣度自然衰减率 */
  humanProsperityDecay: number;
  /** 人类扩张阈值 */
  humanExpansionThreshold: number;
  /** 人类开采奖励 */
  humanMiningReward: number;
  /** 人类迁移阈值 */
  humanMigrationThreshold: number;
  /** Alpha 辐射对人类造成的伤害 */
  alphaRadiationDamage: number;
  /** 人类强制重生点坐标 */
  humanSpawnPoint?: {x: number, y: number};
  /** 人类灭绝后的重生延迟 (步数) */
  humanRespawnDelay: number;
  /** 自动生成新物种的触发阈值 (当物种总数少于此值) */
  bioAutoSpawnCount: number;
  /** 自动生成新物种的时间间隔 (步数) */
  bioAutoSpawnInterval: number;
  /** 聚落扩张时生成迁徙者的概率 (0-1)，否则生成新聚落 */
  migrantExpansionProb: number;
  /** Alpha 辐射免疫阈值：繁荣度达到此值时免疫辐射伤害 */
  radiationImmunityThreshold: number;
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
  migrantExpansionProb: 0.8,
  radiationImmunityThreshold: 200,
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
  edgeSupplyPoints: { angle: number, speed: number, phase: number, frequency: number }[];
  
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
    // 均匀分布供给点
    const count = params.edgeSupplyPointCount || 3;
    const baseSpeed = params.edgeSupplyPointSpeed || 0.05;
    this.edgeSupplyPoints = Array(count).fill(0).map((_, i) => ({
      angle: (i / count) * Math.PI * 2, // 均匀分布角度
      speed: baseSpeed, // 基础旋转速度
      phase: Math.random() * Math.PI * 2, // 随机相位
      frequency: 0.5 + Math.random() * 1.5 // 随机频率
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
          migrant: null,
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
    const supplySpeed = this.params.edgeSupplyPointSpeed || 0.05;
    for (const point of this.edgeSupplyPoints) {
        // 使用参数中的速度，确保实时更新生效
        point.speed = supplySpeed;
        
        // 添加随机摆动
        // 使用正弦波叠加基础速度，产生忽快忽慢或轻微往复的效果
        const oscillation = Math.sin(this.timeStep * 0.01 * point.frequency + point.phase) * 0.02;
        
        point.angle += point.speed + oscillation;
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
        
        // 扩散混合 (使用更强的扩散系数)
        // 之前的 0.1 太小，导致扩散不明显。改为 0.4 增加流动性
        if (!isNaN(avgEnergy)) {
            const diffusionStrength = 0.4;
            newEnergy = newEnergy * (1 - diffusionStrength) + avgEnergy * diffusionStrength;
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
        
        // 4. 边缘能量生成
        // 逻辑修正：edgeGenerationOffset 应该控制能量生成的"层数"偏移，而不是角度旋转
        // 也就是说，offset=0 表示最外层，offset=1 表示向内一层，以此类推
        
        // 计算当前点到最近边缘的距离 (层数)
        // 这是一个近似计算，通过检查周围有多少个 void 邻居来判断是否在边缘
        // 或者更准确地，我们可以预计算每个点到边缘的距离，但这里为了性能使用近似方法
        
        // 只有在边缘区域才生成能量
        // 我们定义边缘区域为：本身存在，且邻居中有不存在的点 (最外层)
        // 或者邻居的邻居中有不存在的点 (次外层)，以此类推
        // 这里简化实现：只在最外层生成，但可以通过 offset 控制是否生效
        
        // 修正后的逻辑：
        // 我们只在"物理边缘"生成能量。edgeGenerationOffset 参数原本的设计意图可能是
        // 控制生成的位置是"紧贴边缘"还是"稍微靠内"。
        // 但根据用户反馈 "偏移值依旧有问题"，可能是指它没有起到预期的"向内偏移"效果，或者"旋转偏移"理解有误。
        // 结合上下文 "edgeGenerationOffset" 在参数面板中是 0-5 的整数，这通常意味着"层数"。
        // 如果用户是指"角度偏移"无效，之前的代码其实是实现了角度偏移的。
        // 但如果用户是指"层数偏移"（即能量产生在边缘向内几格的位置），之前的代码完全没实现。
        
        // 让我们重新审视需求： "edge supply point offset/rotation"
        // 用户说 "地幔供给点偏移值依旧有问题，目前是无效的"。
        // 之前的代码把 offset 当作角度偏移 (radians) 加到了 point.angle 上。
        // 但参数面板里 offset 是 0-5 的整数。把整数直接当弧度加，效果是旋转了 offset 弧度。
        // 这可能不是用户想要的。用户可能想要的是：供给点不仅在边缘旋转，还可以设置其"向内深入"的程度。
        
        // 让我们实现"向内偏移"逻辑：
        // 只有当点距离边缘的距离 == offset 时，才受到供给点影响。
        // 由于计算精确的边缘距离比较复杂，我们用一种简单的启发式方法：
        // 距离中心越远，越接近边缘。
        // 我们定义一个"生成带"，其半径由 maxRadius 和 edgeGenerationOffset 决定。
        
        // 实际上，之前的实现依赖 hasVoidNeighbor 来判断是否边缘。
        // 这意味着只在最外层一圈生成。
        // 如果 offset > 0，我们应该允许在非边缘（内部）生成，只要它在"边缘带"内。
        
        // 采用基于半径的逻辑：
        // 假设世界大致是圆形的。边缘半径约为当前最大半径。
        // 我们计算当前点距离中心的距离 distToCenter。
        // 我们估算当前方向的边缘半径 edgeRadius。
        // 如果 distToCenter 在 [edgeRadius - width - offset, edgeRadius - offset] 范围内，则生成。
        
        // 为了简化且稳健：
        // 我们扫描所有点，找到每个角度上的最大半径（边缘）。
        // 但这在 update 中太慢。
        
        // 回归最简单的"层数"定义：
        // hasVoidNeighbor = true 意味着是第 0 层边缘。
        // 如果我们要支持 offset，我们需要知道它是第几层。
        // 鉴于网格系统，这很难精确计算。
        
        // 替代方案：用户可能确实是指"角度偏移"（相位），但之前的实现有问题？
        // 之前的实现：point.angle + offset。
        // 如果 offset 是整数 1, 2, 3... 
        // 1 rad ≈ 57度。这确实会旋转。
        // 但用户说"无效"。
        
        // 另一种可能性：用户是指 edgeGenerationOffset 应该控制"生成点"在圆周上的初始位置偏移？
        // 或者，用户是指"边缘宽度"？
        
        // 让我们看参数名：edgeGenerationOffset。
        // 结合之前的上下文，这通常用于控制"从边缘向内缩进多少格"。
        // 让我们尝试实现"向内缩进"逻辑。
        
        // 算法：
        // 1. 找到所有 hasVoidNeighbor 的点 (Layer 0)。
        // 2. 找到所有邻居中有 Layer 0 的点 (Layer 1)。
        // ...
        // 这需要多遍扫描，太慢。
        
        // 让我们用距离中心的相对距离来模拟。
        // 假设边缘在 maxRadius 附近。
        // 有效生成范围：distToCenter > (maxRadius - edgeGenerationWidth - edgeGenerationOffset)
        // 但这假设世界填满了 maxRadius。实际上世界会缩放。
        
        // 让我们采用一种基于"当前世界边界"的动态判定。
        // 我们已经有了 hasVoidNeighbor 判断。
        // 如果 offset=0，我们只对 hasVoidNeighbor 的点生成。
        // 如果 offset>0，我们需要对"内部"点生成。
        
        // 既然无法精确计算层数，我们改回"角度偏移"的解释，但确保它是正确的。
        // 也许用户觉得 offset 加在 angle 上没反应？
        // 让我们把 offset 解释为"相位偏移" (Phase Offset)，单位为弧度?
        // 不，参数是 0-5 step 1。
        
        // 让我们再看一眼之前的代码：
        // const offsetAngle = point.angle + (edgeGenerationOffset || 0);
        // 这绝对是有效的旋转。
        
        // 除非... edgeGenerationOffset 在参数中没有正确传递？
        // 或者用户期望的是"径向偏移" (Radial Offset)？即向内/向外移动供给点。
        // "地幔供给点偏移值" -> 可能是指供给点距离圆心的距离偏移。
        // 默认供给点在"边缘"。如果 offset 增加，供给点应该"向内移动"。
        // 这与我刚才的"层数"猜想一致。
        
        // 让我们实现径向偏移：
        // 供给点不再被视为"无限远的射线源"，而是位于特定半径上的点源。
        // 或者，我们保留射线源逻辑（角度影响），但限制其生效的半径范围。
        
        // 修正方案：
        // 1. 保持角度影响逻辑。
        // 2. 增加半径限制：只有在 (边缘半径 - offset) 附近的点才接收能量。
        // 这样，当 offset 增大时，能量注入圈会向内收缩。
        
        // 如何确定"边缘半径"？
        // 对于每个点 (x,y)，我们检查它是否在"边缘带"内。
        // 我们可以利用 distance transform 的思想，但太复杂。
        // 简单做法：如果一个点存在，且它距离中心 > (当前最大半径 - offset - width)，则接收能量。
        // 为了找到"当前最大半径"，我们可以遍历一次 grid (或者维护一个变量)。
        // 简单起见，我们假设当前最大半径就是 params.maxRadius (虽然地形会变)。
        // 或者，更动态地：
        // 如果 offset > 0，我们简单地把 hasVoidNeighbor 的条件放宽？
        // 不行。
        
        // 让我们尝试最直观的"径向距离控制"。
        // 假设世界是圆的，半径为 R。
        // 供给点作用在 R - offset 处。
        // 我们只对 distToCenter 在 [R - offset - width, R - offset] 的点注入能量。
        // R 可以近似为 cell.exists 的最大距离。
        
        // 让我们用一个简单的近似：
        // 只有当 distToCenter > (maxRadius - edgeGenerationOffset - edgeGenerationWidth) 时才考虑注入。
        // 并且为了防止注入到虚空，必须 cell.exists。
        
        // 结合之前的 hasVoidNeighbor (确保是边缘)，如果 offset > 0，这个条件可能太严苛。
        // 所以，如果 offset > 0，我们不再要求 hasVoidNeighbor，而是纯粹基于距离。
        
        const effectiveMaxRadius = maxRadius; // 使用参数中的最大半径作为参考
        const innerBound = effectiveMaxRadius - (edgeGenerationOffset || 0) - edgeGenerationWidth;
        const outerBound = effectiveMaxRadius - (edgeGenerationOffset || 0);
        
        // 只有在径向范围内才计算
        if (distToCenter >= innerBound && distToCenter <= outerBound) {
             const angle = Math.atan2(y - centerY, x - centerX);
            let normalizedAngle = angle;
            if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
            
            // 计算供给点的影响
            let maxInfluence = 0;
            for (const point of this.edgeSupplyPoints) {
                // 这里不再把 offset 加到 angle 上，因为 offset 现在解释为径向偏移
                const effectiveAngle = point.angle;
                
                let diff = Math.abs(normalizedAngle - effectiveAngle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                
                // 供给点影响范围 (PI/4 = 45度)
                if (diff < Math.PI / 4) {
                    // 角度影响因子 (余弦衰减)
                    const angleInfluence = Math.cos(diff * 4); 
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
  
  /**
   * 更新气候层 (Climate Layer)
   * 负责计算地表温度分布和天气现象
   * 核心逻辑：
   * 1. 基础温度：由地幔能量加热，并叠加季节性波动
   * 2. 热力学过程：模拟热量的扩散（传导）和平流（风）
   * 3. 灾害天气：在高能且温度梯度大的区域生成雷暴
   */
  updateClimateLayer() {
    const { diffusionRate, advectionRate, thunderstormThreshold, mantleHeatFactor } = this.params;
    
    const newTemps = this.grid.map(row => row.map(c => c.temperature));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.exists) continue;
        
        // 1. 热扩散 (传导)
        // 温度趋向于周围环境的平均值
        const neighbors = this.getNeighbors(x, y);
        const avgTemp = neighbors.reduce((sum, n) => sum + n.temperature, 0) / neighbors.length;
        let newTemp = cell.temperature * (1 - diffusionRate) + avgTemp * diffusionRate;
        
        // 2. 地幔加热
        // 地幔能量转化为热量，作为目标温度
        // 优化：大幅降低地幔耦合度，使气候层有更多独立演化空间
        // 之前的 0.01 仍然可能导致温度分布过于静态。改为 0.005，让热量更多由平流主导
        const targetTemp = -100 + (cell.mantleEnergy / 100) * mantleHeatFactor;
        newTemp = newTemp * 0.995 + targetTemp * 0.005;
        
        // 3. 模拟热平流 (Heat Advection)
        // 真正的对流不仅仅是冷却，而是热量的移动。
        // 我们需要计算风场，并让风携带热量移动。
        
        // 计算局部温度梯度 (驱动风)
        const tLeft = this.grid[y][Math.max(x - 1, 0)].temperature;
        const tRight = this.grid[y][Math.min(x + 1, this.width - 1)].temperature;
        const tUp = this.grid[Math.max(y - 1, 0)][x].temperature;
        const tDown = this.grid[Math.min(y + 1, this.height - 1)][x].temperature;
        
        const gradientX = (tRight - tLeft) / 2;
        const gradientY = (tDown - tUp) / 2;
        
        // 风向：从高温吹向低温 (热扩散方向)
        // 风速：与梯度成正比
        // 增加风速系数，使热量移动更明显
        const windX = -gradientX * 2.0; 
        const windY = -gradientY * 2.0;
        
        // 平流计算：逆风向采样温度
        // T_new = T_old - (v * grad T)
        // 简单的一阶迎风格式 (Upwind Scheme)
        
        // 找到上游位置
        const srcX = Math.max(0, Math.min(this.width - 1, x - windX));
        const srcY = Math.max(0, Math.min(this.height - 1, y - windY));
        
        // 双线性插值获取上游温度
        const x0 = Math.floor(srcX);
        const x1 = Math.min(x0 + 1, this.width - 1);
        const y0 = Math.floor(srcY);
        const y1 = Math.min(y0 + 1, this.height - 1);
        
        const wx = srcX - x0;
        const wy = srcY - y0;
        
        const t00 = this.grid[y0][x0].temperature;
        const t10 = this.grid[y0][x1].temperature;
        const t01 = this.grid[y1][x0].temperature;
        const t11 = this.grid[y1][x1].temperature;
        
        const tSrc = (t00 * (1 - wx) + t10 * wx) * (1 - wy) + 
                     (t01 * (1 - wx) + t11 * wx) * wy;
                     
        // 应用平流：混合当前温度和上游温度
        // advectionRate 控制平流强度
        // 增加平流混合率，使流动效果更显著
        const advectionStrength = 0.4; 
        newTemp = newTemp * (1 - advectionStrength) + tSrc * advectionStrength;

        // 4. 环境冷却 (辐射散热)
        // 优化：基于 Stefan-Boltzmann 定律的简化版，温度越高散热越快
        // 之前的固定 -0.5 不够真实
        // 假设环境背景温度为 -273 (绝对零度) 或 -100 (模拟设定)
        // 散热速率与 (T - T_env) 成正比
        const coolingRate = 0.01;
        const ambientTemp = -100;
        newTemp -= (newTemp - ambientTemp) * coolingRate;
        
        newTemps[y][x] = newTemp;
        
        // 5. 雷暴判定
        // 触发条件：局部温度梯度大 (对流强) 且 温度较高 (有能量)
        // 优化：加入温度门槛，低温下即使有梯度也很难形成雷暴
        const tempDiff = Math.abs(cell.temperature - avgTemp);
        // 只有当温度 > -50 且梯度大时才触发
        if (cell.temperature > -50 && tempDiff > thunderstormThreshold && Math.random() < 0.15) {
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
  
  /**
   * 更新晶石层 (Crystal Layer)
   * 负责晶石的能量代谢、网络传输和生长繁殖
   * 核心逻辑：
   * 1. 能量获取：Alpha 晶石从地幔和雷暴中吸收能量
   * 2. 能量消耗：所有晶石每帧消耗维持能量
   * 3. 状态转化：Alpha 能量耗尽退化为 Beta，Beta 无法逆向转化
   * 4. 能量网络：Alpha 晶石之间自动平衡能量 (高能流向低能)
   * 5. 晶石扩张：能量充足的 Alpha 晶石向周围空地繁殖新的 Alpha 晶石
   */
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
        
        // 吸收地幔能量 (仅 Alpha 晶石具备此能力)
        if (cell.mantleEnergy > 10) {
            const absorbed = cell.mantleEnergy * mantleAbsorption;
            cell.storedEnergy += absorbed;
            cell.crystalEnergy += absorbed;
            cell.isAbsorbing = true;
        }
        
        // 雷暴充能 (雷暴天气下获得额外能量补给)
        if (cell.hasThunderstorm) {
            cell.storedEnergy += thunderstormEnergy;
            cell.crystalEnergy += thunderstormEnergy;
        }
        
        // 维持消耗 (生命维持成本)
        const demand = cell.crystalState === 'ALPHA' ? alphaEnergyDemand : betaEnergyDemand;
        cell.storedEnergy -= demand;
        
        // 能量上限截断
        if (cell.storedEnergy > maxCrystalEnergy) {
            cell.storedEnergy = maxCrystalEnergy;
        }
        
        // 能量枯竭处理
        if (cell.storedEnergy <= 0) {
            if (cell.crystalState === 'ALPHA') {
                // Alpha 晶石能量耗尽退化为 Beta 晶石
                cell.crystalState = 'BETA';
                cell.storedEnergy = 0;
            } 
            // Beta 晶石不会因为能量耗尽而消失，只能被生物开采或随地形塌陷消失
        }
      }
    }

    // 2. 能量共享 (ALPHA 晶石网络)
    // 重置能量流向记录
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

            // 向能量较低的邻居输送能量
            for (const neighbor of alphaNeighbors) {
                if (cell.storedEnergy > neighbor.storedEnergy) {
                    const diff = cell.storedEnergy - neighbor.storedEnergy;
                    let transferAmount = diff * 0.1 * energySharingRate; 
                    
                    // 限制单次传输量，防止震荡
                    if (transferAmount > 5) transferAmount = 5;
                    
                    // 确保传输后不会导致自身能量低于对方
                    if (cell.storedEnergy - transferAmount < neighbor.storedEnergy + transferAmount) {
                        transferAmount = diff * 0.4;
                    }

                    if (transferAmount > 0.1) {
                        energyChanges[y][x] -= transferAmount;
                        // 传输损耗 (Decay)
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

    // 应用能量共享结果
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

    // 3. 晶石扩张 (繁殖)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        // 只有能量充足的 Alpha 晶石才能扩张
        if (cell.crystalState === 'ALPHA' && cell.storedEnergy > expansionCost * 2) {
            const neighbors = this.getNeighbors(x, y);
            const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
            
            if (emptyNeighbors.length > 0) {
                const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                
                // Alpha 晶石扩张只能生成 Alpha 晶石
                // Beta 晶石只能由 Alpha 晶石能量枯竭转化而来
                crystalChanges.push({x: target.x, y: target.y, type: 'ALPHA'});
                cell.storedEnergy -= expansionCost;
            }
        }
      }
    }
    
    // 应用扩张结果
    for (const change of crystalChanges) {
        const cell = this.grid[change.y][change.x];
        if (cell.crystalState === 'EMPTY') {
            cell.crystalState = change.type;
            cell.storedEnergy = 10; // 初始能量
        }
    }
  }

  /**
   * 更新生物层 (Bio Layer)
   * 负责生物的生存、繁衍、变异和灭绝
   * 核心逻辑：
   * 1. 自动生成：当物种稀少时，系统自动投放新物种
   * 2. 人类重生：人类灭绝后，经过固定延迟强制重生
   * 3. 生存判定：基于温度适应性计算繁荣度增减
   * 4. 竞争与开采：不同物种相邻竞争，生物开采 Beta 晶石
   * 5. 扩张与变异：繁荣度达标后向外扩张，并概率产生新物种
   * 6. 灭绝：繁荣度归零死亡，能量散逸给周围环境 (不含地幔)
   */
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
    }

    // 3. 更新生物状态 (聚落与迁徙者)
    const changes: {x: number, y: number, type: 'PROSPERITY' | 'STATE' | 'MIGRATE' | 'MINING_STATE' | 'NEW_BIO' | 'MIGRANT_UPDATE' | 'MIGRANT_REMOVE' | 'MIGRANT_ADD', value?: any, toX?: number, toY?: number}[] = [];

    for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
            const cell = this.grid[y][x];
            const neighbors = this.getNeighbors(x, y);

            // --- 3.1 处理生物聚落 (Settlement) ---
            if (cell.crystalState === 'BIO' && cell.bioAttributes) {
                const attrs = cell.bioAttributes;

                // A. 温度检查 (生存极限)
                // 极端温度不再直接杀死生物，而是快速降低繁荣度
                let extremeTempDamage = 0;
                if (cell.temperature < attrs.survivalMinTemp) {
                    extremeTempDamage = (attrs.survivalMinTemp - cell.temperature) * 2; // 每度温差造成2点伤害
                } else if (cell.temperature > attrs.survivalMaxTemp) {
                    extremeTempDamage = (cell.temperature - attrs.survivalMaxTemp) * 2;
                }

                // B. 繁荣度更新
                // 规则修改：生物繁荣度不再自然衰减，而是根据当前温度偏离宜居温度的程度，减少繁荣度增长。
                // 收益来源：1. 宜居温度 2. 同种群邻居 (在下方计算)
                
                let prosperityChange = 0;
                
                // 计算温度适宜度带来的增长
                let growth = attrs.prosperityGrowth;
                if (attrs.speciesId !== 0) {
                    growth = Math.max(growth, this.params.minProsperityGrowth);
                }

                if (cell.temperature >= attrs.minTemp && cell.temperature <= attrs.maxTemp) {
                    // 在适宜温度范围内，获得全额增长
                    prosperityChange += growth;
                } else {
                    // 偏离适宜温度，增长减少
                    // 计算偏离程度
                    let deviation = 0;
                    if (cell.temperature < attrs.minTemp) {
                        deviation = attrs.minTemp - cell.temperature;
                    } else {
                        deviation = cell.temperature - attrs.maxTemp;
                    }
                    
                    // 偏离越大，增长越少，甚至为负
                    // 假设每偏离 1 度，增长减少 10% (可调)
                    // 或者简单地：增长 = 基础增长 - 偏离惩罚
                    // 这里使用减法逻辑：prosperityChange = growth - deviation * decayFactor
                    // 这样可以实现"不再自然衰减"，而是"因环境恶劣而减少增长"
                    
                    const decayFactor = attrs.prosperityDecay || 1.0;
                    const effectiveGrowth = growth - deviation * decayFactor;
                    
                    prosperityChange += effectiveGrowth;
                }
                
                // 叠加极端温度伤害
                if (extremeTempDamage > 0) {
                    prosperityChange -= extremeTempDamage;
                }

                // 邻居影响 (聚落间的竞争与协作)
                const bioNeighbors = neighbors.filter(n => n.crystalState === 'BIO' && n.bioAttributes);
                for (const n of bioNeighbors) {
                    if (n.bioAttributes!.speciesId === attrs.speciesId) {
                        prosperityChange += this.params.sameSpeciesBonus;
                    } else {
                        // 竞争：只对繁荣度低于自己的邻居造成伤害
                        if (cell.prosperity > n.prosperity) {
                            // 繁荣度差值越大，伤害概率越大 (这里简化为直接扣除繁荣度)
                            const diff = cell.prosperity - n.prosperity;
                            const damage = competitionPenalty * (1 + diff / 100);
                            // 注意：这里我们不能直接修改邻居，只能修改自己受到的反作用力或者通过后续事件处理
                            // 为了简化，我们假设竞争是双向的，这里只计算自己受到的影响(如果有)
                            // 实际上，根据需求"只有生物聚落会对会对自己所在块在内的周围的低繁荣度生物块造成伤害"
                            // 这意味着强者伤害弱者。作为强者(当前cell)，我不受伤害。
                            // 作为弱者(在遍历到弱者时)，会被强者伤害。
                        } else if (cell.prosperity < n.prosperity) {
                             // 我是弱者，被强者(n)伤害
                             const diff = n.prosperity - cell.prosperity;
                             const damage = competitionPenalty * (1 + diff / 100);
                             prosperityChange -= damage;
                        }
                    }
                }

                // Alpha 辐射伤害
                const alphaNeighbors = neighbors.filter(n => n.crystalState === 'ALPHA');
                if (alphaNeighbors.length > 0) {
                    let baseDamage = Math.max(attrs.prosperityGrowth + 0.2, this.params.alphaRadiationDamage);
                    
                    // 动态伤害减免：繁荣度越高，受到的伤害越小
                    // 当繁荣度达到 radiationImmunityThreshold 时，伤害降为 0
                    const immunityThreshold = this.params.radiationImmunityThreshold || 200;
                    const immunityFactor = Math.max(0, 1 - (cell.prosperity / immunityThreshold));
                    
                    const finalDamage = baseDamage * immunityFactor;
                    
                    if (finalDamage > 0) {
                        prosperityChange -= alphaNeighbors.length * finalDamage;
                    }
                }

                // C. 采矿 (仅聚落可采矿)
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

                // D. 死亡判定
                if (newProsperity <= 0) {
                    changes.push({x, y, type: 'STATE', value: 0});
                    this.distributeExtinctionBonus(x, y, extinctionBonus);
                    continue;
                }

                    // E. 扩张 (生成新聚落或迁徙者)
                    if (newProsperity > attrs.expansionThreshold) {
                        // 变异逻辑 (无论生成聚落还是迁徙者，都可能发生变异)
                        let newAttrs = {...attrs};
                        let isNewSpecies = false;
                        const keys: (keyof BioAttributes)[] = ['minTemp', 'maxTemp', 'prosperityGrowth', 'prosperityDecay', 'expansionThreshold', 'miningReward', 'migrationThreshold'];
                        
                        for (const key of keys) {
                            if (Math.random() < mutationRate) {
                                const val = newAttrs[key] as number;
                                const change = val * mutationStrength * (Math.random() > 0.5 ? 1 : -1);
                                (newAttrs[key] as number) += change;
                                if (Math.abs(change) > Math.abs(val) * newSpeciesThreshold) {
                                    isNewSpecies = true;
                                }
                            }
                        }
                        
                        if (isNewSpecies) {
                            newAttrs.speciesId = Math.floor(Math.random() * 100000);
                            newAttrs.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                        }

                        // 决策：生成新聚落还是迁徙者
                        // 默认大概率生成迁徙者 (例如 80%)，小概率直接扩张为邻近聚落 (20%)
                        const migrantProbability = this.params.migrantExpansionProb; 

                        if (Math.random() < migrantProbability) {
                            // 生成迁徙者 (Migrant)
                            // 迁徙者生成在当前格子，随后会移动
                            // 如果当前格子已有迁徙者，则尝试生成在邻居
                            let targetX = x;
                            let targetY = y;
                            
                            if (cell.migrant) {
                                const validNeighbors = neighbors.filter(n => n.exists && !n.migrant);
                                if (validNeighbors.length > 0) {
                                    const target = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
                                    targetX = target.x;
                                    targetY = target.y;
                                } else {
                                    // 无处生成，放弃本次扩张
                                    targetX = -1;
                                }
                            }

                            if (targetX !== -1) {
                                changes.push({
                                    x: targetX, y: targetY, type: 'MIGRANT_ADD', 
                                    value: { prosperity: 30, attrs: newAttrs }
                                });
                                changes.push({x, y, type: 'PROSPERITY', value: newProsperity - 30});
                            }

                        } else {
                            // 生成新聚落 (Settlement)
                            // 必须有空的邻居
                            const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === 'EMPTY');
                            if (emptyNeighbors.length > 0) {
                                const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                                changes.push({
                                    x: target.x, y: target.y, type: 'NEW_BIO', 
                                    value: { prosperity: 30, attrs: newAttrs }
                                });
                                changes.push({x, y, type: 'PROSPERITY', value: newProsperity - 30});
                            } else {
                                // 如果没有空位生成聚落，则回退尝试生成迁徙者
                                // 或者直接放弃，这里选择尝试生成迁徙者以保持扩张压力
                                changes.push({
                                    x, y, type: 'MIGRANT_ADD', 
                                    value: { prosperity: 30, attrs: newAttrs }
                                });
                                changes.push({x, y, type: 'PROSPERITY', value: newProsperity - 30});
                            }
                        }
                    }

                // F. 迁移转化 (聚落 -> 迁徙者)
                // 当环境不适宜且无法维持聚落时，转化为迁徙者
                if (newProsperity < attrs.migrationThreshold && newProsperity > 0) {
                    // 只有当周围有空地或者可以共存时才迁移，这里简化为直接转化
                    // 转化后，原聚落消失，变成迁徙者存在于同一格(随后移动)
                    changes.push({x, y, type: 'STATE', value: 0}); // 移除聚落实体
                    changes.push({
                        x, y, type: 'MIGRANT_ADD', 
                        value: { prosperity: newProsperity, attrs: attrs }
                    });
                }
            }

            // --- 3.2 处理迁徙生物 (Migrant) ---
            if (cell.migrant) {
                const migrant = cell.migrant;
                const attrs = migrant.attributes;

                // 迁徙者生存判定 (较宽松，或者消耗繁荣度移动)
                // 简单起见，迁徙者每步消耗少量繁荣度
                let newProsperity = migrant.prosperity - 1; 

                if (newProsperity <= 0) {
                    changes.push({x, y, type: 'MIGRANT_REMOVE'});
                    // 迁徙者死亡也提供少量能量? 暂不提供以免过于复杂
                    continue;
                }

                // 尝试定居 (Settlement)
                // 如果当前位置是空的(EMPTY)，且温度适宜，则定居
                if (cell.crystalState === 'EMPTY' && 
                    cell.temperature >= attrs.minTemp && 
                    cell.temperature <= attrs.maxTemp) {
                    
                    changes.push({x, y, type: 'MIGRANT_REMOVE'});
                    changes.push({
                        x, y, type: 'NEW_BIO', 
                        value: { prosperity: newProsperity, attrs: attrs }
                    });
                    continue;
                }

                // 移动逻辑
                // 寻找温度更好的邻居，且该邻居可以是 EMPTY, ALPHA, BETA, BIO (共存)
                // 但为了避免重叠过于复杂，我们假设迁徙者只是在Grid上移动的数据层
                const validNeighbors = neighbors.filter(n => n.exists);
                if (validNeighbors.length > 0) {
                    // 简单的贪婪算法：找温度最接近最佳温度的邻居
                    const bestTemp = (attrs.minTemp + attrs.maxTemp) / 2;
                    let bestNeighbor = validNeighbors[0];
                    let minDiff = Math.abs(bestNeighbor.temperature - bestTemp);

                    for (const n of validNeighbors) {
                        const diff = Math.abs(n.temperature - bestTemp);
                        if (diff < minDiff) {
                            minDiff = diff;
                            bestNeighbor = n;
                        }
                    }

                    // 移动到最佳邻居 (如果不是当前位置)
                    if (bestNeighbor.x !== x || bestNeighbor.y !== y) {
                        changes.push({x, y, type: 'MIGRANT_REMOVE'});
                        changes.push({
                            x: bestNeighbor.x, y: bestNeighbor.y, 
                            type: 'MIGRANT_ADD', 
                            value: { prosperity: newProsperity, attrs: attrs }
                        });
                    } else {
                        // 原地不动，更新繁荣度
                        changes.push({
                            x, y, type: 'MIGRANT_UPDATE', 
                            value: { prosperity: newProsperity }
                        });
                    }
                } else {
                     changes.push({
                        x, y, type: 'MIGRANT_UPDATE', 
                        value: { prosperity: newProsperity }
                    });
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
            // Legacy migrate type, should not be used with new logic but kept for safety
            if (cell.crystalState === 'EMPTY') {
                cell.crystalState = 'BIO';
                cell.prosperity = change.value.prosperity;
                cell.bioAttributes = change.value.attrs;
            }
        } else if (change.type === 'MIGRANT_ADD') {
            cell.migrant = {
                prosperity: change.value.prosperity,
                attributes: change.value.attrs
            };
        } else if (change.type === 'MIGRANT_UPDATE') {
            if (cell.migrant) {
                cell.migrant.prosperity = change.value.prosperity;
            }
        } else if (change.type === 'MIGRANT_REMOVE') {
            cell.migrant = null;
        }
    }
  }

  distributeExtinctionBonus(x: number, y: number, bonus: number) {
      // 能量仅扩散给周围的晶石或生物，不返还给地幔
      const neighbors = this.getNeighbors(x, y);
      if (neighbors.length === 0) return;

      const bonusPerNeighbor = bonus / neighbors.length;
      
      for (const n of neighbors) {
          if (n.crystalState === 'ALPHA' || n.crystalState === 'BETA') {
              n.storedEnergy += bonusPerNeighbor;
          } else if (n.crystalState === 'BIO') {
              n.prosperity += bonusPerNeighbor;
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
