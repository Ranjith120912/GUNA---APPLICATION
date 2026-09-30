"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Search, FileUp, ClipboardList, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FarmersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newFarmer, setNewFarmer] = useState({ name: "", canNumber: "", accountNumber: "" });
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const { data: farmers, isLoading } = useCollection(farmersQuery);

  const filteredFarmers = farmers?.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.canNumber.includes(searchTerm)
  ).sort((a, b) => parseInt(a.canNumber) - parseInt(b.canNumber));

  const handleAddFarmer = () => {
    if (!newFarmer.name || !newFarmer.canNumber) {
      toast({ title: "Error", description: "Name and CAN number are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'farmers'), {
      ...newFarmer,
      active: true,
      createdAt: serverTimestamp(),
    });

    setNewFarmer({ name: "", canNumber: "", accountNumber: "" });
    setIsAdding(false);
    toast({ title: "Success", description: "Farmer added successfully." });
  };

  const handleBulkImport = () => {
    if (!firestore) return;
    try {
      const data = JSON.parse(importData);
      if (!Array.isArray(data)) throw new Error("Data must be an array of objects.");

      let count = 0;
      data.forEach((item: any) => {
        if (item.name && item.canNumber) {
          addDocumentNonBlocking(collection(firestore, 'farmers'), {
            name: item.name,
            canNumber: item.canNumber.toString().padStart(3, '0'),
            accountNumber: item.accountNumber || "",
            active: true,
            createdAt: serverTimestamp(),
          });
          count++;
        }
      });

      toast({ title: "Import Successful", description: `Added ${count} farmers.` });
      setImportData("");
      setIsImporting(false);
    } catch (e: any) {
      toast({ title: "Import Failed", description: e.message || "Invalid JSON format.", variant: "destructive" });
    }
  };

  const templateJSON = JSON.stringify([
    { "name": "Rajesh Kumar", "canNumber": "101", "accountNumber": "9876543210" },
    { "name": "Suresh Singh", "canNumber": "102", "accountNumber": "1234567890" }
  ], null, 2);

  const downloadTemplate = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(templateJSON);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "farmers_template.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast({ title: "Downloading", description: "Farmer template downloaded successfully." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">Farmer Management</h1>
              <p className="text-muted-foreground">Directory of milk suppliers (farmers) and accounts.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"} className="rounded-full">
                <UserPlus className="w-4 h-4 mr-2" />
                {isAdding ? "Cancel" : "Add Farmer"}
              </Button>
              
              <Dialog open={isImporting} onOpenChange={setIsImporting}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="rounded-full">
                    <FileUp className="w-4 h-4 mr-2" />
                    Bulk Import
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-primary">Import Farmers</DialogTitle>
                    <DialogDescription>
                      Paste your farmer data in JSON format or download the template.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="bg-muted p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        <span>Data Template</span>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={downloadTemplate}>
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(templateJSON);
                              toast({ title: "Copied", description: "Template copied to clipboard." });
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                      <pre className="text-[10px] text-primary overflow-x-auto font-mono bg-background/50 p-2 rounded-lg">
                        {templateJSON}
                      </pre>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-primary">JSON Data</label>
                      <Textarea 
                        placeholder='Paste your JSON array here...' 
                        value={importData}
                        onChange={(e) => setImportData(e.target.value)}
                        className="min-h-[200px] font-mono text-xs rounded-2xl"
                      />
                    </div>
                  </div>

                  <DialogFooter className="flex gap-2 sm:justify-between items-center border-t pt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="w-4 h-4 text-accent" />
                      Unique CAN numbers required
                    </div>
                    <Button onClick={handleBulkImport} className="rounded-full px-8">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Start Import
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {isAdding && (
            <Card className="mb-8 border-primary/20 bg-primary/5 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  New Farmer Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Full Name</label>
                    <Input 
                      placeholder="e.g. John Doe" 
                      value={newFarmer.name}
                      onChange={(e) => setNewFarmer({...newFarmer, name: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">CAN Number</label>
                    <Input 
                      placeholder="e.g. 001" 
                      value={newFarmer.canNumber}
                      onChange={(e) => setNewFarmer({...newFarmer, canNumber: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Bank Account Number</label>
                    <Input 
                      placeholder="e.g. 9123456789" 
                      value={newFarmer.accountNumber}
                      onChange={(e) => setNewFarmer({...newFarmer, accountNumber: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleAddFarmer} className="rounded-full px-8">Save Farmer</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              className="pl-12 h-14 bg-card rounded-2xl border-primary/10 shadow-sm focus:ring-primary/20 text-lg" 
              placeholder="Search by name or CAN number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px] font-bold text-primary pl-6">CAN</TableHead>
                  <TableHead className="font-bold text-primary">Farmer Name</TableHead>
                  <TableHead className="font-bold text-primary">Bank Account Number</TableHead>
                  <TableHead className="text-right pr-6 font-bold text-primary">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground animate-pulse">Loading farmer directory...</TableCell></TableRow>
                ) : filteredFarmers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2">
                        <ClipboardList className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-medium">No farmers found matching your search.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFarmers?.map((farmer) => (
                    <TableRow key={farmer.id} className="group hover:bg-primary/5 transition-colors">
                      <TableCell className="font-black text-primary pl-6 text-lg">{farmer.canNumber}</TableCell>
                      <TableCell className="font-semibold text-base">{farmer.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono">{farmer.accountNumber || "—"}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="p-4 bg-muted/20 text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest border-t">
              Total Registered Farmers: {farmers?.length || 0}
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}