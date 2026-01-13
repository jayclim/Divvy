import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full bg-slate-50 dark:bg-slate-900 border-t mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                <Zap className="h-4 w-4 fill-current" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                Spliq
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              The modern way to track expenses, split bills, and settle debts with friends.
              Simple, fair, and transparent.
            </p>
          </div>

          {/* Product Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/features" className="hover:text-primary transition-colors">Features</a></li>
              <li><a href="/pricing" className="hover:text-primary transition-colors">Pricing</a></li>
              <li><a href="/dashboard" className="hover:text-primary transition-colors">Dashboard</a></li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm tracking-wider uppercase">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a></li>
              <li><a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a></li>
              <li><a href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Spliq. All rights reserved.</p>
          <div className="flex items-center gap-1">
             <span>Designed & Developed by</span>
             <a 
               href="https://jaydenclim.com" 
               target="_blank" 
               rel="noopener noreferrer" 
               className="font-medium hover:underline text-[#B31B1B]"
             >
               Jayden Lim
             </a>
          </div>
        </div>
      </div>
    </footer>
  )
}