
"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, query, where, serverTimestamp, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { format, endOfMonth, subMonths } from "date-fns";
import { Search, IndianRupee, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CycleSalesPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [quantityValues, setQuantityValues] = useState<Record<string, string>>({});
  const [amountValues, setAmountValues] = useState<Record<string, string>>({});
  const [milkTypes, setMilkTypes] = useState<Record<string, 'COW' | 'BUFFALO'>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [isClient, setIsClient] = useState(false);

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

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'buyers');
  }, [firestore]);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedMonth) return null;
    return query(
      collection(firestore, 'sales'), 
      where('month', '==', selectedMonth),
      where('cycleId', '==', activeCycle)
    );
  }, [firestore, selectedMonth, activeCycle]);

  const { data: buyers } = useCollection(buyersQuery);
  const { data: sales } = useCollection(salesQuery);

  const filteredBuyers = (buyers || [])
    .filter(b => 
      (b.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (b.buyerCode || "").toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.buyerCode || "").localeCompare(b.buyerCode || ""));

  const handleQuantityChange = (buyerId: string, value: string) => {
    setQuantityValues(prev => ({ ...prev, [buyerId]: value }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleAmountChange = (buyerId: string, value: string) => {
    setAmountValues(prev => ({ ...prev, [buyerId]: value }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
  };

  const handleMilkTypeChange = (buyerId: string, type: 'COW' | 'BUFFALO') => {
    setMilkTypes(prev => ({ ...prev, [buyerId]: type }));
    setSavingStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
    setTimeout(() => handleAutoSave(buyerId), 100);
  };

  const handleAutoSave = (buyerId: string) => {
    const qtyStr = quantityValues[buyerId];
    const amtStr = amountValues[buyerId];
    const milkType = milkTypes[buyerId] || 'COW';
    
    if (!firestore || !selectedMonth) return;

    const existingSale = sales?.find(s => s.buyerId === buyerId);
    
    const qtyNum = qtyStr !== undefined 
      ? (qtyStr === "" ? 0 : parseFloat(qtyStr)) 
      : (existingSale ? Number(existingSale.quantity) : 0);
      
    const amtNum = amtStr !== undefined 
      ? (amtStr === "" ? 0 : parseFloat(amtStr)) 
      : (existingSale ? Number(existingSale.totalAmount) : 0);

    const effectiveRate = qtyNum > 0 ? parseFloat((amtNum / qtyNum).toFixed(2)) : 0;

    setSavingStatus(prev => ({ ...prev, [buyerId]: 'saving' }));

    const saleId = `${buyerId}_${selectedMonth}_C${activeCycle}`;
    const docRef = doc(firestore, 'sales', saleId);

    setDocumentNonBlocking(docRef, {
      buyerId,
      month: selectedMonth,
      cycleId: activeCycle,
      cycleLabel: cycles[activeCycle]?.label || "",
      date: `${selectedMonth}-${cycles[activeCycle]?.start.toString().padStart(2, '0')}`,
      milkType,
      quantity: qtyNum,
      totalAmount: amtNum,
      rate: effectiveRate,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    setTimeout(() => {
      setSavingStatus(prev => ({ ...prev, [buyerId]: 'saved' }));
    }, 500);
  };

  const dynamicGrandTotal = useMemo(() => {
    if (!buyers) return 0;
    const revenueMap = new Map<string, number>();
    buyers.forEach(buyer => {
      const localAmt = amountValues[buyer.id];
      if (localAmt !== undefined) {
        revenueMap.set(buyer.id, localAmt === "" ? 0 : parseFloat(localAmt) || 0);
      } else {
        const dbSale = sales?.find(s => s.buyerId === buyer.id);
        revenueMap.set(buyer.id, dbSale ? Number(dbSale.totalAmount) || 0 : 0);
      }
    });
    return Array.from(revenueMap.values()).reduce((acc, val) => acc + val, 0);
  }, [buyers, sales, amountValues]);

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Cycle Sales</h1>
              <p className="text-muted-foreground font-medium">Record sales for 10-day cycles.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[200px] rounded-full font-bold h-11 border-primary/20 shadow-sm bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-full border shadow-sm">
                {cycles.map((c, i) => (
                  <button key={i} onClick={() => { setActiveCycle(i); setQuantityValues({}); setAmountValues({}); }} className={cn("rounded-full text-[10px] font-black px-4 h-9 transition-all", activeCycle === i ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted")}>{c.label}</button>
                ))}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-12 h-14 bg-card rounded-2xl border-primary/10 shadow-sm" placeholder="Search by name or code..." value={searchTerm || ""} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Card className="flex items-center justify-between px-6 py-2 bg-accent/5 rounded-2xl border border-accent/10 shadow-sm">
              <div className="text-right w-full">
                <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Calculated Cycle Revenue</p>
                <p className="text-2xl font-black text-primary">₹ {dynamicGrandTotal.toFixed(2)}</p>
              </div>
            </Card>
          </div>

          <Card className="rounded-[2rem] overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow>
                  <TableHead className="w-[100px] font-black text-primary pl-10 py-5 uppercase text-[10px] tracking-widest">Code</TableHead>
                  <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Buyer Name</TableHead>
                  <TableHead className="w-[140px] font-black text-primary uppercase text-[10px] tracking-widest text-center">Milk Type</TableHead>
                  <TableHead className="w-[180px] font-black text-primary uppercase text-[10px] tracking-widest">Qty (L)</TableHead>
                  <TableHead className="w-[220px] font-black text-primary uppercase text-[10px] tracking-widest">Amount (₹)</TableHead>
                  <TableHead className="w-[100px] text-right pr-10 font-black text-primary uppercase text-[10px] tracking-widest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBuyers.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No buyers found.</TableCell></TableRow> : filteredBuyers.map((buyer) => {
                  const existingSale = sales?.find(s => s.buyerId === buyer.id);
                  const currentQtyStr = quantityValues[buyer.id] !== undefined ? quantityValues[buyer.id] : (existingSale ? existingSale.quantity.toString() : "");
                  const currentAmountStr = amountValues[buyer.id] !== undefined ? amountValues[buyer.id] : (existingSale ? existingSale.totalAmount.toString() : "");
                  const currentMilkType = milkTypes[buyer.id] || (existingSale ? existingSale.milkType : 'COW');
                  const status = savingStatus[buyer.id] || (existingSale ? 'saved' : 'idle');

                  return (
                    <TableRow key={buyer.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-black text-primary pl-10 text-lg uppercase">{buyer.buyerCode || ""}</TableCell>
                      <TableCell className="font-bold text-base uppercase">{buyer.name || ""}</TableCell>
                      <TableCell className="text-center">
                        <Select value={currentMilkType} onValueChange={(v) => handleMilkTypeChange(buyer.id, v as any)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="COW">COW</SelectItem><SelectItem value="BUFFALO">BUFFALO</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" placeholder="0.00" value={currentQtyStr || ""} onChange={(e) => handleQuantityChange(buyer.id, e.target.value)} onBlur={() => handleAutoSave(buyer.id)} className="rounded-xl h-11" /></TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input type="number" placeholder="0.00" value={currentAmountStr || ""} onChange={(e) => handleAmountChange(buyer.id, e.target.value)} onBlur={() => handleAutoSave(buyer.id)} className="rounded-xl h-11 pl-10" />
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-10">
                        {status === 'saving' && <Loader2 className="animate-spin text-primary/40 w-5 h-5 ml-auto" />}
                        {status === 'saved' && <CheckCircle2 className="text-green-500 w-5 h-5 ml-auto animate-in zoom-in duration-300" />}
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
