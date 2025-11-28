import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Eraser, MousePointer2, MapPin } from "lucide-react";
import { useState } from "react";

export type ToolType = 'none' | 'destroy' | 'spawn';

interface HumanBehaviorToolProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
}

export default function HumanBehaviorTool({
  activeTool,
  onToolChange,
  brushSize,
  onBrushSizeChange
}: HumanBehaviorToolProps) {
  return (
    <Card className="absolute top-4 right-4 p-4 w-64 bg-black/80 border-neutral-800 text-white backdrop-blur-sm z-10">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-neutral-200">人类行为工具</h3>
          <MousePointer2 className="w-4 h-4 text-neutral-400" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={activeTool === 'none' ? "default" : "outline"}
            size="sm"
            onClick={() => onToolChange('none')}
            className="w-full"
          >
            <MousePointer2 className="w-4 h-4 mr-2" />
            观察
          </Button>
          <Button
            variant={activeTool === 'destroy' ? "destructive" : "outline"}
            size="sm"
            onClick={() => onToolChange('destroy')}
            className="w-full"
          >
            <Eraser className="w-4 h-4 mr-2" />
            摧毁
          </Button>
          <Button
            variant={activeTool === 'spawn' ? "default" : "outline"}
            size="sm"
            onClick={() => onToolChange('spawn')}
            className="w-full col-span-2 bg-orange-600 hover:bg-orange-700 text-white border-orange-800"
          >
            <MapPin className="w-4 h-4 mr-2" />
            设置重生点
          </Button>
        </div>

        {activeTool === 'destroy' && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <Label>画笔大小 (方形)</Label>
              <span className="text-neutral-400">{brushSize}x{brushSize}</span>
            </div>
            <Slider
              value={[brushSize]}
              min={1}
              max={10}
              step={1}
              onValueChange={([v]) => onBrushSizeChange(v)}
              className="py-2"
            />
          </div>
        )}
        
        <div className="text-xs text-neutral-500">
          {activeTool === 'destroy' && "点击晶石区域可按画笔范围摧毁晶石"}
          {activeTool === 'spawn' && "点击地图任意位置设置人类重生点"}
          {activeTool === 'none' && "仅观察模式，无法修改世界"}
        </div>
      </div>
    </Card>
  );
}
