"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, List, Users, Mic, Download, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/sentences", label: "Sentences", icon: List },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/recordings", label: "Recordings", icon: Mic },
  { href: "/admin/export", label: "Export", icon: Download },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <span className="font-bold text-lg gradient-accent-text">Admin Panel</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        ${isSidebarOpen ? "block" : "hidden"} 
        md:block w-full md:w-64 bg-card border-r border-border shrink-0 md:h-screen md:sticky md:top-0 z-20
      `}>
        <div className="p-6 hidden md:block">
          <span className="font-bold text-xl gradient-accent-text block mb-1">IIITH Speech</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Admin Panel</span>
        </div>
        
        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <span className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors
                  ${isActive 
                    ? "bg-accent/10 text-accent font-medium" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"}
                `}>
                  <Icon className="w-5 h-5" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto md:absolute md:bottom-0 md:left-0 md:w-full border-t border-border flex items-center justify-between">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
            <LogOut className="w-5 h-5 mr-3" />
            Sign out
          </Button>
          <div className="hidden md:block mr-2">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
