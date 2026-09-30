"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  FileBarChart, 
  Printer, 
  Calendar as CalendarIcon, 
  FileSpreadsheet, 
  Users, 
  Loader2 
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { utils, writeFile } from "xlsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export default function DailyReportsPage() {
  const firestore = useFirestore();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isClient, setIsClient] = useState(false);

  // PRECISION LOCK: 0.97 Standard
  const CONVERSION_RATE = 0.97;

  useEffect(() => {
    setIsClient(true);
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const entriesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedDate) return null;
    return query(collection(firestore, 'entries'), where('date', '==', selectedDate));
  }, [firestore, selectedDate]);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'milk_rates');
  }, [firestore]);

  const { data: entries, isLoading: entriesLoading } = useCollection(entriesQuery);
  const { data: farmers, isLoading: farmersLoading } = useCollection(farmersQuery);
  const { data: ratesConfig } = useDoc(settingsRef);

  const dailyData = useMemo(() => {
    if (!entries || !selectedDate || !farmers || !ratesConfig) return [];
    
    const map: Record<string, any> = {};
    
    entries.forEach(e => {
      const fid = e.farmerId;
      const farmerProfile = farmers.find(f => 
        f.id === fid || 
        (f.canNumber && e.canNumber && String(f.canNumber) === String(e.canNumber))
      );
      
      const name = farmerProfile?.name || e.farmerName || "Unknown Farmer";
      const can = farmerProfile?.canNumber || e.canNumber || "---";
      const milkType = e.milkType || farmerProfile?.milkType || "COW";
      const idKey = fid || can;

      if (!map[idKey]) {
        map[idKey] = {
          fid: idKey,
          can,
          name,
          milkType,
          active: farmerProfile ? farmerProfile.active !== false : true,
          amKg: 0, amLtr: 0,
          pmKg: 0, pmLtr: 0,
          totalLtr: 0, totalAmt: 0
        };
      }
      
      const kg = Number(e.kgWeight) || 0;
      // RECTIFICATION: Standardize conversion across all dates
      const ltr = kg * CONVERSION_RATE;
      
      const resolvedRate = (e.rate !== undefined && e.rate !== null && Number(e.rate) > 0) ? Number(e.rate) : (
        (farmerProfile && Number(farmerProfile.customRate) > 0) ? Number(farmerProfile.customRate) : (
          milkType === 'BUFFALO' ? Number(ratesConfig.buffaloRate) : Number(ratesConfig.cowRate)
        )
      );
      const amt = ltr * resolvedRate;

      if (e.session === 'Morning') {
        map[idKey].amKg += kg;
        map[idKey].amLtr += ltr;
      } else {
        map[idKey].pmKg += kg;
        map[idKey].pmLtr += ltr;
      }
      
      map[idKey].totalLtr += ltr;
      map[idKey].totalAmt += amt;
    });

    return Object.values(map).sort((a: any, b: any) => {
      const aNum = parseInt(a.can);
      const bNum = parseInt(b.can);
      return (isNaN(aNum) || isNaN(bNum)) ? String(a.can).localeCompare(String(b.can)) : aNum - bNum;
    });
  }, [entries, farmers, selectedDate, ratesConfig, CONVERSION_RATE]);

  const totals = useMemo(() => {
    return dailyData.reduce((acc, curr) => ({
      amKg: acc.amKg + curr.amKg,
      amLtr: acc.amLtr + curr.amLtr,
      pmKg: acc.pmKg + curr.pmKg,
      pmLtr: acc.pmLtr + curr.pmLtr,
      totalLtr: acc.totalLtr + curr.totalLtr,
      totalAmt: acc.totalAmt + curr.totalAmt,
    }), { amKg: 0, amLtr: 0, pmKg: 0, pmLtr: 0, totalLtr: 0, totalAmt: 0 });
  }, [dailyData]);

  const handleExportExcel = () => {
    const data = dailyData.map((p: any) => ({
      "CAN": p.can,
      "FARMER NAME": p.name,
      "STATUS": p.active ? 'Active' : 'Inactive',
      "MILK TYPE": p.milkType,
      "AM-KG": p.amKg.toFixed(2),
      "AM-LITRE": p.amLtr.toFixed(2),
      "PM-KG": p.pmKg.toFixed(2),
      "PM-LITRE": p.pmLtr.toFixed(2),
      "TOTAL LITRES": p.totalLtr.toFixed(2),
      "PAYOUT (Rs)": p.totalAmt.toFixed(2)
    }));
    
    data.push({
      "CAN": "TOTAL",
      "FARMER NAME": "",
      "STATUS": "",
      "MILK TYPE": "",
      "AM-KG": totals.amKg.toFixed(2),
      "AM-LITRE": totals.amLtr.toFixed(2),
      "PM-KG": totals.pmKg.toFixed(2),
      "PM-LITRE": totals.pmLtr.toFixed(2),
      "TOTAL LITRES": totals.totalLtr.toFixed(2),
      "PAYOUT (Rs)": totals.totalAmt.toFixed(2)
    } as any);

    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Daily Procurement");
    writeFile(wb, `Daily_Procurement_${selectedDate}.xlsx`);
  };

  const handlePrintPDF = () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const company = (ratesConfig?.companyName || "SGK MILK DISTRIBUTIONS").toUpperCase();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFontSize(18);
    pdf.text(company, pageWidth / 2, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text(`DAILY PROCUREMENT REPORT - ${format(new Date(selectedDate), 'dd/MM/yyyy')}`, pageWidth / 2, 28, { align: 'center' });
    
    const bodyRows = dailyData.map(p => [
      p.can, 
      p.name, 
      p.milkType, 
      p.amKg.toFixed(2), 
      p.amLtr.toFixed(2), 
      p.pmKg.toFixed(2), 
      p.pmLtr.toFixed(2), 
      p.totalLtr.toFixed(2), 
      p.totalAmt.toFixed(2)
    ]);

    bodyRows.push([
      'TOTAL',
      '',
      '',
      totals.amKg.toFixed(2),
      totals.amLtr.toFixed(2),
      totals.pmKg.toFixed(2),
      totals.pmLtr.toFixed(2),
      totals.totalLtr.toFixed(2),
      totals.totalAmt.toFixed(2)
    ]);
    
    (pdf as any).autoTable({
      startY: 35,
      head: [['CAN', 'FARMER NAME', 'TYPE', 'AM-KG', 'AM-L', 'PM-KG', 'PM-L', 'TOT-L', 'PAYOUT (Rs)']],
      body: bodyRows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      bodyStyles: { halign: 'center' },
      didParseCell: function (data: any) {
        if (data.row.index === bodyRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 245];
        }
      }
    });

    if (ratesConfig?.stampUrl) {
      try {
        const formatMatch = ratesConfig.stampUrl.match(/^data:image\/([a-zA-Z+]+);base64,/);
        const imageFormat = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
        const finalFormat = imageFormat.includes('JP') ? 'JPEG' : 'PNG';
        pdf.addImage(ratesConfig.stampUrl, finalFormat, pageWidth - 60, pageHeight - 50, 40, 25);
      } catch (e) {
        console.error("Failed to add stamp to report PDF:", e);
      }
    }
    
    pdf.save(`Daily_Procurement_${selectedDate}.pdf`);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <FileBarChart className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">Financial Summary</span>
              </div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Daily Reports</h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                <Users className="w-4 h-4" /> 
                Validated Daily Collection Data (0.97 Standard)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full sm:w-[240px] rounded-full justify-start text-left font-bold border-primary/20 bg-card px-6 h-11 shadow-sm")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {selectedDate ? format(new Date(selectedDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-3xl" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate ? new Date(selectedDate) : undefined}
                    onSelect={(d) => d && setSelectedDate(format(d, 'yyyy-MM-dd'))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <div className="flex gap-2">
                <Button onClick={handleExportExcel} variant="outline" className="rounded-full font-black uppercase text-[10px] h-11 px-6">
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                </Button>
                <Button onClick={handlePrintPDF} className="rounded-full font-black uppercase text-[10px] h-11 px-8 shadow-lg">
                  <Printer className="mr-2 h-4 w-4" /> Print PDF
                </Button>
              </div>
            </div>
          </header>

          <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-black text-[10px] text-center border-r w-[80px] uppercase">CAN</TableHead>
                  <TableHead className="font-black text-[10px] border-r uppercase">Farmer Name</TableHead>
                  <TableHead className="font-black text-[10px] border-r text-center uppercase">Milk Type</TableHead>
                  <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-primary/5 uppercase tracking-widest">AM (Morning)</TableHead>
                  <TableHead colSpan={2} className="text-center font-black text-[10px] border-r bg-accent/5 uppercase tracking-widest">PM (Evening)</TableHead>
                  <TableHead className="text-center font-black text-[10px] border-r bg-muted/20 uppercase">Total (L)</TableHead>
                  <TableHead className="text-right font-black text-[10px] pr-8 uppercase">Amount (Rs)</TableHead>
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableHead className="border-r"></TableHead>
                  <TableHead className="border-r"></TableHead>
                  <TableHead className="border-r"></TableHead>
                  <TableHead className="text-center text-[8px] font-black border-r">KG</TableHead>
                  <TableHead className="text-center text-[8px] font-black border-r">LTR</TableHead>
                  <TableHead className="text-center text-[8px] font-black border-r">KG</TableHead>
                  <TableHead className="text-center text-[8px] font-black border-r">LTR</TableHead>
                  <TableHead className="border-r bg-muted/20"></TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesLoading || farmersLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : dailyData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20 italic text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                      No records found for the selected date.
                    </TableCell>
                  </TableRow>
                ) : dailyData.map((p: any, i) => (
                  <TableRow key={i} className={cn("hover:bg-primary/5 group transition-colors", !p.active && "opacity-60")}>
                    <TableCell className="text-center font-black border-r text-primary text-base">{p.can}</TableCell>
                    <TableCell className="border-r">
                      <div className="flex flex-col">
                        <span className="font-bold uppercase text-sm">{p.name}</span>
                        {!p.active && <span className="text-[8px] font-black text-destructive uppercase tracking-tighter">Inactive Supplier</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center border-r">
                      <Badge variant={p.milkType === 'BUFFALO' ? "secondary" : "outline"} className="text-[8px] rounded-full px-2 font-black uppercase">
                        {p.milkType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center border-r text-xs text-muted-foreground">{p.amKg.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r font-black text-primary">{p.amLtr.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r text-xs text-muted-foreground">{p.pmKg.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r font-black text-accent">{p.pmLtr.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r font-black text-primary bg-primary/5">{p.totalLtr.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-black pr-8 text-foreground/80">₹ {p.totalAmt.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {dailyData.length > 0 && (
                <TableFooter className="bg-muted/50 border-t-2 font-black">
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="border-r"></TableCell>
                    <TableCell className="border-r text-center uppercase text-[10px] tracking-widest">Grand Total</TableCell>
                    <TableCell className="border-r"></TableCell>
                    <TableCell className="text-center border-r text-xs text-muted-foreground/70">{totals.amKg.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r text-primary text-base">{totals.amLtr.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r text-xs text-muted-foreground/70">{totals.pmKg.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r text-accent text-base">{totals.pmLtr.toFixed(2)}</TableCell>
                    <TableCell className="text-center border-r text-primary bg-primary/5 text-lg">{totals.totalLtr.toFixed(2)} L</TableCell>
                    <TableCell className="text-right pr-8 text-foreground text-xl">₹ {totals.totalAmt.toFixed(2)}</TableCell>
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
