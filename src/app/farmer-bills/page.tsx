"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  ChevronRight,
  FileDown,
  Loader2,
  Scale,
  Droplets
} from "lucide-react";
import { format, endOfMonth, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export default function FarmerBillsPage() {
  const firestore = useFirestore();
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [activeCycle, setActiveCycle] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);

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

  const currentCycle = useMemo(() => cycles[activeCycle] || null, [cycles, activeCycle]);

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

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: allEntries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers, isLoading: farmersLoading } = useCollection(farmersQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const masterRoster = useMemo(() => {
    if (!allEntries || !selectedMonth || !currentCycle || !farmers || !ratesConfig) return [];
    
    const map: Record<string, any> = {};
    const cycleEntries = allEntries.filter(e => {
      const dayStr = e.date.split('-')[2];
      const day = parseInt(dayStr);
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
          can: e.canNumber || (farmerProfile?.canNumber) || "",
          name: e.farmerName || (farmerProfile?.name) || "Unknown Farmer",
          milkType: e.milkType || farmerProfile?.milkType || "COW",
          active: farmerProfile ? farmerProfile.active !== false : true,
          totalQty: 0,
          totalKg: 0,
          totalAmount: 0
        };
      }

      // RECTIFICATION: Prioritize Weight-based calculation to ensure 0.97 is applied everywhere
      const entryKg = Number(e.kgWeight) || 0;
      const entryQty = entryKg * CONVERSION_RATE;
      
      // RATE RESOLUTION: Stored > Profile Custom > Global Settings
      const entryRate = (e.rate !== undefined && e.rate !== null && Number(e.rate) > 0) ? Number(e.rate) : (
        (farmerProfile && Number(farmerProfile.customRate) > 0) ? Number(farmerProfile.customRate) : (
          (e.milkType || farmerProfile?.milkType || "COW") === 'BUFFALO' ? (Number(ratesConfig.buffaloRate) || 0) : (Number(ratesConfig.cowRate) || 0)
        )
      );

      const entryAmt = entryQty * entryRate;

      map[idKey].totalQty += entryQty;
      map[idKey].totalKg += entryKg;
      map[idKey].totalAmount += entryAmt;
    });

    return Object.values(map).sort((a: any, b: any) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      return (isNaN(aNum) || isNaN(bNum)) ? String(a.can).localeCompare(String(b.can)) : aNum - bNum;
    });
  }, [allEntries, farmers, selectedMonth, currentCycle, ratesConfig, CONVERSION_RATE]);

  const totals = useMemo(() => {
    return masterRoster.reduce((acc, curr) => ({
      qty: acc.qty + curr.totalQty,
      kg: acc.kg + curr.totalKg,
      amt: acc.amt + curr.totalAmount
    }), { qty: 0, kg: 0, amt: 0 });
  }, [masterRoster]);

  const generateProfessionalInvoice = (pdf: jsPDF, f: any) => {
    const company = (ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS").toUpperCase();
    const [year, month] = selectedMonth.split('-').map(Number);
    const period = `${currentCycle?.start}/${month}/${year.toString().slice(-2)} to ${currentCycle?.end}/${month}/${year.toString().slice(-2)}`;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(company, pageWidth / 2, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text("DETAILED MILK INVOICE (KG | LTR)", pageWidth / 2, 27, { align: 'center' });
    pdf.line(pageWidth / 2 - 30, 28, pageWidth / 2 + 30, 28); 

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    
    const drawField = (label: string, value: string, x: number, y: number, width: number) => {
      pdf.text(label, x, y);
      const labelW = pdf.getTextWidth(label);
      pdf.setFont("helvetica", "bold");
      pdf.text(String(value).toUpperCase(), x + labelW + 5, y);
      pdf.line(x + labelW + 4, y + 1, x + width, y + 1);
      pdf.setFont("helvetica", "normal");
    };

    const profile = farmers?.find(item => item.id === f.id || (item.canNumber && f.can && String(item.canNumber) === String(f.can)));
    drawField("NAME:", f.name || "---", 20, 45, 100);
    drawField("DATE:", format(new Date(), 'dd/MM/yyyy'), 110, 45, 190);
    drawField("A/C NO:", profile?.bankAccountNumber || "---", 20, 55, 100);
    drawField("PERIOD:", period, 110, 55, 190);
    drawField("CAN NO:", f.can || "---", 20, 65, 100);
    const avgR = f.totalQty > 0 ? (f.totalAmount / f.totalQty).toFixed(2) : "0.00";
    drawField("AVG RATE:", `Rs ${avgR}`, 110, 65, 190);

    const rows = [];
    if (currentCycle) {
      for (let d = currentCycle.start; d <= currentCycle.end; d++) {
        const ds = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const dayE = allEntries!.filter(e => (e.farmerId === f.id || (e.canNumber && f.can && String(e.canNumber) === String(f.can))) && e.date === ds);
        
        const morning = dayE.find(e => e.session === 'Morning');
        const evening = dayE.find(e => e.session === 'Evening');

        const mKg = Number(morning?.kgWeight) || 0;
        const eKg = Number(evening?.kgWeight) || 0;
        const mQ = mKg * CONVERSION_RATE;
        const eQ = eKg * CONVERSION_RATE;
        
        const tQ = mQ + eQ;
        const tKg = mKg + eKg;
        
        const dayAmt = dayE.reduce((acc, entry) => {
          const ltr = Number(entry.kgWeight) * CONVERSION_RATE;
          const resolvedRate = (entry.rate !== undefined && entry.rate !== null && Number(entry.rate) > 0) ? Number(entry.rate) : (
            (profile && Number(profile.customRate) > 0) ? Number(profile.customRate) : (
              (entry.milkType || profile?.milkType || "COW") === 'BUFFALO' ? (Number(ratesConfig?.buffaloRate) || 0) : (Number(ratesConfig?.cowRate) || 0)
            )
          );
          return acc + (ltr * resolvedRate);
        }, 0);

        const effectiveRate = tQ > 0 ? (dayAmt / tQ) : 0;
        
        rows.push([
          format(new Date(year, month - 1, d), 'dd/MM/yy'), 
          mKg.toFixed(2),
          mQ.toFixed(2), 
          eKg.toFixed(2),
          eQ.toFixed(2), 
          tKg.toFixed(2),
          tQ.toFixed(2), 
          effectiveRate.toFixed(2), 
          dayAmt.toFixed(2)
        ]);
      }
    }

    (pdf as any).autoTable({
      startY: 75,
      head: [['DATE', 'AM-KG', 'AM-L', 'PM-KG', 'PM-L', 'TOT-KG', 'TOT-L', 'RATE', 'AMOUNT']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { halign: 'center', fontSize: 8 },
      margin: { left: 15, right: 15 }
    });

    const finalY = (pdf as any).lastAutoTable.finalY;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("GRAND TOTAL", 15, finalY + 8);
    pdf.text(f.totalKg.toFixed(2), 115, finalY + 8, { align: 'center' });
    pdf.text(f.totalQty.toFixed(2), 138, finalY + 8, { align: 'center' });
    pdf.text(`Rs ${f.totalAmount.toFixed(2)}`, 185, finalY + 8, { align: 'right' });

    if (ratesConfig?.stampUrl) {
      try {
        const formatMatch = ratesConfig.stampUrl.match(/^data:image\/([a-zA-Z+]+);base64,/);
        const imageFormat = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
        const finalFormat = imageFormat.includes('JP') ? 'JPEG' : 'PNG';
        pdf.addImage(ratesConfig.stampUrl, finalFormat, pageWidth - 70, pageHeight - 50, 50, 25);
      } catch (e) {
        console.error("PDF Stamp Error:", e);
      }
    }
    pdf.setFontSize(10);
    pdf.text("AUTHORIZED SIGNATURE", pageWidth - 15, pageHeight - 15, { align: 'right' });
    pdf.line(pageWidth - 75, pageHeight - 25, pageWidth - 15, pageHeight - 25);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Farmer Bills</h1>
              <p className="text-muted-foreground font-medium">0.97 Conversion Standard.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] rounded-full font-bold h-11 border-primary/20 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-full border shadow-sm">
                {cycles.map((c, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveCycle(i)} 
                    className={cn(
                      "rounded-full text-[10px] font-black px-4 h-9 transition-all", 
                      activeCycle === i ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="mb-6 flex justify-end">
            <Button 
              onClick={() => {
                const pdf = new jsPDF();
                const validFarmers = masterRoster.filter(f => f.totalQty > 0);
                if (validFarmers.length === 0) return;
                validFarmers.forEach((f, i) => { if (i > 0) pdf.addPage(); generateProfessionalInvoice(pdf, f); });
                pdf.save(`Detailed_Bills_${selectedMonth}_${currentCycle?.label || 'Cycle'}.pdf`);
              }}
              className="rounded-full bg-rose-600 hover:bg-rose-700 h-12 px-10 shadow-lg font-black uppercase text-xs"
            >
              <FileDown className="mr-2 h-4 w-4" /> Download Detailed Cycle Bills
            </Button>
          </div>

          <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-10 font-black text-[10px] uppercase w-[100px]">CAN</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Farmer Name</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Milk Type</TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase">
                    <div className="flex items-center justify-end gap-1"><Scale className="w-3 h-3" /> Weight (Kg)</div>
                  </TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase">
                    <div className="flex items-center justify-end gap-1"><Droplets className="w-3 h-3" /> Volume (L)</div>
                  </TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase">Payout (Rs)</TableHead>
                  <TableHead className="text-right pr-10 font-black text-[10px] uppercase">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesLoading || farmersLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : masterRoster.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20 italic text-muted-foreground font-black uppercase text-[10px]">No records found for this cycle.</TableCell></TableRow>
                ) : (
                  masterRoster.map(f => (
                    <TableRow key={f.id} className={cn("hover:bg-primary/5 transition-colors group", !f.active && "opacity-60")}>
                      <TableCell className="pl-10 font-black text-primary text-lg">{f.can}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase text-sm">{f.name}</span>
                          {!f.active && <span className="text-[8px] font-black text-destructive uppercase tracking-tighter">Inactive Supplier</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[9px] rounded-full px-2 font-black">
                          {f.milkType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-base text-muted-foreground/70">{f.totalKg.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-black text-base text-primary/80">{f.totalQty.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-10 font-black text-primary text-base">₹ {f.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-10">
                        <Button 
                          variant="ghost" size="sm" 
                          onClick={() => {
                            const pdf = new jsPDF();
                            generateProfessionalInvoice(pdf, f);
                            pdf.save(`Bill_${f.can}_${(f.name || "").replace(/\s+/g, '_')}.pdf`);
                          }}
                          className="text-primary font-black uppercase text-[10px] group-hover:bg-primary/10 rounded-full h-8 px-4"
                        >
                          Print <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {masterRoster.length > 0 && (
                <TableFooter className="bg-muted/50 font-black border-t-2">
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="pl-10 uppercase text-[10px] tracking-widest">Grand Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-base text-muted-foreground">{totals.kg.toFixed(2)} Kg</TableCell>
                    <TableCell className="text-right text-base text-primary">{totals.qty.toFixed(2)} L</TableCell>
                    <TableCell className="text-right pr-10 text-primary text-base">₹ {totals.amt.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
