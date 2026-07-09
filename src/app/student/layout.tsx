"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Home, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="container-app mx-auto flex h-16 items-center justify-between">
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <span className="font-bold text-lg gradient-accent-text">
              IIITH Speech
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-4 mr-4">
              <Link 
                href="/student/dashboard" 
                className={`text-sm font-medium transition-colors hover:text-foreground ${
                  pathname === "/student/dashboard" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                Dashboard
              </Link>
              <Link 
                href="/student/recordings" 
                className={`text-sm font-medium transition-colors hover:text-foreground ${
                  pathname.startsWith("/student/recordings") ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                My Recordings
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
