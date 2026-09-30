"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, serverTimestamp, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { 
  Sun, 
  Moon, 
  Search, 
  Scale, 
  Droplets, 
  CheckCircle2, 
  Loader2, 
  IndianRupee, 
  Lock,
  Calendar as CalendarIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function EntriesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [date, setDate] = useState<string>("");
  const [session, setSession] = useState<'Morning' | 'Evening'>('Morning');
  const [searchTerm, setSearchTerm] = useState("");
  const [kgValues, setKgValues] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  // PRECISION LOCK: 0.97 Standard
  const CONVERSION_RATE = 0.97;

  useEffect(() => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  useEffect(() => {
    setKgValues({});
    setSavingStatus({});
  }, [date, session]);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore || !date) return null;
    return query(
      collection(firestore, 'entries'), 
      where('date', '==', date),
      where('session', '==', session)
    );
  }, [firestore, date, session]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: farmers } = useCollection(farmersQuery);
  const { data: entries } = useCollection(entriesQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const filteredFarmers = (farmers || [])
    .filter(f => 
      f.active !== false && (
        (f.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (f.canNumber || "").includes(searchTerm)
      )
    )
    .sort((a, b) => {
      const aNum = parseInt(a.canNumber || "0");
      const bNum = parseInt(b.canNumber || "0");
      if (isNaN(aNum) || isNaN(bNum)) return (a.canNumber || "").localeCompare(b.canNumber || "");
      return aNum - bNum;
    });

  const handleKgChange = (farmerId: string, value: string) => {
    setKgValues(prev => ({ ...prev, [farmerId]: value }));
    setSavingStatus(prev => ({ ...prev, [farmerId]: 'idle' }));
  };

  const handleAutoSave = (farmerId: string) => {
    const kgStr = kgValues[farmerId];
    const farmer = farmers?.find(f => f.id === farmerId);
    if (!farmer || !firestore || !ratesConfig) return;

    const existingEntry = entries?.find(e => e.farmerId === farmerId);
    
    let managedRate: number;
    if (existingEntry && existingEntry.rate !== undefined && existingEntry.rate !== null && Number(existingEntry.rate) > 0) {
      managedRate = Number(existingEntry.rate);
    } else {
      managedRate = Number(farmer.customRate) > 0 
        ? Number(farmer.customRate) 
        : (farmer.milkType === 'BUFFALO' ? (Number(ratesConfig?.buffaloRate) || 0) : (Number(ratesConfig?.cowRate) || 0));
    }

    const kgValue = kgStr !== undefined && kgStr !== "" ? parseFloat(kgStr) : (existingEntry ? Number(existingEntry.kgWeight) : 0);
    
    if (isNaN(kgValue) || kgValue < 0) return;

    setSavingStatus(prev => ({ ...prev, [farmerId]: 'saving' }));

    const quantityLitre = parseFloat((kgValue * CONVERSION_RATE).toFixed(2));
    const totalAmount = parseFloat((quantityLitre * managedRate).toFixed(2));

    const entryId = `${farmerId}_${date}_${session}`;
    const docRef = doc(firestore, 'entries', entryId);

    setDocumentNonBlocking(docRef, {
      farmerId,
      farmerName: farmer.name || "",
      canNumber: farmer.canNumber || "",
      milkType: farmer.milkType || 'COW',
      date,
      session,
      kgWeight: kgValue,
      quantity: quantityLitre,
      conversionRate: CONVERSION_RATE,
      rate: managedRate, 
      totalAmount: totalAmount,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    setTimeout(() => {
      setSavingStatus(prev => ({ ...prev, [farmerId]: 'saved' }));
    }, 500);
  };

  if (!date) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Daily Collection</h1>
              <p className="text-muted-foreground font-medium">Active Suppliers Only for {format(new Date(date), 'MMMM dd, yyyy')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[240px] rounded-full justify-start text-left font-bold border-primary/20", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {date ? format(new Date(date), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-3xl" align="end">
                  <Calendar
                    mode="single"
                    selected={new Date(date)}
                    onSelect={(d) => d && setDate(format(d, 'yyyy-MM-dd'))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Tabs value={session} onValueChange={(v) => setSession(v as any)} className="w-full sm:w-auto">
                <TabsList className="grid grid-cols-2 w-full sm:w-[240px] rounded-full">
                  <TabsTrigger value="Morning" className="rounded-full gap-2">
                    <Sun className="w-4 h-4" /> Morning
                  </TabsTrigger>
                  <TabsTrigger value="Evening" className="rounded-full gap-2">
                    <Moon className="w-4 h-4" /> Evening
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                className="pl-10 h-12 bg-card rounded-2xl border-primary/10 shadow-sm" 
                placeholder="Search active CAN or name..." 
                value={searchTerm || ""}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
              <Scale className="w-5 h-5 text-primary" />
              <div className="text-xs">
                <p className="font-bold text-primary uppercase">Business Standard</p>
                <p className="text-muted-foreground font-black">1 Kg = 0.97 L</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-accent/5 rounded-2xl border border-accent/10">
              <IndianRupee className="w-5 h-5 text-accent" />
              <div className="text-xs">
                <p className="font-bold text-accent uppercase">Current Procurement Rates</p>
                <p className="text-muted-foreground font-black">Cow: ₹{Number(ratesConfig?.cowRate || 0).toFixed(2)} | Buffalo: ₹{Number(ratesConfig?.buffaloRate || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-lg bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px] font-bold py-4 pl-6">CAN</TableHead>
                  <TableHead className="font-bold">Farmer Name</TableHead>
                  <TableHead className="w-[120px] font-bold">Volume (L)</TableHead>
                  <TableHead className="w-[180px] font-bold">Weight (Kg)</TableHead>
                  <TableHead className="w-[150px] font-bold">Rate (₹/L)</TableHead>
                  <TableHead className="w-[120px] font-bold text-right">Payout (₹)</TableHead>
                  <TableHead className="w-[80px] text-right pr-6 font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFarmers.map((farmer) => {
                  const existingEntry = entries?.find(e => e.farmerId === farmer.id);
                  const currentKgStr = kgValues[farmer.id] !== undefined 
                    ? kgValues[farmer.id] 
                    : (existingEntry ? Number(existingEntry.kgWeight).toString() : "");
                  
                  const kgNum = parseFloat(currentKgStr);
                  const previewLitre = !isNaN(kgNum) ? (kgNum * CONVERSION_RATE).toFixed(2) : "0.00";
                  
                  let managedRate = (existingEntry?.rate !== undefined && Number(existingEntry.rate) > 0) ? Number(existingEntry.rate) : (
                    Number(farmer.customRate) > 0 
                      ? Number(farmer.customRate) 
                      : (farmer.milkType === 'BUFFALO' ? (Number(ratesConfig?.buffaloRate) || 0) : (Number(ratesConfig?.cowRate) || 0))
                  );
                  
                  const previewAmount = !isNaN(kgNum) ? (parseFloat(previewLitre) * managedRate).toFixed(2) : "0.00";
                  const status = savingStatus[farmer.id] || (existingEntry ? 'saved' : 'idle');

                  return (
                    <TableRow key={farmer.id} className={cn(existingEntry && "bg-primary/5 transition-colors")}>
                      <TableCell className="font-black text-primary pl-6 text-lg">{farmer.canNumber || ""}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-base uppercase">{farmer.name || ""}</span>
                          <Badge variant={farmer.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[10px] w-fit h-4 rounded-full font-black">
                            {farmer.milkType || 'COW'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-black text-primary/70">
                          <Droplets className="w-3 h-3" /> {previewLitre} L
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="relative group">
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            step="0.01"
                            disabled={!ratesConfig}
                            className="h-11 rounded-xl pr-12 font-bold text-lg border-primary/10 focus:border-primary"
                            value={currentKgStr || ""}
                            onChange={(e) => handleKgChange(farmer.id, e.target.value)}
                            onBlur={() => handleAutoSave(farmer.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAutoSave(farmer.id)}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-40 uppercase">KG</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn(
                          "h-11 flex items-center justify-between px-4 rounded-xl border border-transparent font-black text-sm bg-muted/30 text-muted-foreground",
                          Number(farmer.customRate) > 0 && (farmer.milkType === 'BUFFALO' ? "bg-accent/10 text-accent border-accent/20" : "bg-primary/10 text-primary border-primary/20")
                        )}>
                          <span>₹ {managedRate.toFixed(2)}</span>
                          <Lock className="w-3 h-3 opacity-30" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm font-black text-foreground">
                          ₹ {previewAmount}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end">
                          {status === 'saving' && <Loader2 className="w-5 h-5 animate-spin text-primary/40" />}
                          {status === 'saved' && <CheckCircle2 className="w-5 h-5 text-green-500 animate-in zoom-in duration-300" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
