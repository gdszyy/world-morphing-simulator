import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_PARAMS, SimulationEngine, SimulationParams } from "@/lib/simulation/engine";
import * as d3 from "d3";
import { FastForward, HelpCircle, Pause, Play, RefreshCw, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  invasionThreshold: { desc: "入侵空地所需的邻居数量", impact: "高: 扩张慢 / 低: 扩张快" },
  invasionEnergyFactor: { desc: "入侵所需的能量倍率", impact: "高: 难以入侵 / 低: 容易入侵" },
  harvestThreshold: { desc: "采集阈值 (自动模拟中未使用)", impact: "N/A" },
};

export default function Home() {
  // State
  const [engine, setEngine] = useState(() => new SimulationEngine(50, 50));
  const [isPlaying, setIsPlaying] = useState(false);
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [activeLayer, setActiveLayer] = useState<'combined' | 'mantle' | 'climate' | 'crystal'>('combined');
  const [stats, setStats] = useState({ timeStep: 0, cycle: 0, fps: 0 });
  const [mapSize, setMapSize] = useState({ width: 50, height: 50 });
  const [isRestartOpen, setIsRestartOpen] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 播放速率倍数 (支持小数)
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  // Initialize D3 Zoom
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = d3.select(canvasRef.current);
    const context = canvasRef.current.getContext('2d');
    
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 10])
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
  }, [isPlaying, engine, activeLayer, speedMultiplier]); // Dependencies for loop
  
  // Update Params
  useEffect(() => {
    engine.params = params;
  }, [params]);
  
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
        } else if (activeLayer === 'climate') {
            // Temperature: Blue (Cold) -> White (Neutral) -> Red (Hot)
            // Range -50 to 50
            const t = (cell.temperature + 50) / 100;
            if (t < 0.5) {
                // Blue to White
                const v = t * 2;
                ctx.fillStyle = `rgb(${v*255}, ${v*255}, 255)`;
            } else {
                // White to Red
                const v = (t - 0.5) * 2;
                ctx.fillStyle = `rgb(255, ${(1-v)*255}, ${(1-v)*255})`;
            }
            
            // Thunderstorm Overlay
            if (cell.hasThunderstorm) {
                ctx.fillStyle = '#fbbf24'; // Amber
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
            else if (cell.crystalState === 'BETA') ctx.fillStyle = '#64748b'; // Slate
            else ctx.fillStyle = '#404040'; // Empty ground
        } else {
            // Combined View
            // Base: Mantle (Dark)
            // Overlay: Crystal
            // Overlay: Thunderstorm
            
            // Ground
            const groundIntensity = 30 + (cell.mantleEnergy / 100) * 30;
            ctx.fillStyle = `rgb(${groundIntensity}, ${groundIntensity}, ${groundIntensity})`;
            
            if (cell.crystalState === 'ALPHA') {
                ctx.fillStyle = '#10b981';
                // 能量吸收视觉效果：白色边框
                if (cell.isAbsorbing) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
                }
            }
            else if (cell.crystalState === 'BETA') ctx.fillStyle = '#64748b';
            
            if (cell.hasThunderstorm) {
                ctx.fillStyle = 'rgba(251, 191, 36, 0.5)'; // Semi-transparent amber
            }
        }
        
        ctx.fillRect(px, py, cellSize, cellSize);
      }
    }
    
    ctx.restore();
  };
  
  const handleRestart = () => {
    const newEngine = new SimulationEngine(mapSize.width, mapSize.height, params);
    setEngine(newEngine);
    setStats({ timeStep: 0, cycle: 0, fps: 0 });
    setIsRestartOpen(false);
    
    // Reset Zoom
    const canvas = d3.select(canvasRef.current);
    canvas.call(d3.zoom<HTMLCanvasElement, unknown>().transform, d3.zoomIdentity);
  };
  
  const resetParams = () => {
      setParams(DEFAULT_PARAMS);
  };

  const ParamControl = ({ label, paramKey, min, max, step }: { label: string, paramKey: keyof SimulationParams, min: number, max: number, step: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs items-center">
        <div className="flex items-center gap-1">
            <span>{label}</span>
            <Tooltip>
                <TooltipTrigger>
                    <HelpCircle className="w-3 h-3 text-neutral-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-neutral-800 border-neutral-700 text-neutral-200">
                    <p className="font-bold mb-1">{PARAM_INFO[paramKey].desc}</p>
                    <p className="text-xs text-neutral-400">{PARAM_INFO[paramKey].impact}</p>
                </TooltipContent>
            </Tooltip>
        </div>
        <span>{params[paramKey]}</span>
      </div>
      <Slider 
        min={min} max={max} step={step} 
        value={[params[paramKey]]} 
        onValueChange={([v]) => setParams({...params, [paramKey]: v})}
      />
    </div>
  );

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
                variant={speedMultiplier === 0.01 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-8 text-[10px]"
                onClick={() => setSpeedMultiplier(0.01)}
            >0.01x</Button>
            <Button 
                variant={speedMultiplier === 0.1 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-8 text-[10px]"
                onClick={() => setSpeedMultiplier(0.1)}
            >0.1x</Button>
            <Button 
                variant={speedMultiplier === 0.5 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-8 text-[10px]"
                onClick={() => setSpeedMultiplier(0.5)}
            >0.5x</Button>
            
            <div className="w-px h-4 bg-neutral-700 mx-1"></div>
            
            {/* 正常/快进选项 */}
            <Button 
                variant={speedMultiplier === 1 ? "secondary" : "ghost"} 
                size="icon" className="h-6 w-6 text-xs"
                onClick={() => setSpeedMultiplier(1)}
            >1x</Button>
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
                      onChange={(e) => setMapSize({...mapSize, width: parseInt(e.target.value)})}
                      className="bg-neutral-950 border-neutral-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>高度</Label>
                    <Input 
                      type="number" 
                      value={mapSize.height} 
                      onChange={(e) => setMapSize({...mapSize, height: parseInt(e.target.value)})}
                      className="bg-neutral-950 border-neutral-800"
                    />
                  </div>
                </div>
                <Button onClick={handleRestart}>确认重启</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-80 border-r border-neutral-800 bg-neutral-900 flex flex-col shrink-0">
          <Tabs defaultValue="layers" className="flex-1 flex flex-col">
            <TabsList className="w-full bg-neutral-950 rounded-none border-b border-neutral-800 p-0 h-10">
              <TabsTrigger value="layers" className="flex-1 rounded-none data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100 border-b-2 border-transparent data-[state=active]:border-blue-500">图层</TabsTrigger>
              <TabsTrigger value="params" className="flex-1 rounded-none data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100 border-b-2 border-transparent data-[state=active]:border-blue-500">参数</TabsTrigger>
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
            
            <TabsContent value="params" className="flex-1 p-4 space-y-6 overflow-y-auto">
              <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetParams} className="text-xs h-6">
                      <RotateCcw className="w-3 h-3 mr-1" /> 恢复默认
                  </Button>
              </div>
              
              {/* 地幔层参数 */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-red-500 font-bold">地幔层参数</Label>
                <ParamControl label="能量等级" paramKey="mantleEnergyLevel" min={0.5} max={3.0} step={0.1} />
                <ParamControl label="扩张阈值" paramKey="expansionThreshold" min={50} max={200} step={10} />
                <ParamControl label="缩减阈值" paramKey="shrinkThreshold" min={50} max={200} step={10} />
                <ParamControl label="最大半径" paramKey="maxRadius" min={10} max={40} step={1} />
                <ParamControl label="最小半径" paramKey="minRadius" min={0} max={20} step={1} />
                <ParamControl label="扭曲速度" paramKey="distortionSpeed" min={0} max={0.05} step={0.001} />
              </div>
              
              {/* 气候层参数 */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-blue-500 font-bold">气候层参数</Label>
                <ParamControl label="扩散速度" paramKey="diffusionRate" min={0} max={0.2} step={0.01} />
                <ParamControl label="雷暴阈值" paramKey="thunderstormThreshold" min={5} max={30} step={1} />
              </div>
              
              {/* 晶石层参数 */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-emerald-500 font-bold">晶石层参数</Label>
                <ParamControl label="Alpha生存需求" paramKey="alphaEnergyDemand" min={1} max={10} step={0.5} />
                <ParamControl label="入侵阈值" paramKey="invasionThreshold" min={1} max={5} step={1} />
              </div>
            </TabsContent>
          </Tabs>
        </aside>
        
        {/* Main Canvas Area */}
        <main className="flex-1 bg-black relative overflow-hidden cursor-move">
          <canvas 
            ref={canvasRef}
            width={1200}
            height={800}
            className="block w-full h-full"
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
