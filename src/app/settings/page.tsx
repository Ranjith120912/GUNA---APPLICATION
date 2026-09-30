"use client";

import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings as SettingsIcon, 
  Milk, 
  Building2, 
  Upload, 
  X, 
  Scale,
  Loader2,
  ShoppingBag,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [config, setConfig] = useState({ 
    companyName: "",
    address: "",
    stampUrl: "",
    cowRate: "", 
    buffaloRate: "", 
    cowSellingRate: "",
    buffaloSellingRate: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: currentSettings } = useDoc(settingsRef);

  useEffect(() => {
    if (currentSettings) {
      setConfig({
        companyName: currentSettings.companyName || "",
        address: currentSettings.address || "",
        stampUrl: currentSettings.stampUrl || "",
        cowRate: currentSettings.cowRate?.toString() || "",
        buffaloRate: currentSettings.buffaloRate?.toString() || "",
        cowSellingRate: currentSettings.cowSellingRate?.toString() || "",
        buffaloSellingRate: currentSettings.buffaloSellingRate?.toString() || ""
      });
    }
  }, [currentSettings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setConfig(prev => ({ ...prev, stampUrl: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!firestore) return;
    setIsSaving(true);
    setDocumentNonBlocking(doc(firestore, 'settings', 'milk_rates'), {
      ...config,
      cowRate: parseFloat(config.cowRate) || 0,
      buffaloRate: parseFloat(config.buffaloRate) || 0,
      cowSellingRate: parseFloat(config.cowSellingRate) || 0,
      buffaloSellingRate: parseFloat(config.buffaloSellingRate) || 0,
      kgToLitreRate: 0.97, // Standardised Fixed Lock
      updatedAt: serverTimestamp()
    }, { merge: true });
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Configuration Updated", description: "Business settings applied successfully." });
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-black text-primary tracking-tight flex items-center gap-3 uppercase">
              <SettingsIcon className="w-8 h-8" /> System Configuration
            </h1>
            <p className="text-muted-foreground font-medium">Manage pricing and business identity standards.</p>
          </header>

          <div className="space-y-8">
            <Card className="rounded-[2rem] shadow-lg border-none bg-card overflow-hidden">
              <CardHeader className="bg-primary/5 p-6 border-b">
                <CardTitle className="text-xl font-black flex items-center gap-3 text-primary uppercase">
                  <Building2 className="w-6 h-6" /> Business Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Name</Label>
                      <Input value={config.companyName || ""} onChange={(e) => setConfig({ ...config, companyName: e.target.value })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Address</Label>
                      <Textarea value={config.address || ""} onChange={(e) => setConfig({ ...config, address: e.target.value })} className="rounded-xl min-h-[80px]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Business Stamp</Label>
                    <div className="h-[160px] w-full rounded-2xl border-2 border-dashed border-primary/10 relative group overflow-hidden bg-muted/20">
                      {config.stampUrl ? (
                        <>
                          <img src={config.stampUrl} className="w-full h-full object-contain p-4 mix-blend-multiply" alt="Business Stamp" />
                          <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100" onClick={() => setConfig({...config, stampUrl: ""})}><X /></Button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><Upload className="mb-2" /><p className="text-xs">Upload PNG/JPG</p></div>
                      )}
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-3xl border-none shadow-md p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2"><Milk className="w-4 h-4" /> Procurement Rates</CardTitle>
                <div className="space-y-4">
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Cow (₹/L)</Label><Input type="number" value={config.cowRate || ""} onChange={(e) => setConfig({...config, cowRate: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Buffalo (₹/L)</Label><Input type="number" value={config.buffaloRate || ""} onChange={(e) => setConfig({...config, buffaloRate: e.target.value})} /></div>
                </div>
              </Card>
              <Card className="rounded-3xl border-none shadow-md p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent mb-6 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Selling Rates</CardTitle>
                <div className="space-y-4">
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Cow (₹/L)</Label><Input type="number" value={config.cowSellingRate || ""} onChange={(e) => setConfig({...config, cowSellingRate: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[9px] font-bold uppercase">Buffalo (₹/L)</Label><Input type="number" value={config.buffaloSellingRate || ""} onChange={(e) => setConfig({...config, buffaloSellingRate: e.target.value})} /></div>
                </div>
              </Card>
              <Card className="rounded-3xl border-none shadow-md p-6 bg-primary/5">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground mb-6 flex items-center gap-2"><Scale className="w-4 h-4" /> Conversion Standard</CardTitle>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase">Kg to Litre</Label>
                  <Input type="number" value="0.97" disabled className="bg-white font-black text-primary border-primary/20" />
                  <p className="text-[8px] text-primary mt-2 uppercase font-black tracking-widest">Locked: 1 Kg = 0.97 L</p>
                </div>
              </Card>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving} className="rounded-full px-12 h-14 font-black uppercase tracking-widest shadow-xl">
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />} Apply Configuration
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
