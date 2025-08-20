import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      <DialogContent className="max-w-2xl h-[400px] p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-48 bg-muted/20 border-r border-border p-4">
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
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name || user?.email} />
                  <AvatarFallback className="text-sm bg-blue-100 text-blue-600">
                    {getUserInitials(user?.user_metadata?.full_name, user?.email || '')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold">{user?.user_metadata?.full_name || 'Audit 4'}</h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                {/* Online Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">Online Status</span>
                    <div className="text-sm font-medium">Online</div>
                  </div>
                  <Switch
                    checked={onlineStatus}
                    onCheckedChange={setOnlineStatus}
                  />
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">Notifications</span>
                    <div className="text-sm font-medium">Disabled</div>
                  </div>
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                </div>

                {/* Reset Password */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Reset Password</span>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>

                {/* Log Out */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Log Out</span>
                  <Button variant="ghost" size="sm" className="p-2" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;