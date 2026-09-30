
import Link from "next/link";
import { Droplets, ClipboardList, BarChart3, Settings, ShoppingCart, FileText, Users, FileBarChart, Contact } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-primary/5 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-primary rounded-xl group-hover:scale-105 transition-transform duration-200 shadow-lg shadow-primary/20">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <span className="font-headline font-black text-lg sm:text-xl text-primary tracking-tighter uppercase truncate max-w-[150px] sm:max-w-none">
              SGK MILK DISTRIBUTIONS
            </span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex items-center gap-4">
              <Link href="/farmers" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <Users className="w-3 h-3" />
                Farmers
              </Link>
              <Link href="/buyers" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <Contact className="w-3 h-3" />
                Buyers
              </Link>
              <Link href="/entries" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <ClipboardList className="w-3 h-3" />
                Collection
              </Link>
              <Link href="/sales" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <ShoppingCart className="w-3 h-3" />
                Cycle Sales
              </Link>
              <Link href="/daily-reports" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <FileBarChart className="w-3 h-3" />
                Reports
              </Link>
              <Link href="/farmer-bills" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <FileText className="w-3 h-3" />
                Bills
              </Link>
              <Link href="/reports" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <BarChart3 className="w-3 h-3" />
                Audit
              </Link>
              <Link href="/settings" className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest">
                <Settings className="w-3 h-3" />
                Settings
              </Link>
            </div>
            
            <div className="flex items-center gap-2 pl-2 sm:pl-4 border-l border-primary/10">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
