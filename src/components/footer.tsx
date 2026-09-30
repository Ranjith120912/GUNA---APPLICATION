"use client";

import { useState, useEffect } from "react";

export function Footer() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="py-12 px-4 border-t border-primary/5 bg-muted/30 no-print">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-8">
        <div className="flex flex-wrap justify-center gap-8 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-primary transition-colors">Support Center</a>
        </div>
        <div className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.3em] text-center">
          &copy; {year || '...'} SGK MILK DISTRIBUTIONS. Engineered for Dairy Excellence.
        </div>
      </div>
    </footer>
  );
}