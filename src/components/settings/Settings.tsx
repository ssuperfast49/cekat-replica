import { ChevronRight, Tag, MessageSquare, ShoppingBag, Clock, Code, GitBranch, Star, Facebook } from "lucide-react";

const SettingsItem = ({ 
  icon: Icon, 
  title, 
  description, 
  onClick 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="group flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-sm"
  >
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
  </button>
);

const Settings = () => {
  return (
    <div className="space-y-8">
      {/* General Section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">General</h2>
        <div className="grid gap-3">
          <SettingsItem
            icon={MessageSquare}
            title="Followups"
            description="Create and manage followups."
          />
          <SettingsItem
            icon={Tag}
            title="Labels"
            description="Create, edit, and organize labels to better categorize conversations."
          />
          <SettingsItem
            icon={ShoppingBag}
            title="Products"
            description="Create and manage products."
          />
          <SettingsItem
            icon={MessageSquare}
            title="Quick Replies"
            description="Manage your quick replies."
          />
          <SettingsItem
            icon={Clock}
            title="Working Hours Settings"
            description="Create and manage working hours."
          />
        </div>
      </div>

      {/* Additional Section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Additional</h2>
        <div className="grid gap-3">
          <SettingsItem
            icon={Code}
            title="Developer & API Settings"
            description="Manage your API access and AI integrations."
          />
          <SettingsItem
            icon={GitBranch}
            title="Flows"
            description="Customize conversation flows based on specific conditions and customer actions."
          />
          <SettingsItem
            icon={Star}
            title="Customer Satisfaction Score (CSAT)"
            description="Automatically send a feedback message with a review link when the conversation is resolved."
          />
          <SettingsItem
            icon={Facebook}
            title="META Pixel Integration"
            description="Integrate your META Pixel to your business."
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;