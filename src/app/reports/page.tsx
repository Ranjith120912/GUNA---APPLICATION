"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, deleteDoc, query, where } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  AlertTriangle,
  Users
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { utils, writeFile } from "xlsx";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ReportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isClient, setIsClient] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // PRECISION LOCK: 0.97 Standard
  const CONVERSION_RATE = 0.97;

  useEffect(() => {
    setIsClient(true);
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  }, []);

  const monthOptions = useMemo(() => {
    if (!isClient) return [];
    const now = new Date();
    return Array.from({ length: 12 }).map((_, i) => {
      const d = subMonths(now, i);
      return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
    });
  }, [isClient]);

  const cycles = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const lastDay = monthEnd.getDate();
    return [
      { id: 0, label: "Cycle 1", range: "1st - 10th", start: 1, end: 10 },
      { id: 1, label: "Cycle 2", range: "11th - 20th", start: 11, end: 20 },
      { id: 2, label: "Cycle 3", range: `21st - ${lastDay}`, start: 21, end: lastDay }
    ];
  }, [selectedMonth]);

  const currentCycle = cycles[activeCycle];

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedMonth) return null;
    return query(
      collection(firestore, 'entries'),
      where('date', '>=', `${selectedMonth}-01`),
      where('date', '<=', `${selectedMonth}-31`)
    );
  }, [firestore, selectedMonth]);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedMonth) return null;
    return query(
      collection(firestore, 'sales'),
      where('month', '==', selectedMonth)
    );
  }, [firestore, selectedMonth]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: monthEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers, isLoading: farmersLoading } = useCollection(farmersQuery);
  const { data: monthSales } = useCollection(salesQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const cycleRoster = useMemo(() => {
    if (!monthEntries || !selectedMonth || !currentCycle || !farmers || !ratesConfig) return [];
    const map: Record<string, any> = {};
    const cycleEntries = monthEntries.filter(e => {
      const day = parseInt(e.date.split('-')[2]);
      return day >= currentCycle.start && day <= currentCycle.end;
    });

    cycleEntries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => 
        f.id === fid || 
        (f.canNumber && e.canNumber && String(f.canNumber) === String(e.canNumber))
      );
      
      const idKey = fid || e.canNumber || "---";

      if (!map[idKey]) {
        map[idKey] = { 
          id: idKey, 
          can: e.canNumber || farmerProfile?.canNumber || "", 
          name: e.farmerName || farmerProfile?.name || "Unknown Farmer", 
          milkType: e.milkType || farmerProfile?.milkType || "COW", 
          active: farmerProfile ? farmerProfile.active !== false : true, 
          morningQty: 0, 
          eveningQty: 0, 
          totalQty: 0, 
          totalAmount: 0 
        };
      }

      // RECTIFICATION: Enforce 0.97 Standard
      const ltr = Number(e.kgWeight) * CONVERSION_RATE;
      const entryRate = (e.rate !== undefined && e.rate !== null && Number(e.rate) > 0) ? Number(e.rate) : (
        (farmerProfile && Number(farmerProfile.customRate) > 0) ? Number(farmerProfile.customRate) : (
          (e.milkType || farmerProfile?.milkType || "COW") === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate) || 0)
        )
      );
      const entryAmt = ltr * entryRate;

      if (e.session === 'Morning') map[idKey].morningQty += ltr; else map[idKey].eveningQty += ltr;
      map[idKey].totalQty += ltr;
      map[idKey].totalAmount += entryAmt;
    });

    return Object.values(map).sort((a: any, b: any) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      return (isNaN(aNum) || isNaN(bNum)) ? String(a.can).localeCompare(String(b.can)) : aNum - bNum;
    });
  }, [monthEntries, farmers, selectedMonth, currentCycle, ratesConfig, CONVERSION_RATE]);

  const monthlyRoster = useMemo(() => {
    if (!monthEntries || !selectedMonth || !farmers || !ratesConfig) return [];
    const map: Record<string, any> = {};

    monthEntries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => 
        f.id === fid || (f.canNumber && e.canNumber && String(f.canNumber) === String(e.canNumber))
      );
      
      const idKey = fid || e.canNumber || "---";

      if (!map[idKey]) {
        map[idKey] = { 
          id: idKey, 
          can: e.canNumber || farmerProfile?.canNumber || "", 
          name: e.farmerName || farmerProfile?.name || "Unknown Farmer", 
          milkType: e.milkType || farmerProfile?.milkType || "COW", 
          active: farmerProfile ? farmerProfile.active !== false : true, 
          morningQty: 0, 
          eveningQty: 0, 
          totalQty: 0, 
          totalAmount: 0 
        };
      }

      const ltr = Number(e.kgWeight) * CONVERSION_RATE;
      const entryRate = (e.rate !== undefined && e.rate !== null && Number(e.rate) > 0) ? Number(e.rate) : (
        (farmerProfile && Number(farmerProfile.customRate) > 0) ? Number(farmerProfile.customRate) : (
          (e.milkType || farmerProfile?.milkType || "COW") === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate) || 0)
        )
      );
      const entryAmt = ltr * entryRate;

      if (e.session === 'Morning') map[idKey].morningQty += ltr; else map[idKey].eveningQty += ltr;
      map[idKey].totalQty += ltr;
      map[idKey].totalAmount += entryAmt;
    });

    return Object.values(map).sort((a: any, b: any) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      return (isNaN(aNum) || isNaN(bNum)) ? String(a.can).localeCompare(String(b.can)) : aNum - bNum;
    });
  }, [monthEntries, farmers, selectedMonth, ratesConfig, CONVERSION_RATE]);

  const cycleTotals = useMemo(() => {
    return cycleRoster.reduce((acc, curr) => ({
      qty: acc.qty + curr.totalQty,
      amount: acc.amount + curr.totalAmount
    }), { qty: 0, amount: 0 });
  }, [cycleRoster]);

  const monthlyTotals = useMemo(() => {
    return monthlyRoster.reduce((acc, curr) => ({
      qty: acc.qty + curr.totalQty,
      amount: acc.amount + curr.totalAmount
    }), { qty: 0, amount: 0 });
  }, [monthlyRoster]);

  const getReconciledRevenue = (monthStr: string, cId?: number) => {
    if (!monthSales) return 0;
    const uniqueSales = new Map<string, number>();
    const records = monthSales.filter(s => s.month === monthStr && (cId === undefined || Number(s.cycleId) === cId));

    records.forEach(s => {
      const key = `${s.buyerId}_${s.cycleId}`;
      uniqueSales.set(key, Number(s.totalAmount) || 0);
    });
    return Array.from(uniqueSales.values()).reduce((a, b) => a + b, 0);
  };

  const cycleStats = useMemo(() => {
    const cost = cycleTotals.amount;
    const qty = cycleTotals.qty;
    const rev = getReconciledRevenue(selectedMonth, activeCycle);
    return { qty, cost, rev, profit: rev - cost };
  }, [cycleTotals, monthSales, selectedMonth, activeCycle]);

  const auditData = useMemo(() => {
    const opt = monthOptions.find(o => o.value === selectedMonth);
    if (!opt) return [];
    
    const tCost = monthlyTotals.amount;
    const tQty = monthlyTotals.qty;
    const tRev = getReconciledRevenue(selectedMonth);
    return [{ label: opt.label, value: opt.value, qty: tQty, cost: tCost, revenue: tRev, profit: tRev - tCost }];
  }, [monthlyTotals, monthSales, monthOptions, selectedMonth]);

  const handleExportExcel = (roster: any[], title: string) => {
    const data = roster.map(f => ({ CAN: f.can, Name: f.name, Status: f.active ? 'Active' : 'Inactive', Type: f.milkType, Morning: f.morningQty.toFixed(2), Evening: f.eveningQty.toFixed(2), Total: f.totalQty.toFixed(2), Payout: f.totalAmount.toFixed(2) }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, title);
    writeFile(wb, `${title}_${selectedMonth}.xlsx`);
  };

  const handleMasterReset = async () => {
    setIsResetting(true);
    try {
      if (monthEntries) for (const e of monthEntries) await deleteDoc(doc(firestore!, 'entries', e.id));
      if (monthSales) for (const s of monthSales) await deleteDoc(doc(firestore!, 'sales', s.id));
      toast({ title: "Reset Complete", description: "Selected month's data wiped." });
    } catch (e) {
      toast({ title: "Reset Failed", variant: "destructive" });
    } finally { setIsResetting(false); }
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Audit & Reports</h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2"><Users className="w-4 h-4" /> 0.97 Std Summary</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
               <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[220px] rounded-full font-bold h-11 border-primary/20 bg-card shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-full border shadow-sm">
                  {cycles.map((c, i) => (
                    <button key={i} onClick={() => setActiveCycle(i)} className={cn("rounded-full text-[10px] font-black px-4 h-9 transition-all", activeCycle === i ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted")}>{c.label}</button>
                  ))}
                </div>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted p-1 rounded-full">
              <TabsTrigger value="overview" className="rounded-full px-6">Overview</TabsTrigger>
              <TabsTrigger value="cycle" className="rounded-full px-6">Cycle Report</TabsTrigger>
              <TabsTrigger value="monthly" className="rounded-full px-6">Monthly Summary</TabsTrigger>
              <TabsTrigger value="audit" className="rounded-full px-6">Master Log</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] bg-primary text-white p-8 shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Volume</p>
                  <p className="text-4xl font-black mt-2">{cycleStats.qty.toFixed(2)} L</p>
                </Card>
                <Card className="rounded-[2rem] bg-accent text-white p-8 shadow-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Cycle Revenue</p>
                  <p className="text-4xl font-black mt-2">₹ {cycleStats.rev.toFixed(2)}</p>
                </Card>
                <Card className="rounded-[2rem] p-8 border-none bg-rose-500/10 text-rose-600">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Cycle Cost</p>
                  <p className="text-3xl font-black mt-2">₹ {cycleStats.cost.toFixed(2)}</p>
                </Card>
                <Card className="rounded-[2rem] p-8 border-none bg-emerald-500/10 text-emerald-600">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Cycle Profit</p>
                  <p className="text-3xl font-black mt-2">₹ {cycleStats.profit.toFixed(2)}</p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cycle" className="space-y-6">
              <div className="flex justify-end mb-4"><Button onClick={() => handleExportExcel(cycleRoster, "Cycle_Roster")} className="rounded-full h-11 px-8 shadow-lg">Export Cycle Excel</Button></div>
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5">Farmer Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5">Volume (L)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5">Payout (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : cycleRoster.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 italic">No matching records found.</TableCell></TableRow>
                    ) : cycleRoster.map(f => (
                      <TableRow key={f.id} className={cn("hover:bg-primary/5 transition-colors", !f.active && "opacity-60")}>
                        <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold uppercase text-sm">{f.name}</span>
                            {!f.active && <span className="text-[8px] font-black text-destructive uppercase tracking-tighter">Inactive Supplier</span>}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="rounded-full text-[9px] font-black">{f.milkType}</Badge></TableCell>
                        <TableCell className="text-right font-bold">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-primary">₹ {f.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {cycleRoster.length > 0 && (
                    <TableFooter className="bg-muted/50 font-black border-t-2">
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="pl-10 uppercase text-[10px] tracking-widest">Grand Total</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-base">{cycleTotals.qty.toFixed(2)} L</TableCell>
                        <TableCell className="text-right pr-10 text-primary text-base">₹ {cycleTotals.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6">
              <div className="flex justify-end mb-4"><Button onClick={() => handleExportExcel(monthlyRoster, "Monthly_Roster")} className="rounded-full h-11 px-8 shadow-lg">Export Monthly Excel</Button></div>
              <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-5">CAN</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5">Farmer Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-5">Milk Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase py-5">Volume (L)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase py-5">Payout (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : monthlyRoster.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 italic">No records for this month.</TableCell></TableRow>
                    ) : monthlyRoster.map(f => (
                      <TableRow key={f.id} className={cn("hover:bg-primary/5 transition-colors", !f.active && "opacity-60")}>
                        <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold uppercase text-sm">{f.name}</span>
                            {!f.active && <span className="text-[8px] font-black text-destructive uppercase tracking-tighter">Inactive Supplier</span>}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="rounded-full text-[9px] font-black">{f.milkType}</Badge></TableCell>
                        <TableCell className="text-right font-bold">{f.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-primary">₹ {f.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {monthlyRoster.length > 0 && (
                    <TableFooter className="bg-muted/50 font-black border-t-2">
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="pl-10 uppercase text-[10px] tracking-widest">Grand Total</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-base">{monthlyTotals.qty.toFixed(2)} L</TableCell>
                        <TableCell className="text-right pr-10 text-primary text-base">₹ {monthlyTotals.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-sm">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow>
                      <TableHead className="pl-10 font-black text-[10px] uppercase py-8">Period</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase">Vol (L)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase">Cost (₹)</TableHead>
                      <TableHead className="text-center font-black text-[10px] uppercase">Revenue (₹)</TableHead>
                      <TableHead className="text-right pr-10 font-black text-[10px] uppercase">Margin (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.map((row, i) => (
                      <TableRow key={i} className="hover:bg-primary/5">
                        <TableCell className="pl-10 font-black text-primary uppercase py-8">{row.label}</TableCell>
                        <TableCell className="text-center font-bold">{row.qty.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-rose-600 font-black">₹ {row.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-accent font-black">₹ {row.revenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-10 font-black text-2xl tracking-tighter">
                          <span className={row.profit >= 0 ? "text-emerald-600" : "text-rose-600"}>₹ {row.profit.toFixed(2)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {auditData.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-20">Select a month to see audit details.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
              <div className="flex justify-end pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" className="rounded-full text-destructive border border-dashed border-destructive/20 font-black uppercase text-[10px] px-8 h-12">Master Reset</Button></AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase tracking-tight">
                        <AlertTriangle className="w-5 h-5" /> Irreversible Wipe
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-medium">Wipe ALL entries and sales for the selected month? This is permanent.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="rounded-full">No</AlertDialogCancel><AlertDialogAction onClick={handleMasterReset} className="bg-destructive text-white rounded-full">{isResetting ? <Loader2 className="animate-spin" /> : "Yes, Wipe All"}</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
