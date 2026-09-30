"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Scale, 
  Droplets, 
  ArrowRightLeft, 
  Info, 
  Copy, 
  X, 
  Check, 
  ArrowUpDown,
  Zap,
  Waves
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type LiquidType = "standard" | "water" | "oil" | "diesel" | "petrol";

interface LiquidDensity {
  label: string;
  density: number; // kg per Litre
  icon: React.ReactNode;
}

const LIQUIDS: Record<LiquidType, LiquidDensity> = {
  // Density = kg/L. If 1kg = 0.97L, then density = 1 / 0.97 = 1.0309278...
  standard: { label: "Standard (Milk/Dairy)", density: 1.0309, icon: <Droplets className="w-4 h-4" /> },
  water: { label: "Pure Water", density: 1.000, icon: <Waves className="w-4 h-4" /> },
  oil: { label: "Cooking Oil", density: 0.910, icon: <Droplets className="w-4 h-4 text-yellow-500" /> },
  diesel: { label: "Diesel Fuel", density: 0.832, icon: <Zap className="w-4 h-4 text-orange-500" /> },
  petrol: { label: "Petrol/Gasoline", density: 0.740, icon: <Zap className="w-4 h-4 text-red-500" /> },
};

export function ConversionCard() {
  const [inputValue, setInputValue] = useState<string>("");
  const [resultValue, setResultValue] = useState<number | null>(null);
  const [isKgToLitre, setIsKgToLitre] = useState(true);
  const [liquid, setLiquid] = useState<LiquidType>("standard");
  const [isFocused, setIsFocused] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const density = LIQUIDS[liquid].density;

  useEffect(() => {
    const val = parseFloat(inputValue);
    if (!isNaN(val)) {
      if (isKgToLitre) {
        // KG to L: L = KG / Density
        setResultValue(val / density);
      } else {
        // L to KG: KG = L * Density
        setResultValue(val * density);
      }
    } else {
      setResultValue(null);
    }
  }, [inputValue, isKgToLitre, liquid, density]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  const handleClear = () => {
    setInputValue("");
    setResultValue(null);
  };

  const handleSwap = () => {
    setIsKgToLitre(!isKgToLitre);
    // Optionally swap values to keep the "current amount"
    if (resultValue !== null) {
      setInputValue(resultValue.toFixed(4).replace(/\.?0+$/, ""));
    }
  };

  const handleCopy = () => {
    if (resultValue !== null) {
      const result = resultValue.toFixed(4);
      navigator.clipboard.writeText(result);
      setCopied(true);
      toast({
        title: "Result Copied",
        description: `${result} ${isKgToLitre ? "Litres" : "Kilograms"} copied to clipboard.`,
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4 sm:p-6">
      <Card className="shadow-2xl border-none overflow-hidden bg-card/90 backdrop-blur-md transition-all duration-500 hover:shadow-primary/5">
        <CardHeader className="text-center space-y-4 pb-8 border-b border-primary/5 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-2xl shadow-inner group cursor-pointer" onClick={handleSwap}>
              <ArrowRightLeft className={cn(
                "w-10 h-10 text-primary transition-transform duration-500",
                !isKgToLitre && "rotate-180"
              )} />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-4xl font-headline font-bold text-primary tracking-tight uppercase">
              SGK MILK DISTRIBUTIONS
            </CardTitle>
            <CardDescription className="text-muted-foreground font-body text-base">
              Universal Weight-Volume Converter
            </CardDescription>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-[280px]">
              <Select value={liquid} onValueChange={(val: LiquidType) => setLiquid(val)}>
                <SelectTrigger className="bg-background/50 border-primary/10 rounded-full">
                  <div className="flex items-center gap-2">
                    {LIQUIDS[liquid].icon}
                    <SelectValue placeholder="Select Liquid" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LIQUIDS).map(([key, item]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="px-5 py-1.5 text-xs font-semibold bg-accent/10 text-primary border-accent/20 flex items-center gap-2 rounded-full">
              <Info className="w-4 h-4" />
              Density: {density.toFixed(4)} kg/L
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-10 pb-12 px-6 sm:px-10">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="input-field" className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                {isKgToLitre ? <Scale className="w-4 h-4 text-primary/70" /> : <Droplets className="w-4 h-4 text-accent/70" />}
                From {isKgToLitre ? "Kilograms" : "Litres"}
              </Label>
              {inputValue && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClear}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
            <div className="relative">
              <Input
                id="input-field"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className={cn(
                  "h-20 text-4xl font-bold pl-6 transition-all duration-300 border-2 rounded-2xl bg-background",
                  isFocused ? "border-primary ring-8 ring-primary/5" : "border-muted-foreground/10 hover:border-primary/30"
                )}
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-primary/20 text-2xl pointer-events-none">
                {isKgToLitre ? "KG" : "LTR"}
              </div>
            </div>
          </div>

          {/* Swap Button Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted-foreground/10" />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwap}
              className="relative bg-background h-12 w-12 rounded-full border border-muted-foreground/10 text-primary shadow-sm hover:bg-primary/5 transition-all group active:scale-95"
            >
              <ArrowUpDown className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            </Button>
          </div>

          {/* Output Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                {!isKgToLitre ? <Scale className="w-4 h-4 text-primary/70" /> : <Droplets className="w-4 h-4 text-accent/70" />}
                To {!isKgToLitre ? "Kilograms" : "Litres"}
              </Label>
              {resultValue !== null && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopy}
                  className={cn(
                    "h-8 px-3 text-xs font-medium rounded-full transition-all",
                    copied ? "bg-green-50 text-green-600 border-green-200" : "bg-accent/5 text-primary border-accent/20 hover:bg-accent/10"
                  )}
                >
                  {copied ? <Check className="w-3 h-3 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                  {copied ? "Copied" : "Copy Result"}
                </Button>
              )}
            </div>
            <div className={cn(
              "h-24 flex items-center px-6 rounded-2xl transition-all duration-500 border-2 bg-gradient-to-r from-accent/5 to-primary/5 relative overflow-hidden",
              resultValue !== null ? "border-accent/40 shadow-lg shadow-accent/5" : "border-muted-foreground/10"
            )}>
              <div className="flex flex-col">
                <span className={cn(
                  "text-5xl font-black tracking-tighter transition-all duration-300",
                  resultValue !== null ? "text-primary" : "text-muted-foreground/20"
                )}>
                  {resultValue !== null ? resultValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "0.0000"}
                </span>
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end">
                <span className="text-accent/30 font-black uppercase tracking-tighter text-2xl">
                  {isKgToLitre ? "LTR" : "KG"}
                </span>
              </div>
              
              {resultValue !== null && (
                <div className="absolute inset-0 bg-primary/5 animate-pulse-subtle pointer-events-none" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Reference Table */}
      <div className="mt-16 text-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em] mb-6">Common Conversions ({LIQUIDS[liquid].label})</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 5, 10, 50].map((val) => {
            const converted = isKgToLitre ? val / density : val * density;
            return (
              <div key={val} className="group p-5 bg-card/50 backdrop-blur-sm rounded-2xl border border-primary/5 hover:border-primary/20 hover:shadow-md transition-all duration-300">
                <div className="text-primary font-black text-lg mb-1">{val} {isKgToLitre ? "kg" : "L"}</div>
                <div className="text-muted-foreground font-medium text-sm">{converted.toFixed(2)} {isKgToLitre ? "L" : "kg"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
