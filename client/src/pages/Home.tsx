import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_PARAMS, SimulationEngine, SimulationParams, Cell } from "@/lib/simulation/engine";
import * as d3 from "d3";
import { FastForward, HelpCircle, Pause, Play, RefreshCw, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import HumanBehaviorTool, { ToolType } from "@/components/HumanBehaviorTool";
import ConfigManager from "@/components/ConfigManager";
import { useConfigManager } from "@/hooks/useConfigManager";

// 参数说明 (汉化)
const PARAM_INFO: Record<keyof SimulationParams, { desc: string; impact: string }> = {
  mantleTimeScale: { desc: "地幔能量随时间变化的速度", impact: "高: 地形变化快 / 低: 地形稳定" },
  expansionThreshold: { desc: "地形扩张所需的能量阈值", impact: "高: 难以扩张 / 低: 快速扩张" },
  shrinkThreshold: { desc: "地形缩减所需的负能量阈值", impact: "高: 难以缩减 / 低: 快速缩减" },
  mantleEnergyLevel: { desc: "地幔能量相对于晶石需求的倍率", impact: "高: 能量充沛 / 低: 能量匮乏" },
  maxRadius: { desc: "地形扩张的最大半径限制", impact: "高: 地图更大 / 低: 地图更小" },
  minRadius: { desc: "地形缩减的最小半径限制", impact: "高: 核心区域更大 / 低: 核心区域更小" },
  distortionSpeed: { desc: "地幔能量场的扭曲速度", impact: "高: 能量场快速变化 / 低: 能量场缓慢变化" },
  
  diffusionRate: { desc: "温度扩散速度", impact: "高: 温度均匀 / 低: 温差大" },
  advectionRate: { desc: "温度沿梯度流动的速度", impact: "高: 气候移动快 / 低: 气候静止" },
  thunderstormThreshold: { desc: "触发雷暴所需的温差阈值", impact: "高: 雷暴少 / 低: 雷暴多" },
  seasonalAmplitude: { desc: "季节性温度变化的幅度", impact: "高: 季节极端 / 低: 季节温和" },
  
  alphaEnergyDemand: { desc: "Alpha晶石生存所需能量", impact: "高: 难以生存 / 低: 容易生长" },
  betaEnergyDemand: { desc: "Beta晶石所需能量 (未使用)", impact: "N/A" },
  mantleAbsorption: { desc: "吸收地幔能量的效率", impact: "高: 生长快 / 低: 生长慢" },
  thunderstormEnergy: { desc: "雷暴提供的额外能量", impact: "高: 雷暴促进生长 / 低: 雷暴影响小" },
  expansionCost: { desc: "扩张到新地块所需的能量", impact: "高: 扩张慢 / 低: 扩张快" },
  maxCrystalEnergy: { desc: "晶石可存储的最大能量", impact: "高: 生存力强 / 低: 容易硬化" },
  energySharingRate: { desc: "晶石间能量共享的比例", impact: "高: 能量分布均匀 / 低: 能量分布不均" },
  harvestThreshold: { desc: "采集阈值 (自动模拟中未使用)", impact: "N/A" },
  edgeGenerationWidth: { desc: "边缘能量生成的宽度范围（格数）", impact: "高：边缘生成范围更广 / 低：仅在紧邻边缘处生成" },
  edgeGenerationEnergy: { desc: "边缘每格每次迭代生成的能量值", impact: "高：边缘快速扩张 / 低：边缘扩张缓慢" },
  edgeGenerationOffset: { desc: "边缘能量生成的起始偏移（从边缘第几层开始）", impact: "高：能量生成更靠内 / 低：能量生成紧贴边缘" },
  edgeSupplyPointCount: { desc: "边缘能量供给点的数量", impact: "高：多点供给 / 低：少点供给" },
  edgeSupplyPointSpeed: { desc: "边缘供给点的迁移速度", impact: "高：供给点移动快 / 低：供给点移动慢" },
  mantleHeatFactor: { desc: "地幔热量系数", impact: "影响地幔能量转化为地表温度的效率" },
  
  // 人类层参数
  humanMinTemp: { desc: "人类适宜生存的最低温度", impact: "高: 只能在温暖区域生存 / 低: 耐寒能力强" },
  humanMaxTemp: { desc: "人类适宜生存的最高温度", impact: "高: 耐热能力强 / 低: 只能在凉爽区域生存" },
  humanSurvivalMinTemp: { desc: "人类生存的极限低温", impact: "低于此温度人类将直接死亡" },
  humanSurvivalMaxTemp: { desc: "人类生存的极限高温", impact: "高于此温度人类将直接死亡" },
  humanProsperityGrowth: { desc: "适宜环境下的繁荣度增长速度", impact: "高: 发展迅速 / 低: 发展缓慢" },
  humanProsperityDecay: { desc: "恶劣环境下的繁荣度衰减速度", impact: "高: 容易灭绝 / 低: 生存力强" },
  humanExpansionThreshold: { desc: "触发扩张所需的繁荣度阈值", impact: "高: 难以扩张 / 低: 容易扩张" },
  humanMiningReward: { desc: "开采Beta晶石获得的繁荣度奖励", impact: "高: 采矿收益大 / 低: 采矿收益小" },
  humanMigrationThreshold: { desc: "触发迁移的繁荣度阈值", impact: "高: 容易迁移 / 低: 坚守原地" },

  alphaRadiationDamage: { desc: "Alpha辐射伤害", impact: "Alpha晶石对周围人类造成的繁荣度持续伤害" },
  humanSpawnPoint: { desc: "人类重生点坐标", impact: "人类灭绝后重新生成的固定位置" },
  energySharingLimit: { desc: "晶石能量共享上限", impact: "限制单次共享的最大能量值" },
  energyDecayRate: { desc: "能量传输衰减率", impact: "高: 能量传输距离短 / 低: 能量传输距离长" },
  
  // 生物通用参数
  extinctionBonus: { desc: "灭绝能量奖励", impact: "生物灭绝时释放给周围的能量/繁荣度" },
  competitionPenalty: { desc: "种群竞争惩罚", impact: "异种群相邻时，繁荣度较低者的惩罚值" },
  mutationRate: { desc: "变异概率", impact: "新生物产生变异的可能性" },
  mutationStrength: { desc: "变异强度", impact: "变异时属性变化的幅度" },
  newSpeciesThreshold: { desc: "新物种阈值", impact: "属性变化超过此比例时判定为新物种" },
  minProsperityGrowth: { desc: "非人类生物最小增长", impact: "确保随机生成的生物具有最低生存能力" },
  sameSpeciesBonus: { desc: "同种群加成", impact: "相同种群邻居提供的繁荣度加成" },
  humanRespawnDelay: { desc: "人类重生延迟", impact: "人类灭绝后等待多少步才重生" },
  bioAutoSpawnCount: { desc: "自动生成阈值", impact: "当物种数量少于此值时触发自动生成" },
  bioAutoSpawnInterval: { desc: "自动生成间隔", impact: "每隔多少步尝试自动生成新物种" },
  migrantExpansionProb: { desc: "迁徙生成概率", impact: "聚落扩张时生成迁徙者而非新聚落的概率" },
} as Record<keyof SimulationParams, { desc: string; impact: string; }>;

export default function Home() {
  // Config Manager
  const { 
    defaultConfig, 
    savedVersions, 
    saveAsDefault, 
    saveVersion, 
    deleteVersion, 
    loadVersion, 
    resetDefault 
  } = useConfigManager();

  // State
  const [engine, setEngine] = useState(() => new SimulationEngine(50, 50, defaultConfig));
  const [isPlaying, setIsPlaying] = useState(false);
  const [params, setParams] = useState<SimulationParams>(defaultConfig);

  // Sync params with defaultConfig when it changes (e.g. on load)
  useEffect(() => {
    setParams(defaultConfig);
    // Re-initialize engine with new default params if needed, 
    // but usually we just want to update current params.
    // However, for initial load, we want to ensure engine starts with saved default.
  }, [defaultConfig]);
  const [activeLayer, setActiveLayer] = useState<'combined' | 'mantle' | 'climate' | 'crystal' | 'human'>('combined');
  const [stats, setStats] = useState({ timeStep: 0, cycle: 0, fps: 0 });
  const [mapSize, setMapSize] = useState({ width: 50, height: 50 });
  const [isRestartOpen, setIsRestartOpen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 播放速率倍数 (支持小数)
  
  // Human Behavior Tool State
  const [activeTool, setActiveTool] = useState<ToolType>('none');
  const [brushSize, setBrushSize] = useState(3);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  // Initialize D3 Zoom
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = d3.select(canvasRef.current);
    const context = canvasRef.current.getContext('2d');
    
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 10])
      .filter((event) => {
        // 如果当前是摧毁模式
        if (activeTool === 'destroy') {
          // 鼠标左键点击：禁用缩放/拖拽，优先处理点击
          if (event.type === 'mousedown' && event.button === 0) {
            return false;
          }
          // 单指触摸：禁用缩放/拖拽，优先处理触摸操作
          if (event.type === 'touchstart' && event.touches.length === 1) {
            return false;
          }
        }
        // 允许双指缩放/平移，或非摧毁模式下的单指平移
        return !event.ctrlKey && !event.button;
      })
      .touchable(true) // 显式启用触摸支持
      .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        if (!context) return;
        const { transform } = event;
        render(transform);
      });
      
    canvas.call(zoom);
    
    // Initial render
    render(d3.zoomIdentity);
    
    return () => {
      canvas.on(".zoom", null);
    };
  }, [engine, activeLayer]); // Re-bind when engine changes
  
  // Simulation Loop
  const lastUpdateRef = useRef<number>(0); // 上次更新的时间
  
  const animate = (time: number) => {
    if (isPlaying) {
      // 计算时间增量
      const dt = time - lastUpdateRef.current;
      
      // 目标帧间隔 (ms)
      // 如果倍率 >= 1，每帧更新 N 次 (间隔为 0)
      // 如果倍率 < 1，每 1/N 帧更新一次 (间隔为 1000/60 / N)
      // 这里简化逻辑：
      // 基础更新频率假设为 60Hz (约16ms)
      // 累积时间用于处理慢放
      
      if (speedMultiplier >= 1) {
          // 快进模式：每帧执行多次
          for (let i = 0; i < Math.floor(speedMultiplier); i++) {
            engine.update();
          }
          lastUpdateRef.current = time;
      } else {
          // 慢放模式：控制更新频率
          // 目标间隔 = 16.67ms / speedMultiplier
          // 例如 0.5x -> 33.33ms 间隔
          // 例如 0.1x -> 166.67ms 间隔
          const targetInterval = 1000 / 60 / speedMultiplier;
          
          if (dt >= targetInterval) {
              engine.update();
              lastUpdateRef.current = time;
          }
      }
      
      setStats({
        timeStep: engine.timeStep,
        cycle: engine.cycleCount,
        fps: Math.round(1000 / (time - lastTimeRef.current))
      });
    } else {
        lastUpdateRef.current = time;
    }
    lastTimeRef.current = time;
    
    // Render with current zoom transform
    const transform = d3.zoomTransform(canvasRef.current!);
    render(transform);
    
    requestRef.current = requestAnimationFrame(animate);
  };
  
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, engine, activeLayer, speedMultiplier, activeTool, brushSize, canvasSize]); // Dependencies for loop

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);
  
  // Update Params
  useEffect(() => {
    engine.params = params;
  }, [params]);
  
  // Handle Canvas Interaction
  const applyBrush = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const transform = d3.zoomTransform(canvas);
    
    // Calculate click position in canvas coordinates
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    
    // Transform to grid coordinates
    const cellSize = 10;
    const gridWidth = engine.width * cellSize;
    const gridHeight = engine.height * cellSize;
    const offsetX = (canvas.width / transform.k - gridWidth) / 2;
    const offsetY = (canvas.height / transform.k - gridHeight) / 2;
    
    const rawX = (clickX - transform.x) / transform.k - offsetX;
    const rawY = (clickY - transform.y) / transform.k - offsetY;
    
    const gridX = Math.floor(rawX / cellSize);
    const gridY = Math.floor(rawY / cellSize);
    
    if (activeTool === 'spawn_point') {
        if (gridX >= 0 && gridX < engine.width && gridY >= 0 && gridY < engine.height) {
            setParams(prev => ({
                ...prev,
                humanSpawnPoint: { x: gridX, y: gridY }
            }));
            // 立即触发一次渲染以显示红框
            render(transform);
        }
        return;
    }

    if (activeTool === 'destroy') {
        // Apply brush
        const halfBrush = Math.floor(brushSize / 2);
        const startX = gridX - halfBrush;
        const startY = gridY - halfBrush;
        
        let modified = false;
        
        for (let y = startY; y < startY + brushSize; y++) {
          for (let x = startX; x < startX + brushSize; x++) {
            if (x >= 0 && x < engine.width && y >= 0 && y < engine.height) {
              const cell = engine.grid[y][x];
              if (cell.exists && cell.crystalState !== 'EMPTY') {
                cell.crystalState = 'EMPTY';
                cell.crystalEnergy = 0;
                cell.storedEnergy = 0;
                modified = true;
              }
            }
          }
        }
        
        if (modified) {
          // Force re-render
          render(transform);
        }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    applyBrush(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // 仅处理单指触摸，多指用于缩放
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      applyBrush(touch.clientX, touch.clientY);
    }
  };

  // Render Function
  const render = (transform: d3.ZoomTransform) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const cellSize = 10; // Base cell size
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply Zoom/Pan
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);
    
    // Center the grid
    const gridWidth = engine.width * cellSize;
    const gridHeight = engine.height * cellSize;
    const offsetX = (canvas.width / transform.k - gridWidth) / 2;
    const offsetY = (canvas.height / transform.k - gridHeight) / 2;
    ctx.translate(offsetX, offsetY);
    
    // Draw Grid
    for (let y = 0; y < engine.height; y++) {
      for (let x = 0; x < engine.width; x++) {
        const cell = engine.grid[y][x];
        const px = x * cellSize;
        const py = y * cellSize;
        
        if (!cell.exists) {
            // Void
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(px, py, cellSize, cellSize);
            continue;
        }
        
        // Layer Visualization
        if (activeLayer === 'mantle') {
            // Mantle Energy: Black -> Red -> Yellow
            const intensity = cell.mantleEnergy / 100;
            ctx.fillStyle = `rgb(${intensity * 255}, ${intensity * 100}, 0)`;
            ctx.fillRect(px, py, cellSize, cellSize);
        } else if (activeLayer === 'climate') {
            // Temperature Visualization centered on Ideal Human Temp (e.g., 35°C)
            // Ideal (35°C) -> White
            // Hotter (>35°C) -> Red
            // Colder (<35°C) -> Blue
            
            const idealTemp = 35;
            const maxTemp = 85; // 35 + 50
            const minTemp = -15; // 35 - 50
            
            let r, g, b;
            
            if (cell.temperature > idealTemp) {
                // Hotter: White -> Red
                // Normalize (idealTemp, maxTemp] to (0, 1]
                const t = Math.min(1, (cell.temperature - idealTemp) / (maxTemp - idealTemp));
                // White (255,255,255) -> Red (255, 0, 0)
                // R: 255
                // G: 255 * (1-t)
                // B: 255 * (1-t)
                r = 255;
                g = Math.round(255 * (1 - t));
                b = Math.round(255 * (1 - t));
            } else {
                // Colder: Blue -> White
                // Normalize [minTemp, idealTemp) to [0, 1)
                // t=0 (minTemp) -> Blue, t=1 (idealTemp) -> White
                const t = Math.max(0, (cell.temperature - minTemp) / (idealTemp - minTemp));
                // Blue (0, 0, 255) -> White (255, 255, 255)
                // R: 255 * t
                // G: 255 * t
                // B: 255
                r = Math.round(255 * t);
                g = Math.round(255 * t);
                b = 255;
            }
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(px, py, cellSize, cellSize);
            
            // Thunderstorm Overlay
            if (cell.hasThunderstorm) {
                ctx.fillStyle = 'rgba(251, 191, 36, 0.5)'; // Amber with opacity
                ctx.fillRect(px, py, cellSize, cellSize);
            }
        } else if (activeLayer === 'crystal') {
            // Crystal State
            if (cell.crystalState === 'ALPHA') {
                ctx.fillStyle = '#10b981'; // Emerald
                // 能量吸收视觉效果：更亮的中心
                if (cell.isAbsorbing) {
                    ctx.fillStyle = '#34d399'; // Lighter Emerald
                }
            }
            else if (cell.crystalState === 'BETA') {
                ctx.fillStyle = '#64748b'; // Slate
            }
            else ctx.fillStyle = '#404040'; // Empty ground
            
            ctx.fillRect(px, py, cellSize, cellSize);
        } else if (activeLayer === 'human') {
            // Bio Layer Visualization
            if (cell.crystalState === 'BIO' && cell.bioAttributes) {
                // 使用生物种群颜色
                ctx.fillStyle = cell.bioAttributes.color;
                ctx.fillRect(px, py, cellSize, cellSize);
                
                // 繁荣度指示：中心亮度
                const intensity = Math.min(1, cell.prosperity / 100);
                ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.5})`;
                ctx.fillRect(px + cellSize*0.25, py + cellSize*0.25, cellSize*0.5, cellSize*0.5);
            } else {
                // Background: Temperature suitability (Subtle)
                // Ideal (20°C) -> Greenish tint
                const idealTemp = 20;
                const diff = Math.abs(cell.temperature - idealTemp);
                if (diff < 10) {
                    ctx.fillStyle = `rgba(34, 197, 94, ${0.1 * (1 - diff/10)})`; // Green-500 with low opacity
                    ctx.fillRect(px, py, cellSize, cellSize);
                } else {
                    ctx.fillStyle = '#1a1a1a';
                    ctx.fillRect(px, py, cellSize, cellSize);
                }
            }
        } else {
            // Combined View
            // Base: Ground (Dark Grey)
            // Overlay: Transparent Mantle (Red/Yellow)
            // Overlay: Crystal
            // Overlay: Thunderstorm
            
            // Ground Base
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(px, py, cellSize, cellSize);

            // Transparent Mantle Overlay
            const mantleIntensity = Math.min(1, cell.mantleEnergy / 150); // Normalize to 0-1
            if (mantleIntensity > 0.1) {
                // Red-ish glow for mantle energy
                ctx.fillStyle = `rgba(255, ${mantleIntensity * 100}, 0, ${mantleIntensity * 0.4})`;
                ctx.fillRect(px, py, cellSize, cellSize);
            }
            
            // Crystal & Human
            if (cell.crystalState === 'ALPHA') {
                ctx.fillStyle = '#10b981';
                // 能量吸收视觉效果：白色边框
                if (cell.isAbsorbing) {
                    ctx.fillStyle = '#34d399';
                }
                ctx.fillRect(px, py, cellSize, cellSize);
            } else if (cell.crystalState === 'BETA') {
                ctx.fillStyle = '#64748b';
                ctx.fillRect(px, py, cellSize, cellSize);
            } else if (cell.crystalState === 'BIO' && cell.bioAttributes) {
                // Bio Settlements: Species Color
                ctx.fillStyle = cell.bioAttributes.color;
                ctx.fillRect(px, py, cellSize, cellSize);
                
                // 字母标记
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(8, cellSize * 0.8)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                if (cell.bioAttributes.speciesId === 0) {
                    // 人类特殊标记 'X'
                    ctx.fillText('X', px + cellSize/2, py + cellSize/2);
                } else {
                    // 其他物种使用 A-Z
                    const charCode = 65 + (cell.bioAttributes.speciesId % 26);
                    ctx.fillText(String.fromCharCode(charCode), px + cellSize/2, py + cellSize/2);
                }
            }
            
            // Thunderstorm overlay
            if (cell.hasThunderstorm) {
                ctx.fillStyle = 'rgba(251, 191, 36, 0.4)'; // Amber with opacity
                ctx.fillRect(px, py, cellSize, cellSize);
            }
        }
      }

      // 绘制重生点红框
      if (params.humanSpawnPoint) {
          const { x, y } = params.humanSpawnPoint;
          const px = x * cellSize;
          const py = y * cellSize;
          
          ctx.strokeStyle = '#ef4444'; // Red-500
          ctx.lineWidth = 2;
          ctx.strokeRect(px - 1, py - 1, cellSize + 2, cellSize + 2);
          
          // 绘制一个小标记
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(px + cellSize/2, py - 5);
          ctx.lineTo(px + cellSize/2 - 4, py - 10);
          ctx.lineTo(px + cellSize/2 + 4, py - 10);
          ctx.fill();
      }
    }

    // Render Spawn Point
    if ((activeLayer === 'human' || activeLayer === 'combined') && engine.params.humanSpawnPoint) {
        const { x, y } = engine.params.humanSpawnPoint;
        const px = x * cellSize;
        const py = y * cellSize;
        
        // Draw spawn point marker (Star or Crosshair)
        ctx.strokeStyle = '#f97316'; // Orange-500
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + cellSize, py + cellSize);
        ctx.moveTo(px + cellSize, py);
        ctx.lineTo(px, py + cellSize);
        ctx.stroke();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 2, py - 2, cellSize + 4, cellSize + 4);
    }

    // Draw Migrants (Overlay on Bio or Combined layer)
    if (activeLayer === 'bio' || activeLayer === 'combined') {
        for (let y = 0; y < engine.height; y++) {
            for (let x = 0; x < engine.width; x++) {
                const cell = engine.grid[y][x];
                if (!cell.exists || !cell.migrant) continue;

                const px = x * cellSize;
                const py = y * cellSize;
                const migrant = cell.migrant;
                
                // Draw Migrant as a small circle or dot
                ctx.fillStyle = migrant.attributes.color || '#ffffff';
                ctx.beginPath();
                ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize / 3, 0, Math.PI * 2);
                ctx.fill();
                
                // Optional: Add a border to distinguish from settlements
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    // Draw Energy Flow (Overlay on Crystal or Combined layer)
    if (activeLayer === 'crystal' || activeLayer === 'combined') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let y = 0; y < engine.height; y++) {
            for (let x = 0; x < engine.width; x++) {
                const cell = engine.grid[y][x];
                if (!cell.exists || !cell.energyFlow || cell.energyFlow.length === 0) continue;
                
                const startX = x * cellSize + cellSize / 2;
                const startY = y * cellSize + cellSize / 2;
                
                for (const flow of cell.energyFlow) {
                    // 只绘制显著的能量流
                    if (flow.amount < 0.05) continue;
                    
                    const endX = flow.x * cellSize + cellSize / 2;
                    const endY = flow.y * cellSize + cellSize / 2;
                    
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                }
            }
        }
        ctx.stroke();
    }
    
    ctx.restore();
  };
  
  const handleRestart = () => {
    const newEngine = new SimulationEngine(mapSize.width, mapSize.height, params);
    setEngine(newEngine);
    setStats({ timeStep: 0, cycle: 0, fps: 0 });
    setIsRestartOpen(false);
    
    // Reset Zoom
    if (canvasRef.current) {
      const canvas = d3.select(canvasRef.current);
      canvas.call(d3.zoom<HTMLCanvasElement, unknown>().transform, d3.zoomIdentity);
    }
  };
  
  const resetParams = () => {
      setParams(DEFAULT_PARAMS);
  };

  const ParamControl = ({ label, paramKey, min, max, step }: { label: string, paramKey: keyof SimulationParams, min: number, max: number, step: number }) => {
    const value = params[paramKey];
    // 确保 value 是数字，如果是对象（如 humanSpawnPoint）则不渲染 Slider 或渲染特殊控件
    if (typeof value !== 'number') return null;

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs items-center">
          <div className="flex items-center gap-1">
              <span>{label}</span>
              <Tooltip>
                  <TooltipTrigger>
                      <HelpCircle className="w-3 h-3 text-neutral-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-neutral-800 border-neutral-700 text-neutral-200">
                      <p className="font-bold mb-1">{PARAM_INFO[paramKey]?.desc || label}</p>
                      <p className="text-xs text-neutral-400">{PARAM_INFO[paramKey]?.impact || ''}</p>
                  </TooltipContent>
              </Tooltip>
          </div>
          <span>{value}</span>
        </div>
        <Slider 
          min={min} max={max} step={step} 
          value={[value]} 
          onValueChange={([v]) => setParams({...params, [paramKey]: v})}
        />
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-200 font-mono overflow-hidden">
      {/* Header / Toolbar */}
      <header className="h-14 border-b border-neutral-800 flex items-center px-4 justify-between bg-neutral-900 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-neutral-100">世界变迁模拟器</h1>
          <div className="h-6 w-px bg-neutral-800" />
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>步数: <span className="text-neutral-100 w-12 inline-block">{stats.timeStep}</span></span>
            <span>循环: <span className="text-neutral-100 w-8 inline-block">{stats.cycle}</span></span>
            <span>FPS: <span className="text-neutral-100 w-8 inline-block">{stats.fps}</span></span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 播放速率控制 */}
          <div className="flex items-center gap-1 mr-2 bg-neutral-800 rounded px-2 py-1">
            <span className="text-xs text-neutral-400">速率:</span>
            
            {/* 慢放选项 */}
            <Button 
                variant={speedMultiplier === 0.05 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-8 text-[10px]"
                onClick={() => setSpeedMultiplier(0.05)}
            >0.05x</Button>
            <Button 
                variant={speedMultiplier === 0.2 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-8 text-[10px]"
                onClick={() => setSpeedMultiplier(0.2)}
            >0.2x</Button>
            
            <div className="w-px h-4 bg-neutral-700 mx-1"></div>
            
            {/* 正常/快进选项 */}
            <Button 
                variant={speedMultiplier === 1 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-6 text-xs"
                onClick={() => setSpeedMultiplier(1)}
            >1x</Button>
            <Button 
                variant={speedMultiplier === 2 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-6 text-xs"
                onClick={() => setSpeedMultiplier(2)}
            >2x</Button>
            <Button 
                variant={speedMultiplier === 5 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-6 text-xs"
                onClick={() => setSpeedMultiplier(5)}
            >5x</Button>
            <Button 
                variant={speedMultiplier === 10 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-6 text-xs"
                onClick={() => setSpeedMultiplier(10)}
            >10x</Button>
          </div>

          <Button 
            variant={isPlaying ? "secondary" : "default"} 
            size="sm" 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-24"
          >
            {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isPlaying ? "暂停" : "播放"}
          </Button>
          
          <Dialog open={isRestartOpen} onOpenChange={setIsRestartOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                重启
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
              <DialogHeader>
                <DialogTitle>重启模拟</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>宽度</Label>
                    <Input 
                      type="number" 
                      value={mapSize.width} 
                      onChange={(e) => setMapSize({...mapSize, width: parseInt(e.target.value) || 50})}
                      className="bg-neutral-950 border-neutral-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>高度</Label>
                    <Input 
                      type="number" 
                      value={mapSize.height} 
                      onChange={(e) => setMapSize({...mapSize, height: parseInt(e.target.value) || 50})}
                      className="bg-neutral-950 border-neutral-800"
                    />
                  </div>
                </div>
                <div className="text-sm text-neutral-400">
                  注意：重启将重置所有模拟状态，但保留当前参数设置。
                </div>
              </div>
              <Button onClick={() => {
                setEngine(new SimulationEngine(mapSize.width, mapSize.height, params));
                setStats({ timeStep: 0, cycle: 0, fps: 0 });
                setIsRestartOpen(false);
              }}>
                确认重启
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 z-20">
          <Tabs defaultValue="layers" className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b border-neutral-800 p-0 h-10">
              <TabsTrigger value="layers" className="flex-1 rounded-none data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100 border-b-2 border-transparent data-[state=active]:border-blue-500">图层</TabsTrigger>
              <TabsTrigger value="params" className="flex-1 rounded-none data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100 border-b-2 border-transparent data-[state=active]:border-blue-500">参数</TabsTrigger>
              <TabsTrigger value="config" className="flex-1 rounded-none data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100 border-b-2 border-transparent data-[state=active]:border-blue-500">配置</TabsTrigger>
            </TabsList>
            
            <TabsContent value="layers" className="flex-1 p-4 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-neutral-500 font-bold">视图模式</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant={activeLayer === 'combined' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('combined')}
                    className="justify-start"
                  >
                    综合视图
                  </Button>
                  <Button 
                    variant={activeLayer === 'mantle' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('mantle')}
                    className="justify-start text-red-400 border-red-900/30 hover:bg-red-900/20"
                  >
                    地幔层
                  </Button>
                  <Button 
                    variant={activeLayer === 'climate' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('climate')}
                    className="justify-start text-blue-400 border-blue-900/30 hover:bg-blue-900/20"
                  >
                    气候层
                  </Button>
                  <Button 
                    variant={activeLayer === 'crystal' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('crystal')}
                    className="justify-start text-emerald-400 border-emerald-900/30 hover:bg-emerald-900/20"
                  >
                    晶石层
                  </Button>
                  <Button 
                    variant={activeLayer === 'human' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('human')}
                    className="justify-start text-orange-400 border-orange-900/30 hover:bg-orange-900/20 col-span-2"
                  >
                    生物层
                  </Button>
                </div>
              </div>
              
              {/* 物种列表 */}
              <div className="space-y-2">
                  <Label className="text-xs uppercase text-neutral-500 font-bold">当前物种</Label>
                  <div className="bg-neutral-950 rounded border border-neutral-800 overflow-hidden">
                      <table className="w-full text-xs text-left">
                          <thead className="bg-neutral-900 text-neutral-400">
                              <tr>
                                  <th className="p-2 font-medium">ID</th>
                                  <th className="p-2 font-medium">颜色</th>
                                  <th className="p-2 font-medium">数量</th>
                              </tr>
                          </thead>
                          <tbody>
                              {(() => {
                                  const speciesCounts = new Map<number, {count: number, color: string}>();
                                  for (let y = 0; y < engine.height; y++) {
                                      for (let x = 0; x < engine.width; x++) {
                                          const cell = engine.grid[y][x];
                                          if (cell.crystalState === 'BIO' && cell.bioAttributes) {
                                              const id = cell.bioAttributes.speciesId;
                                              const current = speciesCounts.get(id) || {count: 0, color: cell.bioAttributes.color};
                                              current.count++;
                                              speciesCounts.set(id, current);
                                          }
                                      }
                                  }
                                  
                                  if (speciesCounts.size === 0) {
                                      return <tr><td colSpan={3} className="p-2 text-center text-neutral-500">无生物存活</td></tr>;
                                  }

                                  return Array.from(speciesCounts.entries()).map(([id, info]) => (
                                      <tr key={id} className="border-t border-neutral-800">
                                          <td className="p-2 font-mono">{id === 0 ? '人类' : String.fromCharCode(65 + (id % 26))}</td>
                                          <td className="p-2">
                                              <div className="w-3 h-3 rounded-full" style={{backgroundColor: info.color}}></div>
                                          </td>
                                          <td className="p-2">{info.count}</td>
                                      </tr>
                                  ));
                              })()}
                          </tbody>
                      </table>
                  </div>
              </div>

              <div className="p-4 bg-neutral-950 rounded border border-neutral-800 text-xs space-y-2">
                <div className="font-bold text-neutral-400">图例</div>
                {activeLayer === 'combined' && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500"></div> Alpha 晶石</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-500"></div> Beta 晶石</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500/50"></div> 雷暴区域</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 border border-white/50"></div> 正在吸收能量</div>
                  </>
                )}
                {activeLayer === 'human' && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500"></div> 人类聚落 (高繁荣)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-900"></div> 人类聚落 (低繁荣)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500/30"></div> 适宜温度区</div>
                  </>
                )}
                {activeLayer === 'mantle' && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600"></div> 高能量</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-900"></div> 低能量</div>
                  </>
                )}
                {activeLayer === 'climate' && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500"></div> 炎热 (&gt;25°C)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white"></div> 适宜 (0°C)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500"></div> 寒冷 (&lt;-25°C)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500"></div> 雷暴区域</div>
                  </>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="config" className="flex-1 p-4 space-y-6 overflow-y-auto">
              <ConfigManager 
                currentParams={params}
                onLoadParams={(p) => {
                  setParams(p);
                  // 重启引擎以应用某些需要初始化的参数（如供给点数量）
                  setEngine(new SimulationEngine(mapSize.width, mapSize.height, p));
                  setStats({ timeStep: 0, cycle: 0, fps: 0 });
                  setIsPlaying(false);
                }}
                onSaveDefault={saveAsDefault}
                onResetDefault={() => {
                  const p = resetDefault();
                  setParams(p);
                }}
                savedVersions={savedVersions}
                onSaveVersion={saveVersion}
                onDeleteVersion={deleteVersion}
              />
            </TabsContent>

            <TabsContent value="params" className="flex-1 p-4 space-y-6 overflow-y-auto">
              <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetParams} className="text-xs h-6">
                      <RotateCcw className="w-3 h-3 mr-1" /> 恢复默认
                  </Button>
              </div>
              
              {/* 地幔层参数 */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-red-500 font-bold">地幔层参数</Label>
                <ParamControl label="能量等级" paramKey="mantleEnergyLevel" min={1} max={200} step={1} />
                <ParamControl label="扩张阈值" paramKey="expansionThreshold" min={1} max={300} step={1} />
                <ParamControl label="缩减阈值" paramKey="shrinkThreshold" min={1} max={300} step={1} />
                <ParamControl label="最大半径" paramKey="maxRadius" min={10} max={40} step={1} />
                <ParamControl label="最小半径" paramKey="minRadius" min={0} max={20} step={1} />
                <ParamControl label="扭曲速度" paramKey="distortionSpeed" min={0} max={0.05} step={0.001} />
                <ParamControl label="边缘生成宽度" paramKey="edgeGenerationWidth" min={0} max={10} step={1} />
                <ParamControl label="边缘生成偏移" paramKey="edgeGenerationOffset" min={0} max={20} step={1} />
                <ParamControl label="边缘生成能量" paramKey="edgeGenerationEnergy" min={0} max={20} step={0.1} />
                <ParamControl label="供给点数量(需重启)" paramKey="edgeSupplyPointCount" min={1} max={10} step={1} />
                <ParamControl label="供给点迁移速度" paramKey="edgeSupplyPointSpeed" min={0} max={0.5} step={0.01} />
                <ParamControl label="地幔热量系数" paramKey="mantleHeatFactor" min={0} max={200} step={1} />
              </div>
              
              {/* 气候层参数 */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-blue-500 font-bold">气候层参数</Label>
                <ParamControl label="扩散速度" paramKey="diffusionRate" min={0} max={1.0} step={0.01} />
                <ParamControl label="雷暴阈值" paramKey="thunderstormThreshold" min={1} max={100} step={1} />
              </div>
              
              {/* 晶石层参数 */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-emerald-500 font-bold">晶石层参数</Label>
                <ParamControl label="Alpha生存需求" paramKey="alphaEnergyDemand" min={1} max={10} step={0.1} />
                <ParamControl label="扩张消耗" paramKey="expansionCost" min={1} max={20} step={0.5} />
                  <ParamControl label="能量上限" paramKey="maxCrystalEnergy" min={10} max={200} step={5} />
                  <ParamControl label="雷暴能量" paramKey="thunderstormEnergy" min={0} max={50} step={1} />
                  <ParamControl label="能量共享率" paramKey="energySharingRate" min={0} max={2.0} step={0.01} />
                  <ParamControl label="能量衰减率" paramKey="energyDecayRate" min={0} max={0.5} step={0.01} />
              </div>

              {/* 人类层参数 */}
                <div className="space-y-3">
                  <Label className="text-xs uppercase text-orange-500 font-bold">人类层参数</Label>
                  <ParamControl label="适宜温度下限" paramKey="humanMinTemp" min={-50} max={50} step={1} />
                  <ParamControl label="适宜温度上限" paramKey="humanMaxTemp" min={-50} max={50} step={1} />
                  <ParamControl label="生存温度下限" paramKey="humanSurvivalMinTemp" min={-50} max={50} step={1} />
                  <ParamControl label="生存温度上限" paramKey="humanSurvivalMaxTemp" min={-50} max={50} step={1} />
                  <ParamControl label="繁荣度增长" paramKey="humanProsperityGrowth" min={0} max={5} step={0.1} />
                  <ParamControl label="繁荣度衰减" paramKey="humanProsperityDecay" min={0} max={5} step={0.1} />
                  <ParamControl label="扩张阈值" paramKey="humanExpansionThreshold" min={10} max={200} step={5} />
                  <ParamControl label="采矿奖励" paramKey="humanMiningReward" min={0} max={100} step={1} />
                  <ParamControl label="迁移阈值" paramKey="humanMigrationThreshold" min={0} max={100} step={1} />

                  <ParamControl label="Alpha辐射伤害" paramKey="alphaRadiationDamage" min={0} max={20} step={0.5} />
                  <ParamControl label="人类重生延迟" paramKey="humanRespawnDelay" min={10} max={200} step={10} />
                </div>
                
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground">生物演化参数</h3>
                  <ParamControl label="灭绝奖励" paramKey="extinctionBonus" min={0} max={200} step={5} />
                  <ParamControl label="竞争惩罚" paramKey="competitionPenalty" min={0} max={20} step={0.5} />
                  <ParamControl label="变异概率" paramKey="mutationRate" min={0} max={1} step={0.01} />
                  <ParamControl label="变异强度" paramKey="mutationStrength" min={0} max={1} step={0.01} />
                  <ParamControl label="新物种阈值" paramKey="newSpeciesThreshold" min={0} max={1} step={0.05} />
                  <ParamControl label="最小增长" paramKey="minProsperityGrowth" min={0} max={20} step={0.5} />
                  <ParamControl label="同种群加成" paramKey="sameSpeciesBonus" min={0} max={10} step={0.1} />
                  <ParamControl label="自动生成阈值" paramKey="bioAutoSpawnCount" min={0} max={20} step={1} />
                  <ParamControl label="自动生成间隔" paramKey="bioAutoSpawnInterval" min={1} max={100} step={1} />
                  <ParamControl label="迁徙生成概率" paramKey="migrantExpansionProb" min={0} max={1} step={0.05} />
                </div>
            </TabsContent>
          </Tabs>
        </aside>
        
        {/* Main Canvas Area */}
        <main 
          ref={containerRef}
          className={`flex-1 bg-black relative overflow-hidden ${activeTool === 'destroy' ? 'cursor-crosshair' : 'cursor-move'}`}
        >
          <div className="absolute top-4 right-4 z-10">
            <HumanBehaviorTool 
              activeTool={activeTool}
              onToolChange={setActiveTool}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
            />
          </div>
          <canvas 
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="block touch-none" // 禁用浏览器默认触摸行为
            onClick={handleCanvasClick}
            onTouchStart={handleTouchStart}
          />
          
          {/* Overlay Controls */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <Button variant="secondary" size="icon" onClick={() => {
               const canvas = d3.select(canvasRef.current);
               canvas.transition().duration(750).call(d3.zoom<HTMLCanvasElement, unknown>().scaleBy as any, 1.2);
            }}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => {
               const canvas = d3.select(canvasRef.current);
               canvas.transition().duration(750).call(d3.zoom<HTMLCanvasElement, unknown>().scaleBy as any, 0.8);
            }}>
              <ZoomOut className="w-4 h-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
