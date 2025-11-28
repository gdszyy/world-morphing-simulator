import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SimulationParams } from "@/lib/simulation/engine";
import { Save, Trash2, RotateCcw, FileDown, FileUp } from "lucide-react";
import { useState } from "react";
import { ConfigVersion } from "@/hooks/useConfigManager";

interface ConfigManagerProps {
  currentParams: SimulationParams;
  onLoadParams: (params: SimulationParams) => void;
  onSaveDefault: (params: SimulationParams) => void;
  onResetDefault: () => void;
  savedVersions: ConfigVersion[];
  onSaveVersion: (name: string, params: SimulationParams) => void;
  onDeleteVersion: (id: string) => void;
}

export default function ConfigManager({
  currentParams,
  onLoadParams,
  onSaveDefault,
  onResetDefault,
  savedVersions,
  onSaveVersion,
  onDeleteVersion
}: ConfigManagerProps) {
  const [newVersionName, setNewVersionName] = useState("");

  const handleSaveVersion = () => {
    if (!newVersionName.trim()) return;
    onSaveVersion(newVersionName, currentParams);
    setNewVersionName("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-bold text-neutral-400">默认配置管理</Label>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => onSaveDefault(currentParams)}
          >
            <Save className="w-3 h-3 mr-2" />
            设为默认
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={onResetDefault}
          >
            <RotateCcw className="w-3 h-3 mr-2" />
            重置默认
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold text-neutral-400">版本管理</Label>
        <div className="flex gap-2">
          <Input 
            placeholder="新版本名称..." 
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
            className="h-8 text-xs"
          />
          <Button 
            size="sm" 
            className="h-8"
            onClick={handleSaveVersion}
            disabled={!newVersionName.trim()}
          >
            <Save className="w-3 h-3" />
          </Button>
        </div>

        <ScrollArea className="h-48 rounded border border-neutral-800 bg-neutral-900/50 p-2">
          <div className="space-y-2">
            {savedVersions.length === 0 && (
              <div className="text-xs text-neutral-500 text-center py-4">暂无保存的版本</div>
            )}
            {savedVersions.map((version) => (
              <div key={version.id} className="flex items-center justify-between bg-neutral-800/50 p-2 rounded group">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-medium truncate text-neutral-200">{version.name}</span>
                  <span className="text-[10px] text-neutral-500">
                    {new Date(version.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 hover:bg-blue-900/30 hover:text-blue-400"
                    onClick={() => onLoadParams(version.params)}
                    title="加载此版本"
                  >
                    <FileUp className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 hover:bg-red-900/30 hover:text-red-400"
                    onClick={() => onDeleteVersion(version.id)}
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
