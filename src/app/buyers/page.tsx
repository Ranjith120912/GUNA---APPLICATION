
"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
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
import { UserPlus, Search, Contact, ClipboardList, Pencil, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BuyersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ name: "", buyerCode: "", phone: "" });
  const [editingBuyer, setEditingBuyer] = useState<any>(null);
  const [buyerToDelete, setBuyerToDelete] = useState<{id: string, name: string} | null>(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'buyers');
  }, [firestore]);

  const { data: buyers, isLoading } = useCollection(buyersQuery);

  const filteredBuyers = buyers?.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.buyerCode.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.buyerCode.localeCompare(b.buyerCode)) || [];

  const handleAddBuyer = () => {
    if (!newBuyer.name || !newBuyer.buyerCode) {
      toast({ title: "Error", description: "Name and Code are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    addDocumentNonBlocking(collection(firestore, 'buyers'), {
      ...newBuyer,
      active: true,
      createdAt: serverTimestamp(),
    });

    setNewBuyer({ name: "", buyerCode: "", phone: "" });
    setIsAdding(false);
    toast({ title: "Success", description: "Buyer added successfully." });
  };

  const handleUpdateBuyer = () => {
    if (!editingBuyer || !editingBuyer.name || !editingBuyer.buyerCode) {
      toast({ title: "Error", description: "Name and Code are required.", variant: "destructive" });
      return;
    }

    if (!firestore) return;

    updateDocumentNonBlocking(doc(firestore, 'buyers', editingBuyer.id), {
      name: editingBuyer.name,
      buyerCode: editingBuyer.buyerCode,
      phone: editingBuyer.phone,
      updatedAt: serverTimestamp(),
    });

    setEditingBuyer(null);
    toast({ title: "Updated", description: "Buyer details updated successfully." });
  };

  const confirmDeleteBuyer = () => {
    if (!firestore || !buyerToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'buyers', buyerToDelete.id));
    toast({ title: "Deleted", description: `Buyer "${buyerToDelete.name}" removed.` });
    setBuyerToDelete(null);
  };

  const confirmClearAll = () => {
    if (!firestore || !buyers) return;
    buyers.forEach(b => deleteDocumentNonBlocking(doc(firestore, 'buyers', b.id)));
    toast({ title: "Directory Cleared", description: "All buyer records removed." });
    setIsClearAllOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Buyer Management</h1>
              <p className="text-muted-foreground font-medium">Manage your milk distribution customers.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"} className="rounded-full h-11 px-6 shadow-md">
                {isAdding ? <X className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                {isAdding ? "Cancel" : "Add New Buyer"}
              </Button>
              <Button onClick={() => setIsClearAllOpen(true)} variant="ghost" className="rounded-full h-11 px-4 text-destructive border border-dashed hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-2" /> Clear All
              </Button>
            </div>
          </div>

          {isAdding && (
            <Card className="mb-8 border-primary/20 bg-primary/5 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader>
                <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                  <Contact className="w-5 h-5 text-primary" />
                  New Buyer Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Full Name / Entity</label>
                    <Input 
                      placeholder="e.g. City Dairy" 
                      value={newBuyer.name}
                      onChange={(e) => setNewBuyer({...newBuyer, name: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Buyer Code</label>
                    <Input 
                      placeholder="e.g. B-101" 
                      value={newBuyer.buyerCode}
                      onChange={(e) => setNewBuyer({...newBuyer, buyerCode: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contact Number</label>
                    <Input 
                      placeholder="e.g. 9123456789" 
                      value={newBuyer.phone}
                      onChange={(e) => setNewBuyer({...newBuyer, phone: e.target.value})}
                      className="rounded-xl h-11 border-primary/10"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleAddBuyer} className="rounded-full px-10 h-11 font-black uppercase text-xs shadow-lg">Save Buyer</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              className="pl-12 h-14 bg-card rounded-2xl border-primary/10 shadow-sm focus:ring-primary/20 text-lg" 
              placeholder="Search by name or code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card className="rounded-3xl overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-muted/50 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px] font-black text-primary pl-10 uppercase text-[10px] tracking-widest">Code</TableHead>
                  <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Buyer Name</TableHead>
                  <TableHead className="font-black text-primary uppercase text-[10px] tracking-widest">Phone</TableHead>
                  <TableHead className="text-right pr-10 font-black text-primary uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-muted-foreground animate-pulse font-medium">Syncing directory...</TableCell></TableRow>
                ) : filteredBuyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <ClipboardList className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-semibold">No buyers found in directory.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBuyers.map((buyer) => (
                    <TableRow key={buyer.id} className="group hover:bg-primary/5 transition-colors">
                      <TableCell className="font-black text-primary pl-10 text-lg uppercase">{buyer.buyerCode}</TableCell>
                      <TableCell className="font-bold text-base uppercase">{buyer.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono font-medium">{buyer.phone || "—"}</TableCell>
                      <TableCell className="text-right pr-10">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEditingBuyer(buyer)}
                            className="rounded-full text-primary hover:bg-primary/10 font-black uppercase text-[10px] px-4"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setBuyerToDelete({id: buyer.id, name: buyer.name})}
                            className="rounded-full text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="p-5 bg-muted/20 text-center text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] border-t">
              Total Managed Buyers: {buyers?.length || 0}
            </div>
          </Card>
        </div>
      </main>

      <Dialog open={!!editingBuyer} onOpenChange={(open) => !open && setEditingBuyer(null)}>
        <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary uppercase tracking-tight">Edit Buyer Profile</DialogTitle>
            <DialogDescription>Update distribution account information.</DialogDescription>
          </DialogHeader>
          
          {editingBuyer && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Buyer Name</label>
                <Input 
                  value={editingBuyer.name} 
                  onChange={(e) => setEditingBuyer({...editingBuyer, name: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Buyer Code</label>
                <Input 
                  value={editingBuyer.buyerCode} 
                  onChange={(e) => setEditingBuyer({...editingBuyer, buyerCode: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contact Phone</label>
                <Input 
                  value={editingBuyer.phone} 
                  onChange={(e) => setEditingBuyer({...editingBuyer, phone: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setEditingBuyer(null)} className="rounded-full">Cancel</Button>
            <Button onClick={handleUpdateBuyer} className="rounded-full px-8 shadow-md">Update Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row Delete Confirmation Alert */}
      <AlertDialog open={!!buyerToDelete} onOpenChange={(open) => !open && setBuyerToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase">
              <Trash2 className="w-5 h-5" /> Confirm Delete
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete buyer <strong>{buyerToDelete?.name}</strong>? All their historical sales data will remain but they will be removed from the directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">No, Keep</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBuyer} className="rounded-full bg-destructive hover:bg-destructive/90">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Alert */}
      <AlertDialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-black uppercase">
              <Trash2 className="w-5 h-5" /> Wipe Buyer Directory?
            </AlertDialogTitle>
            <AlertDialogDescription>
              CRITICAL: You are about to delete ALL distribution buyers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">No, Stop</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAll} className="rounded-full bg-destructive hover:bg-destructive/90">
              Yes, Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
