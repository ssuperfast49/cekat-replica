import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, CreditCard, User, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ProfilePopoverProps {
  children: React.ReactNode;
}

const ProfilePopover = ({ children }: ProfilePopoverProps) => {
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
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] h-[320px] p-0 overflow-hidden" side="left" align="start">
        <div className="flex h-full">
          {/* Sidebar */}
          {/* <div className="w-36 bg-muted/20 border-r border-border p-3">
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-2 text-xs rounded-md transition-colors",
                      activeTab === item.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div> */}

          {/* Main Content */}
          <div className="flex-1 p-4">
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name || user?.email} />
                  <AvatarFallback className="text-sm bg-blue-100 text-blue-600">
                    {getUserInitials(user?.user_metadata?.full_name, user?.email || '')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-sm font-semibold">{user?.user_metadata?.full_name || 'Audit 4'}</h2>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-3">
                {/* Online Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">Online Status</span>
                    <div className="text-xs font-medium">Online</div>
                  </div>
                  <Switch
                    checked={onlineStatus}
                    onCheckedChange={setOnlineStatus}
                    className="scale-75"
                  />
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">Notifications</span>
                    <div className="text-xs font-medium">Disabled</div>
                  </div>
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                    className="scale-75"
                  />
                </div>

                {/* Reset Password */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Reset Password</span>
                  <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>

                {/* Log Out */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Log Out</span>
                  <Button variant="ghost" size="sm" className="p-1 h-6 w-6" onClick={handleSignOut}>
                    <LogOut className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProfilePopover;