import { useEffect, useRef, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SimulationEngine, DEFAULT_PARAMS, SimulationParams, Cell } from '@/lib/simulation/engine';
import { Play, Pause, RotateCcw, Layers, Settings, Activity, Info } from 'lucide-react';
import HumanBehaviorTool, { ToolType } from '@/components/HumanBehaviorTool';
import * as d3 from 'd3';

// 参数说明配置
const PARAM_INFO: Record<keyof SimulationParams, { desc: string, impact: string }> = {
  mantleTimeScale: { desc: "地幔变化时间尺度", impact: "控制地幔能量变化的快慢" },
  expansionThreshold: { desc: "地幔扩张阈值", impact: "能量高于此值时地壳扩张" },
  shrinkThreshold: { desc: "地幔收缩阈值", impact: "能量低于此值时地壳收缩" },
  mantleEnergyLevel: { desc: "地幔基础能量水平", impact: "决定整体能量的基准线" },
  maxRadius: { desc: "最大半径", impact: "地壳扩张的最大范围" },
  minRadius: { desc: "最小半径", impact: "地壳收缩的最小范围" },
  distortionSpeed: { desc: "扭曲速度", impact: "噪声纹理移动的速度" },
  edgeGenerationWidth: { desc: "边缘生成宽度", impact: "边缘能量生成的范围" },
  edgeGenerationEnergy: { desc: "边缘生成能量", impact: "边缘生成的能量强度" },
  edgeGenerationOffset: { desc: "边缘生成偏移", impact: "边缘生成的偏移量" },
  edgeSupplyPointCount: { desc: "边缘供给点数量", impact: "边缘能量供给点的个数" },
  edgeSupplyPointSpeed: { desc: "边缘供给点速度", impact: "供给点移动的速度" },
  mantleHeatFactor: { desc: "地幔热量系数", impact: "地幔能量对地表温度的影响程度 (0-200)" },
  
  diffusionRate: { desc: "热扩散率", impact: "温度向周围扩散的速度" },
  advectionRate: { desc: "热平流率", impact: "温度随风流动的速度" },
  thunderstormThreshold: { desc: "雷暴阈值", impact: "触发雷暴所需的能量差" },
  seasonalAmplitude: { desc: "季节振幅", impact: "季节变化对温度的影响幅度" },
  
  alphaEnergyDemand: { desc: "Alpha晶石能量需求", impact: "维持Alpha晶石所需的能量" },
  betaEnergyDemand: { desc: "Beta晶石能量需求", impact: "维持Beta晶石所需的能量" },
  mantleAbsorption: { desc: "地幔吸收率", impact: "晶石从地幔吸收能量的效率" },
  thunderstormEnergy: { desc: "雷暴能量", impact: "雷暴为晶石补充的能量" },
  expansionCost: { desc: "扩张消耗", impact: "晶石扩张时消耗的能量" },
  maxCrystalEnergy: { desc: "最大晶石能量", impact: "晶石能储存的最大能量" },
  energySharingRate: { desc: "能量共享率", impact: "晶石间能量传递的效率" },
  harvestThreshold: { desc: "采集阈值", impact: "晶石可被采集的能量阈值" },
  
  extinctionBonus: { desc: "灭绝奖励", impact: "生物灭绝时释放给环境的能量" },
  competitionPenalty: { desc: "种群竞争惩罚", impact: "异种群相邻时，繁荣度较低者的惩罚值" },
  mutationRate: { desc: "变异概率", impact: "新生物产生变异的可能性" },
  mutationStrength: { desc: "变异强度", impact: "变异时属性变化的幅度" },
  newSpeciesThreshold: { desc: "新物种阈值", impact: "属性变化超过此比例时判定为新物种" },
  minProsperityGrowth: { desc: "非人类生物最小增长", impact: "确保随机生成的生物具有最低生存能力" },
  sameSpeciesBonus: { desc: "同种群加成", impact: "相同种群邻居提供的繁荣度加成" },

  humanMinTemp: { desc: "适宜温度下限", impact: "低于此温度繁荣度下降" },
  humanMaxTemp: { desc: "适宜温度上限", impact: "高于此温度繁荣度下降" },
  humanSurvivalMinTemp: { desc: "生存温度下限", impact: "低于此温度直接死亡" },
  humanSurvivalMaxTemp: { desc: "生存温度上限", impact: "高于此温度直接死亡" },
  humanProsperityGrowth: { desc: "适宜环境下的繁荣度增长速度", impact: "高: 发展迅速 / 低: 发展缓慢" },
  humanProsperityDecay: { desc: "恶劣环境下的繁荣度衰减速度", impact: "高: 容易灭绝 / 低: 生存力强" },
  humanExpansionThreshold: { desc: "触发扩张所需的繁荣度阈值", impact: "高: 难以扩张 / 低: 容易扩张" },
  humanMiningReward: { desc: "开采Beta晶石获得的繁荣度奖励", impact: "高: 采矿收益大 / 低: 采矿收益小" },
  humanMigrationThreshold: { desc: "迁移阈值", impact: "繁荣度超过此值时尝试迁移" },
  alphaRadiationDamage: { desc: "Alpha辐射伤害", impact: "Alpha晶石对周围生物造成的伤害" },
  humanRespawnDelay: { desc: "人类重生延迟", impact: "人类灭绝后等待多少步重生" },
  humanSpawnPoint: { desc: "人类重生点坐标", impact: "人类灭绝后重新生成的固定位置" },
  energySharingLimit: { desc: "晶石能量共享上限", impact: "限制单次共享的最大能量值" },
  energyDecayRate: { desc: "能量传输衰减率", impact: "高: 能量传输距离短 / 低: 能量传输距离长" },
};

export default function Home() {
  // Config Manager
  const { 
    params, 
    updateParam, 
    resetParams 
  } = useSimulationParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stats, setStats] = useState({ step: 0, cycle: 0, fps: 0 });
  const [activeLayer, setActiveLayer] = useState<'combined' | 'mantle' | 'climate' | 'crystal' | 'human'>('combined');
  const [activeTool, setActiveTool] = useState<ToolType>('none');
  const [brushSize, setBrushSize] = useState(1);
  const [speciesList, setSpeciesList] = useState<{id: number, color: string, count: number}[]>([]);

  // Initialize Engine
  useEffect(() => {
    if (!canvasRef.current || engineRef.current) return;
    
    const engine = new SimulationEngine(100, 100);
    engineRef.current = engine;
    
    // Initial Render
    render();
  }, []);

  // Sync Params
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateParams(params);
    }
  }, [params]);

  // Animation Loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();
    let frames = 0;
    let lastFpsTime = lastTime;

    const loop = (time: number) => {
      if (isPlaying && engineRef.current) {
        engineRef.current.update();
        setStats(prev => ({
          ...prev,
          step: engineRef.current!.timeStep,
          cycle: engineRef.current!.cycleCount
        }));
        
        // Update species list every 10 steps
        if (engineRef.current.timeStep % 10 === 0) {
            updateSpeciesList();
        }
      }

      render();

      // FPS Calculation
      frames++;
      if (time - lastFpsTime >= 1000) {
        setStats(prev => ({ ...prev, fps: frames }));
        frames = 0;
        lastFpsTime = time;
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, activeLayer, params.humanSpawnPoint]); // Add humanSpawnPoint dependency to re-render when it changes

  const updateSpeciesList = () => {
      if (!engineRef.current) return;
      const speciesMap = new Map<number, {color: string, count: number}>();
      
      for (let y = 0; y < engineRef.current.height; y++) {
          for (let x = 0; x < engineRef.current.width; x++) {
              const cell = engineRef.current.grid[y][x];
              if (cell.crystalState === 'BIO' && cell.bioAttributes) {
                  const id = cell.bioAttributes.speciesId;
                  if (!speciesMap.has(id)) {
                      speciesMap.set(id, {color: cell.bioAttributes.color, count: 0});
                  }
                  speciesMap.get(id)!.count++;
              }
          }
      }
      
      const list = Array.from(speciesMap.entries()).map(([id, info]) => ({
          id,
          color: info.color,
          count: info.count
      })).sort((a, b) => a.id - b.id); // Sort by ID, Human (0) first
      
      setSpeciesList(list);
  };

  const render = () => {
    if (!canvasRef.current || !engineRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { width, height, grid } = engineRef.current;
    const cellSize = canvasRef.current.width / width;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];
        const px = x * cellSize;
        const py = y * cellSize;

        if (!cell.exists) {
            ctx.fillStyle = '#000';
            ctx.fillRect(px, py, cellSize, cellSize);
            continue;
        }

        if (activeLayer === 'mantle') {
            // Mantle Energy Visualization
            // 0 (Black) -> 100 (Red) -> 200 (Yellow)
            const energy = cell.mantleEnergy;
            const r = Math.min(255, energy * 2.55);
            const g = Math.max(0, Math.min(255, (energy - 100) * 2.55));
            ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
            ctx.fillRect(px, py, cellSize, cellSize);
        } else if (activeLayer === 'climate') {
            // Temperature Visualization
            // -50 (Blue) -> 0 (White) -> 50 (Red)
            const temp = cell.temperature;
            if (temp < 0) {
                const intensity = Math.min(1, Math.abs(temp) / 50);
                ctx.fillStyle = `rgba(59, 130, 246, ${intensity})`; // Blue-500
            } else {
                const intensity = Math.min(1, temp / 50);
                ctx.fillStyle = `rgba(239, 68, 68, ${intensity})`; // Red-500
            }
            ctx.fillRect(px, py, cellSize, cellSize);
        } else if (activeLayer === 'crystal') {
            // Crystal Layer Visualization
            if (cell.crystalState === 'ALPHA') {
                ctx.fillStyle = '#10b981'; // Emerald-500
                // Energy Level Opacity
                const energyRatio = cell.storedEnergy / params.maxCrystalEnergy;
                ctx.globalAlpha = 0.5 + energyRatio * 0.5;
                ctx.fillRect(px, py, cellSize, cellSize);
                ctx.globalAlpha = 1.0;
                
                if (cell.isAbsorbing) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px, py, cellSize, cellSize);
                }
            } 
            else if (cell.crystalState === 'BETA') {
                ctx.fillStyle = '#64748b'; // Slate-500
                ctx.fillRect(px, py, cellSize, cellSize);
            }
            else {
                ctx.fillStyle = '#1f2937'; // Gray-800
                ctx.fillRect(px, py, cellSize, cellSize);
            }
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
                // 使用 speciesId 生成一个字母 (A-Z)
                const charCode = 65 + (cell.bioAttributes.speciesId % 26);
                ctx.fillText(String.fromCharCode(charCode), px + cellSize/2, py + cellSize/2);
            }
            
            // Thunderstorm overlay
            if (cell.hasThunderstorm) {
                ctx.fillStyle = 'rgba(251, 191, 36, 0.4)'; // Amber with opacity
                ctx.fillRect(px, py, cellSize, cellSize);
            }
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
        ctx.lineTo(px + cellSize/2 + 4, py - 9);
        ctx.lineTo(px + cellSize/2 - 4, py - 9);
        ctx.fill();
    }
  };

  // Handle Canvas Interactions
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !engineRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      
      const x = Math.floor((e.clientX - rect.left) * scaleX / (canvasRef.current.width / engineRef.current.width));
      const y = Math.floor((e.clientY - rect.top) * scaleY / (canvasRef.current.height / engineRef.current.height));
      
      if (x >= 0 && x < engineRef.current.width && y >= 0 && y < engineRef.current.height) {
          applyBrush(x, y);
      }
  };

  const applyBrush = (cx: number, cy: number) => {
      if (!engineRef.current) return;
      
      // 如果是设置重生点模式
      if (activeTool === 'spawn_point') {
          updateParam('humanSpawnPoint', { x: cx, y: cy });
          return;
      }

      const r = Math.floor(brushSize / 2);
      
      for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
              const x = cx + dx;
              const y = cy + dy;
              
              if (x >= 0 && x < engineRef.current.width && y >= 0 && y < engineRef.current.height) {
                  const cell = engineRef.current.grid[y][x];
                  if (!cell.exists) continue;

                  if (activeTool === 'destroy') {
                      cell.crystalState = 'EMPTY';
                      cell.prosperity = 0;
                      cell.bioAttributes = undefined;
                  }
              }
          }
      }
      render();
  };

  // Helper Component for Sliders
  const ParamControl = ({ label, paramKey, min, max, step }: { label: string, paramKey: keyof SimulationParams, min: number, max: number, step: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
            {label}
            <div className="group relative">
                <Info className="w-3 h-3 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg border z-50">
                    <p className="font-bold">{PARAM_INFO[paramKey]?.desc}</p>
                    <p className="text-muted-foreground mt-1">{PARAM_INFO[paramKey]?.impact}</p>
                </div>
            </div>
        </Label>
        <span className="text-xs font-mono">
            {typeof params[paramKey] === 'number' 
                ? (params[paramKey] as number).toFixed(step < 0.1 ? 2 : 1) 
                : JSON.stringify(params[paramKey])}
        </span>
      </div>
      <Slider 
        value={[params[paramKey] as number]} 
        min={min} 
        max={max} 
        step={step}
        onValueChange={([val]) => updateParam(paramKey, val)}
      />
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
        {/* Top Bar */}
        <header className="absolute top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-md border-b border-border z-10 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h1 className="font-bold text-lg tracking-tight">世界变迁模拟器</h1>
                <div className="ml-4 flex gap-4 text-xs font-mono text-muted-foreground">
                    <span>步数: {stats.step}</span>
                    <span>循环: {stats.cycle}</span>
                    <span>FPS: {stats.fps}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-secondary/50 rounded-md p-1 mr-2">
                    <span className="text-xs px-2 text-muted-foreground">速率:</span>
                    {[0.05, 0.2, 1, 2].map(speed => (
                        <button 
                            key={speed}
                            onClick={() => {
                                // 简单实现：通过调整requestAnimationFrame的跳过逻辑或engine内部步长
                                // 这里暂时仅作为UI展示，实际变速需修改Engine
                            }}
                            className="text-xs px-2 py-0.5 hover:bg-background rounded transition-colors"
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
                <Button 
                    variant={isPlaying ? "secondary" : "default"}
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                    {isPlaying ? "暂停" : "播放"}
                </Button>
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                        engineRef.current = new SimulationEngine(100, 100);
                        engineRef.current.updateParams(params);
                        setStats({ step: 0, cycle: 0, fps: 0 });
                        render();
                    }}
                >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    重启
                </Button>
            </div>
        </header>

        {/* Left Sidebar - Controls */}
        <aside className="w-80 h-full pt-16 pb-4 px-4 border-r border-border bg-card/50 flex flex-col gap-4 overflow-y-auto z-0">
          <Tabs defaultValue="layers" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="layers"><Layers className="w-4 h-4 mr-2"/>图层</TabsTrigger>
              <TabsTrigger value="params"><Settings className="w-4 h-4 mr-2"/>参数</TabsTrigger>
              <TabsTrigger value="config">配置</TabsTrigger>
            </TabsList>
            
            <TabsContent value="layers" className="space-y-4 mt-4">
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">视图模式</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <Button 
                            variant={activeLayer === 'combined' ? "default" : "outline"} 
                            className="justify-start"
                            onClick={() => setActiveLayer('combined')}
                        >
                            综合视图
                        </Button>
                        <Button 
                            variant={activeLayer === 'mantle' ? "default" : "outline"} 
                            className="justify-start text-red-500 hover:text-red-600"
                            onClick={() => setActiveLayer('mantle')}
                        >
                            地幔层
                        </Button>
                        <Button 
                            variant={activeLayer === 'climate' ? "default" : "outline"} 
                            className="justify-start text-blue-500 hover:text-blue-600"
                            onClick={() => setActiveLayer('climate')}
                        >
                            气候层
                        </Button>
                        <Button 
                            variant={activeLayer === 'crystal' ? "default" : "outline"} 
                            className="justify-start text-emerald-500 hover:text-emerald-600"
                            onClick={() => setActiveLayer('crystal')}
                        >
                            晶石层
                        </Button>
                        <Button 
                            variant={activeLayer === 'human' ? "default" : "outline"} 
                            className="justify-start text-orange-500 hover:text-orange-600"
                            onClick={() => setActiveLayer('human')}
                        >
                            生物层
                        </Button>
                    </div>
                </div>

                {/* Species List Table */}
                <div className="space-y-2 pt-4 border-t border-border">
                    <Label className="text-xs text-muted-foreground">当前物种</Label>
                    <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-2 py-1 text-left">ID</th>
                                    <th className="px-2 py-1 text-center">颜色</th>
                                    <th className="px-2 py-1 text-right">数量</th>
                                </tr>
                            </thead>
                            <tbody>
                                {speciesList.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                                            无生物存活
                                        </td>
                                    </tr>
                                ) : (
                                    speciesList.map(species => (
                                        <tr key={species.id} className="border-t border-border/50">
                                            <td className="px-2 py-1 font-mono">
                                                {species.id === 0 ? 'Human (X)' : `Species ${String.fromCharCode(65 + (species.id % 26))}`}
                                            </td>
                                            <td className="px-2 py-1 text-center">
                                                <div 
                                                    className="w-3 h-3 rounded-full mx-auto border border-white/20" 
                                                    style={{ backgroundColor: species.color }}
                                                />
                                            </td>
                                            <td className="px-2 py-1 text-right font-mono">{species.count}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                    <Label className="text-xs text-muted-foreground">图例</Label>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500"></div>
                            <span>Alpha 晶石</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-slate-500"></div>
                            <span>Beta 晶石</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-500/50"></div>
                            <span>雷暴区域</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 border border-white"></div>
                            <span>正在吸收能量</span>
                        </div>
                    </div>
                </div>
            </TabsContent>
            
            <TabsContent value="params" className="space-y-6 mt-4 pr-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">地幔动力学</h3>
                  <ParamControl label="时间尺度" paramKey="mantleTimeScale" min={0.001} max={0.05} step={0.001} />
                  <ParamControl label="扩张阈值" paramKey="expansionThreshold" min={0} max={100} step={1} />
                  <ParamControl label="收缩阈值" paramKey="shrinkThreshold" min={0} max={100} step={1} />
                  <ParamControl label="基础能量" paramKey="mantleEnergyLevel" min={0} max={200} step={5} />
                  <ParamControl label="扭曲速度" paramKey="distortionSpeed" min={0} max={0.1} step={0.001} />
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground">晶石与气候</h3>
                  <ParamControl label="Alpha需求" paramKey="alphaEnergyDemand" min={0} max={20} step={0.5} />
                  <ParamControl label="扩张消耗" paramKey="expansionCost" min={0} max={20} step={0.5} />
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
                  <ParamControl label="扩张阈值" paramKey="humanExpansionThreshold" min={0} max={200} step={5} />
                  <ParamControl label="迁移阈值" paramKey="humanMigrationThreshold" min={0} max={200} step={5} />
                  <ParamControl label="Alpha辐射伤害" paramKey="alphaRadiationDamage" min={0} max={50} step={1} />
                  <ParamControl label="重生延迟" paramKey="humanRespawnDelay" min={10} max={200} step={10} />
                </div>
            
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground">生物演化参数</h3>
                  <ParamControl label="灭绝奖励" paramKey="extinctionBonus" min={0} max={200} step={5} />
                  <ParamControl label="地幔热量系数" paramKey="mantleHeatFactor" min={0} max={200} step={1} />
                  <ParamControl label="热扩散率" paramKey="diffusionRate" min={0} max={1.0} step={0.01} />
                  <ParamControl label="热平流率" paramKey="advectionRate" min={0} max={0.2} step={0.01} />
                  <ParamControl label="雷暴阈值" paramKey="thunderstormThreshold" min={0} max={100} step={1} />
                  <ParamControl label="最小增长" paramKey="minProsperityGrowth" min={0} max={20} step={0.5} />
                  <ParamControl label="同种群加成" paramKey="sameSpeciesBonus" min={0} max={10} step={0.1} />
                </div>
            </TabsContent>

            <TabsContent value="config" className="mt-4">
                <div className="space-y-4">
                    <Button variant="destructive" className="w-full" onClick={resetParams}>
                        重置所有参数
                    </Button>
                    <div className="p-4 bg-muted rounded-md text-xs font-mono">
                        <p className="mb-2 font-bold">当前配置 JSON:</p>
                        <div className="max-h-64 overflow-y-auto break-all">
                            {JSON.stringify(params, null, 2)}
                        </div>
                    </div>
                </div>
            </TabsContent>
          </Tabs>
        </aside>
        
        {/* Main Canvas Area */}
        <main 
          ref={containerRef}
          className={`flex-1 bg-black relative overflow-hidden ${activeTool === 'destroy' ? 'cursor-crosshair' : 'cursor-move'}`}
        >
          <HumanBehaviorTool 
            activeTool={activeTool}
            onToolChange={setActiveTool}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
          />
          <canvas 
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="block touch-none" // 禁用浏览器默认触摸行为
            onClick={handleCanvasClick}
          />
        </main>
    </div>
  );
}

// Custom Hook for Params
function useSimulationParams() {
    const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);

    const updateParam = (key: keyof SimulationParams, value: any) => {
        setParams(prev => ({ ...prev, [key]: value }));
    };

    const resetParams = () => {
        setParams(DEFAULT_PARAMS);
    };

    return { params, updateParam, resetParams };
}

// Helper for Canvas Size
const canvasSize = { width: 800, height: 800 };
