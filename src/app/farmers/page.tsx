
"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  UserPlus, 
  Search, 
  Trash2,
  X,
  Pencil,
  CircleDot,
  CircleSlash
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function FarmersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newFarmer, setNewFarmer] = useState({ 
    name: "", 
    canNumber: "", 
    bankAccountNumber: "", 
    ifscCode: "", 
    milkType: "COW", 
    customRate: "",
    active: true 
  });
  const [editingFarmer, setEditingFarmer] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowToDelete, setRowToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const farmersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'farmers');
  }, [firestore]);

  const { data: farmers, isLoading } = useCollection(farmersQuery);

  const filteredFarmers = (farmers || []).filter(f => 
    (f.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (f.canNumber || "").includes(searchTerm)
  ).sort((a, b) => {
    const aNum = parseInt(a.canNumber || "0");
    const bNum = parseInt(b.canNumber || "0");
    if (isNaN(aNum) || isNaN(bNum)) return (a.canNumber || "").localeCompare(b.canNumber || "");
    return aNum - bNum;
  });

  const handleAddFarmer = () => {
    if (!newFarmer.name || !newFarmer.canNumber) {
      toast({ title: "Error", description: "Name and Can Number are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'farmers'), {
      ...newFarmer,
      canNumber: (newFarmer.canNumber || "").toString().padStart(3, '0'),
      customRate: parseFloat(newFarmer.customRate) || 0,
      createdAt: serverTimestamp(),
    });

    setNewFarmer({ name: "", canNumber: "", bankAccountNumber: "", ifscCode: "", milkType: "COW", customRate: "", active: true });
    setIsAdding(false);
    toast({ title: "Success", description: "Farmer added successfully." });
  };

  const handleUpdateFarmer = () => {
    if (!editingFarmer || !editingFarmer.name || !editingFarmer.canNumber) {
      toast({ title: "Error", description: "Name and Can Number are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    updateDocumentNonBlocking(doc(firestore, 'farmers', editingFarmer.id), {
      name: editingFarmer.name || "",
      canNumber: (editingFarmer.canNumber || "").toString().padStart(3, '0'),
      bankAccountNumber: editingFarmer.bankAccountNumber || "",
      ifscCode: editingFarmer.ifscCode || "",
      milkType: editingFarmer.milkType || "COW",
      customRate: parseFloat(editingFarmer.customRate) || 0,
      active: editingFarmer.active !== false,
      updatedAt: serverTimestamp(),
    });

    setEditingFarmer(null);
    toast({ title: "Updated", description: "Farmer details updated successfully." });
  };

  const toggleFarmerStatus = (farmer: any) => {
    if (!firestore) return;
    updateDocumentNonBlocking(doc(firestore, 'farmers', farmer.id), {
      active: !farmer.active,
      updatedAt: serverTimestamp(),
    });
    toast({ 
      title: farmer.active ? "Farmer Deactivated" : "Farmer Activated", 
      description: `${farmer.name} is now ${farmer.active ? 'inactive' : 'active'}.` 
    });
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredFarmers.map(f => f.id));
    } else {
      setSelectedIds([]);
    }
  };

  const confirmDeleteSelected = () => {
    if (!firestore || selectedIds.length === 0) return;
    selectedIds.forEach(id => deleteDocumentNonBlocking(doc(firestore, 'farmers', id)));
    toast({ title: "Deleted", description: `Removed ${selectedIds.length} farmers.` });
    setSelectedIds([]);
    setIsDeleteDialogOpen(false);
  };

  const confirmDeleteRow = () => {
    if (!firestore || !rowToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'farmers', rowToDelete.id));
    toast({ title: "Deleted", description: `Farmer "${rowToDelete.name}" removed.` });
    setRowToDelete(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Farmer Directory</h1>
              <p className="text-muted-foreground font-medium">Manage suppliers, rates, and bank details.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedIds.length > 0 && (
                <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} className="rounded-full shadow-lg">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete ({selectedIds.length})
                </Button>
              )}
              <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"} className="rounded-full shadow-lg">
                {isAdding ? <X className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                {isAdding ? "Cancel" : "Add Farmer"}
              </Button>
            </div>
          </div>

          {isAdding && (
            <Card className="mb-8 border-primary/20 bg-primary/5 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</Label>
                    <Input placeholder="e.g. Rahul Sharma" value={newFarmer.name || ""} onChange={(e) => setNewFarmer({...newFarmer, name: e.target.value})} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Can Number</Label>
                    <Input placeholder="e.g. 001" value={newFarmer.canNumber || ""} onChange={(e) => setNewFarmer({...newFarmer, canNumber: e.target.value})} className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Milk Type</Label>
                    <Select value={newFarmer.milkType || "COW"} onValueChange={(v) => setNewFarmer({...newFarmer, milkType: v})}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="COW">COW</SelectItem><SelectItem value="BUFFALO">BUFFALO</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Custom Rate (₹)</Label>
                    <Input type="number" placeholder="0.00" value={newFarmer.customRate || ""} onChange={(e) => setNewFarmer({...newFarmer, customRate: e.target.value})} className="rounded-xl h-11" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleAddFarmer} className="rounded-full px-10 h-11 font-black uppercase text-xs shadow-lg">Save Profile</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              className="pl-12 h-14 bg-card rounded-2xl border-primary/10 shadow-sm" 
              placeholder="Search by name or CAN..." 
              value={searchTerm || ""}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow>
                  <TableHead className="w-[50px] pl-6"><Checkbox checked={filteredFarmers.length > 0 && selectedIds.length === filteredFarmers.length} onCheckedChange={(c) => toggleSelectAll(c === true)} /></TableHead>
                  <TableHead className="w-[100px] font-black text-primary uppercase text-[10px] tracking-widest">CAN</TableHead>
                  <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Farmer Name</TableHead>
                  <TableHead className="w-[120px] font-black text-primary uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                  <TableHead className="w-[120px] font-black text-primary uppercase text-[10px] tracking-widest text-center">Milk Type</TableHead>
                  <TableHead className="w-[120px] font-black text-primary uppercase text-[10px] tracking-widest">Rate (₹)</TableHead>
                  <TableHead className="text-right pr-10 font-black text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground animate-pulse font-medium">Syncing directory...</TableCell></TableRow>
                ) : filteredFarmers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20 italic text-muted-foreground">No records found.</TableCell></TableRow>
                ) : filteredFarmers.map((f) => (
                  <TableRow key={f.id} className={cn("group transition-colors", selectedIds.includes(f.id) && "bg-primary/5", !f.active && "opacity-60")}>
                    <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(f.id)} onCheckedChange={(c) => toggleSelect(f.id, c === true)} /></TableCell>
                    <TableCell className="font-black text-primary text-lg">{f.canNumber || ""}</TableCell>
                    <TableCell className="font-bold text-base uppercase">{f.name || ""}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={f.active ? "default" : "outline"} 
                        className="rounded-full cursor-pointer h-7 px-3 text-[10px] font-black uppercase tracking-widest"
                        onClick={() => toggleFarmerStatus(f)}
                      >
                        {f.active ? <CircleDot className="w-3 h-3 mr-1" /> : <CircleSlash className="w-3 h-3 mr-1" />}
                        {f.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={f.milkType === 'BUFFALO' ? "secondary" : "outline"} className="rounded-full text-[10px] font-black uppercase px-3">{f.milkType || 'COW'}</Badge>
                    </TableCell>
                    <TableCell className="font-black text-sm">{f.customRate && parseFloat(f.customRate) > 0 ? `₹${parseFloat(f.customRate).toFixed(2)}` : "Default"}</TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => setEditingFarmer(f)} className="rounded-full text-primary hover:bg-primary/10"><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setRowToDelete({id: f.id, name: f.name})} className="rounded-full text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>

      <Dialog open={!!editingFarmer} onOpenChange={(o) => !o && setEditingFarmer(null)}>
        <DialogContent className="rounded-[2rem] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary uppercase tracking-tight">Edit Farmer Profile</DialogTitle>
            <DialogDescription>Update supplier rates and operational status.</DialogDescription>
          </DialogHeader>
          {editingFarmer && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Name</Label><Input value={editingFarmer.name || ""} onChange={(e) => setEditingFarmer({...editingFarmer, name: e.target.value})} className="rounded-xl h-11" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">CAN</Label><Input value={editingFarmer.canNumber || ""} onChange={(e) => setEditingFarmer({...editingFarmer, canNumber: e.target.value})} className="rounded-xl h-11" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Milk Type</Label><Select value={editingFarmer.milkType || "COW"} onValueChange={(v) => setEditingFarmer({...editingFarmer, milkType: v})}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COW">COW</SelectItem><SelectItem value="BUFFALO">BUFFALO</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Custom Rate (₹)</Label><Input type="number" value={editingFarmer.customRate || ""} onChange={(e) => setEditingFarmer({...editingFarmer, customRate: e.target.value})} className="rounded-xl h-11" /></div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl">
                <Label className="font-bold text-sm">Operational Status</Label>
                <div className="flex items-center gap-3">
                  <span className={cn("text-[10px] font-black uppercase", editingFarmer.active ? "text-primary" : "text-muted-foreground")}>{editingFarmer.active ? "Active" : "Inactive"}</span>
                  <Switch checked={editingFarmer.active !== false} onCheckedChange={(v) => setEditingFarmer({...editingFarmer, active: v})} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="border-t pt-4"><Button onClick={handleUpdateFarmer} className="rounded-full px-12 h-11 font-black uppercase tracking-widest shadow-md">Update Profile</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rowToDelete} onOpenChange={(o) => !o && setRowToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader><AlertDialogTitle className="font-black text-destructive uppercase">Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Delete farmer <strong>{rowToDelete?.name}</strong>? This action is permanent.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteRow} className="bg-destructive text-white rounded-full">Delete Record</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader><AlertDialogTitle className="font-black text-destructive uppercase">Delete Selection</AlertDialogTitle><AlertDialogDescription>Wipe all {selectedIds.length} selected records?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-full">Stop</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteSelected} className="bg-destructive text-white rounded-full">Wipe Records</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
