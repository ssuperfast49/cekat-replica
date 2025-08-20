import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Settings, CreditCard, User, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileDialog = ({ open, onOpenChange }: ProfileDialogProps) => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [notifications, setNotifications] = useState(false);

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onOpenChange(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const sidebarItems = [
    { id: "settings", label: "Settings", icon: Settings },
    { id: "billings", label: "Billings", icon: CreditCard },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 bg-muted/30 border-r border-border p-4">
            <DialogHeader className="px-0 pb-4">
              <DialogTitle className="text-lg font-semibold">Account</DialogTitle>
            </DialogHeader>
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md transition-colors",
                      activeTab === item.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6">
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name || user?.email} />
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                      {getUserInitials(user?.user_metadata?.full_name, user?.email || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold">{user?.user_metadata?.full_name || 'User'}</h2>
                    <p className="text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                <Separator />

                {/* Settings */}
                <div className="space-y-6">
                  {/* Online Status */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Online Status</label>
                      <p className="text-sm text-foreground">{onlineStatus ? "Online" : "Offline"}</p>
                    </div>
                    <Switch
                      checked={onlineStatus}
                      onCheckedChange={setOnlineStatus}
                    />
                  </div>

                  {/* Notifications */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Notifications</label>
                      <p className="text-sm text-foreground">{notifications ? "Enabled" : "Disabled"}</p>
                    </div>
                    <Switch
                      checked={notifications}
                      onCheckedChange={setNotifications}
                    />
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3"
                    >
                      <Lock className="h-4 w-4" />
                      Reset Password
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Settings</h3>
                <p className="text-muted-foreground">Application settings will be available here.</p>
              </div>
            )}

            {activeTab === "billings" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Billings</h3>
                <p className="text-muted-foreground">Billing information and subscription details will be available here.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;