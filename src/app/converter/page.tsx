"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ConversionCard } from "@/components/conversion-card";
import { ArrowLeft, Calculator } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ConverterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Calculator className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">Utility Tools</span>
              </div>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase">
                Weight-Volume Converter
              </h1>
              <p className="text-muted-foreground font-medium">
                Professional conversion utility for dairy processing standards.
              </p>
            </div>
            <Link href="/">
              <Button variant="ghost" className="rounded-full text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <div className="flex justify-center py-10">
            <ConversionCard />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
