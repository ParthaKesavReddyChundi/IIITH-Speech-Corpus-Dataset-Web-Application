"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, UserPlus, Loader2, CheckCircle2 } from "lucide-react";

export function UserManager() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    gender_default: "other"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setStatus({ type: null, message: "" });

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      setStatus({ type: "success", message: "User created successfully!" });
      setFormData({ name: "", email: "", password: "", role: "student", gender_default: "other" });
      router.refresh();

    } catch (error: any) {
      setStatus({ type: "error", message: error.message || "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-card shadow-sm border-border">
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
        <CardDescription>
          Provision a new account. Students get an associated speaker profile automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" placeholder="Jane Doe" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <input required type="email" name="email" value={formData.email} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" placeholder="jane@example.com" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Password (Min 6 chars)</label>
              <input required type="password" name="password" value={formData.password} onChange={handleChange} minLength={6} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select name="role" value={formData.role} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <option value="student">Student (Speaker)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            
            {formData.role === "student" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Speaker Gender</label>
                <select name="gender_default" value={formData.gender_default} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
          </div>

          {status.message && (
            <Alert variant={status.type === "error" ? "destructive" : "default"} className={`mt-4 ${status.type === "success" ? "border-success text-success bg-success/10" : ""}`}>
              {status.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle>{status.type === "error" ? "Error" : "Success"}</AlertTitle>
              <AlertDescription>{status.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end pt-4 border-t border-border mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Create User
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
