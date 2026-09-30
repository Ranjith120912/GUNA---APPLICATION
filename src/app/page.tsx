
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DashboardStats } from "@/components/dashboard-stats";
import Link from "next/link";
import { PlusCircle, ShoppingCart, BarChart3, FileText, Users, FileBarChart, Contact, Settings } from "lucide-react";

export default function Home() {
  const quickActions = [
    { href: "/farmers", label: "Farmers", icon: Users, color: "text-blue-600", bg: "bg-blue-600/10" },
    { href: "/buyers", label: "Buyers", icon: Contact, color: "text-indigo-600", bg: "bg-indigo-600/10" },
    { href: "/entries", label: "Collection", icon: PlusCircle, color: "text-primary", bg: "bg-primary/10" },
    { href: "/sales", label: "Cycle Sales", icon: ShoppingCart, color: "text-secondary", bg: "bg-secondary/10" },
    { href: "/daily-reports", label: "Daily Report", icon: FileBarChart, color: "text-amber-600", bg: "bg-amber-600/10" },
    { href: "/farmer-bills", label: "Farmer Bills", icon: FileText, color: "text-rose-600", bg: "bg-rose-600/10" },
    { href: "/reports", label: "Audit", icon: BarChart3, color: "text-emerald-600", bg: "bg-emerald-600/10" },
    { href: "/settings", label: "Settings", icon: Settings, color: "text-slate-600", bg: "bg-slate-600/10" },
  ];

  return (
    <div className="min-h-screen flex flex-col font-body bg-background selection:bg-primary/20">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10 text-center sm:text-left">
            <h1 className="text-4xl font-black text-primary tracking-tighter mb-2 uppercase">
              SGK MILK DISTRIBUTIONS Dashboard
            </h1>
            <p className="text-muted-foreground font-medium">
              Enterprise Dairy Management & Distribution System.
            </p>
          </header>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-12">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="group p-5 bg-card border border-primary/5 rounded-3xl hover:border-primary/40 transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-primary/5 cursor-pointer flex flex-col items-center text-center space-y-3">
                  <div className={`p-4 ${action.bg} rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                    <action.icon className={`w-6 h-6 ${action.color}`} />
                  </div>
                  <h3 className="text-xs font-black text-primary uppercase tracking-widest">{action.label}</h3>
                </div>
              </Link>
            ))}
          </div>

          <DashboardStats />
        </div>
      </main>

      <Footer />
    </div>
  );
}
