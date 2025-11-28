import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_PARAMS, SimulationEngine, SimulationParams } from "@/lib/simulation/engine";
import * as d3 from "d3";
import { HelpCircle, Pause, Play, RefreshCw, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Parameter Descriptions
const PARAM_INFO: Record<keyof SimulationParams, { desc: string; impact: string }> = {
  mantleTimeScale: { desc: "Speed of mantle energy change over time", impact: "High: Fast terrain changes / Low: Stable terrain" },
  expansionThreshold: { desc: "Energy required to expand terrain", impact: "High: Harder to expand / Low: Rapid expansion" },
  shrinkThreshold: { desc: "Negative energy required to shrink terrain", impact: "High: Harder to shrink / Low: Rapid shrinking" },
  depletionRate: { desc: "Rate at which mantle energy decays per cycle", impact: "High: Fast world death / Low: Long-lasting world" },
  maxRadius: { desc: "Maximum radius for terrain expansion", impact: "High: Larger map / Low: Smaller map" },
  minRadius: { desc: "Minimum radius for terrain shrinking", impact: "High: Larger core / Low: Smaller core" },
  
  diffusionRate: { desc: "Speed of temperature spread", impact: "High: Uniform temp / Low: High gradients" },
  advectionRate: { desc: "Speed of temperature flow along gradients", impact: "High: Fast weather movement / Low: Static weather" },
  thunderstormThreshold: { desc: "Temp difference required for thunder", impact: "High: Fewer storms / Low: More storms" },
  seasonalAmplitude: { desc: "Strength of seasonal temp changes", impact: "High: Extreme seasons / Low: Mild seasons" },
  
  alphaEnergyDemand: { desc: "Energy needed for Alpha crystal survival", impact: "High: Hard to survive / Low: Easy growth" },
  betaEnergyDemand: { desc: "Energy needed for Beta crystal (unused)", impact: "N/A" },
  mantleAbsorption: { desc: "Efficiency of absorbing mantle energy", impact: "High: Fast growth / Low: Slow growth" },
  thunderstormEnergy: { desc: "Bonus energy from thunderstorms", impact: "High: Storms boost growth / Low: Storms less effective" },
  invasionThreshold: { desc: "Neighbors needed to invade empty space", impact: "High: Slow expansion / Low: Fast expansion" },
  invasionEnergyFactor: { desc: "Energy multiplier for invasion", impact: "High: Harder to invade / Low: Easier to invade" },
  harvestThreshold: { desc: "Harvest threshold (unused in auto-sim)", impact: "N/A" },
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
  const animate = (time: number) => {
    if (isPlaying) {
      engine.update();
      setStats({
        timeStep: engine.timeStep,
        cycle: engine.cycleCount,
        fps: Math.round(1000 / (time - lastTimeRef.current))
      });
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
  }, [isPlaying, engine, activeLayer]); // Dependencies for loop
  
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
            if (cell.crystalState === 'ALPHA') ctx.fillStyle = '#10b981'; // Emerald
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
            
            if (cell.crystalState === 'ALPHA') ctx.fillStyle = '#10b981';
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
          <h1 className="font-bold text-neutral-100">World Morphing Sim</h1>
          <div className="h-6 w-px bg-neutral-800" />
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Step: <span className="text-neutral-100 w-12 inline-block">{stats.timeStep}</span></span>
            <span>Cycle: <span className="text-neutral-100 w-8 inline-block">{stats.cycle}</span></span>
            <span>FPS: <span className="text-neutral-100 w-8 inline-block">{stats.fps}</span></span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant={isPlaying ? "secondary" : "default"} 
            size="sm" 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-24"
          >
            {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          
          <Dialog open={isRestartOpen} onOpenChange={setIsRestartOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
              <DialogHeader>
                <DialogTitle>Restart Simulation</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Width</Label>
                    <Input 
                      type="number" 
                      value={mapSize.width} 
                      onChange={(e) => setMapSize({...mapSize, width: parseInt(e.target.value)})}
                      className="bg-neutral-950 border-neutral-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height</Label>
                    <Input 
                      type="number" 
                      value={mapSize.height} 
                      onChange={(e) => setMapSize({...mapSize, height: parseInt(e.target.value)})}
                      className="bg-neutral-950 border-neutral-800"
                    />
                  </div>
                </div>
                <Button onClick={handleRestart}>Confirm Restart</Button>
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
              <TabsTrigger value="layers" className="flex-1 rounded-none data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100 border-b-2 border-transparent data-[state=active]:border-blue-500">Layers</TabsTrigger>
              <TabsTrigger value="params" className="flex-1 rounded-none data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100 border-b-2 border-transparent data-[state=active]:border-blue-500">Params</TabsTrigger>
            </TabsList>
            
            <TabsContent value="layers" className="flex-1 p-4 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-neutral-500 font-bold">View Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant={activeLayer === 'combined' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('combined')}
                    className="justify-start"
                  >
                    Combined
                  </Button>
                  <Button 
                    variant={activeLayer === 'mantle' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('mantle')}
                    className="justify-start text-red-400 border-red-900/30 hover:bg-red-900/20"
                  >
                    Mantle
                  </Button>
                  <Button 
                    variant={activeLayer === 'climate' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('climate')}
                    className="justify-start text-blue-400 border-blue-900/30 hover:bg-blue-900/20"
                  >
                    Climate
                  </Button>
                  <Button 
                    variant={activeLayer === 'crystal' ? 'default' : 'outline'} 
                    onClick={() => setActiveLayer('crystal')}
                    className="justify-start text-emerald-400 border-emerald-900/30 hover:bg-emerald-900/20"
                  >
                    Crystal
                  </Button>
                </div>
              </div>
              
              <div className="p-4 bg-neutral-950 rounded border border-neutral-800 text-xs space-y-2">
                <div className="font-bold text-neutral-400">Legend</div>
                {activeLayer === 'combined' && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500"></div> Alpha Crystal</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-500"></div> Beta Crystal</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500/50"></div> Thunderstorm</div>
                  </>
                )}
                {activeLayer === 'mantle' && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600"></div> High Energy</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-900"></div> Low Energy</div>
                  </>
                )}
                {activeLayer === 'climate' && (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500"></div> Hot (&gt;25°C)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white"></div> Neutral (0°C)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500"></div> Cold (&lt;-25°C)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500"></div> Thunderstorm</div>
                  </>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="params" className="flex-1 p-4 space-y-6 overflow-y-auto">
              <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetParams} className="text-xs h-6">
                      <RotateCcw className="w-3 h-3 mr-1" /> Reset Defaults
                  </Button>
              </div>
              
              {/* Mantle Params */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-red-500 font-bold">Mantle Layer</Label>
                <ParamControl label="Depletion Rate" paramKey="depletionRate" min={0} max={0.05} step={0.001} />
                <ParamControl label="Max Radius" paramKey="maxRadius" min={10} max={40} step={1} />
                <ParamControl label="Min Radius" paramKey="minRadius" min={0} max={20} step={1} />
              </div>
              
              {/* Climate Params */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-blue-500 font-bold">Climate Layer</Label>
                <ParamControl label="Diffusion" paramKey="diffusionRate" min={0} max={0.2} step={0.01} />
                <ParamControl label="Thunder Threshold" paramKey="thunderstormThreshold" min={5} max={30} step={1} />
              </div>
              
              {/* Crystal Params */}
              <div className="space-y-3">
                <Label className="text-xs uppercase text-emerald-500 font-bold">Crystal Layer</Label>
                <ParamControl label="Alpha Demand" paramKey="alphaEnergyDemand" min={1} max={10} step={0.5} />
                <ParamControl label="Invasion Threshold" paramKey="invasionThreshold" min={1} max={5} step={1} />
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
