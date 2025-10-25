import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Trash2, Plus, Loader2 } from "lucide-react";
import AIAgentSettings from "./AIAgentSettings";
import { useAIProfiles, AIProfile } from "@/hooks/useAIProfiles";
import { toast } from "@/components/ui/sonner";

interface AIAgent {
  id: string;
  name: string;
  initials: string;
  creator: string;
  description?: string;
  created_at: string;
}

const AIAgentCard = ({ agent, onSettings, onDelete }: { 
  agent: AIAgent; 
  onSettings: (agent: AIAgent) => void;
  onDelete: (agentId: string) => void;
}) => (
  <Card className="p-6 text-center space-y-4 hover:shadow-md transition-shadow">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground">
        {agent.initials}
      </div>
      <div>
        <h3 className="font-semibold text-lg">{agent.name}</h3>
        <p className="text-sm text-muted-foreground">{agent.creator}</p>
        {agent.description && (
          <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Created: {new Date(agent.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
    <div className="flex gap-2 justify-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onSettings(agent)}>
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Konfigurasi pengaturan agen AI</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => onDelete(agent.id)}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Hapus agen AI ini</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </Card>
);

const CreateNewCard = ({ onClick }: { onClick: () => void }) => (
  <Card 
    className="p-6 text-center space-y-4 hover:shadow-md transition-shadow bg-blue-600 text-white cursor-pointer group"
    onClick={onClick}
  >
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
        <Plus className="w-8 h-8" />
      </div>
      <h3 className="font-semibold text-lg">Create New</h3>
    </div>
  </Card>
);

const AIAgents = () => {
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("customer-service");
  
  // Use the custom hook for AI profile management
  const { fetchAllProfiles, deleteProfile } = useAIProfiles();

  // Fetch all AI agents from database
  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const profiles = await fetchAllProfiles();
      
      if (profiles) {
        const mappedAgents: AIAgent[] = profiles.map((profile: AIProfile) => ({
          id: profile.id,
          name: profile.name,
          initials: profile.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2),
          creator: 'Admin', // Default creator since there's no creator field in the database
          description: profile.description,
          created_at: profile.created_at,
        }));
        
        setAgents(mappedAgents);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('Failed to load AI agents');
      toast.error('Failed to load AI agents');
    } finally {
      setLoading(false);
    }
  };

  // Delete AI agent
  const handleDeleteAgent = async (agentId: string) => {
    const agentToDelete = agents.find(agent => agent.id === agentId);
    
    if (window.confirm(`Are you sure you want to delete "${agentToDelete?.name}"? This action cannot be undone.`)) {
      try {
        await deleteProfile(agentId);
        // Refresh the agents list after deletion
        await fetchAgents();
        toast.success(`"${agentToDelete?.name}" has been deleted successfully`);
      } catch (error) {
        console.error('Error deleting agent:', error);
        setError('Failed to delete AI agent');
        toast.error('Failed to delete AI agent');
      }
    }
  };

  // Open create dialog
  const handleCreateNew = () => {
    setShowCreateDialog(true);
  };

  // Handle create agent form submission
  const handleCreateAgent = () => {
    if (!newAgentName.trim()) {
      toast.error('Please enter an AI agent name');
      return;
    }

    const newAgent: AIAgent = {
      id: 'new',
      name: newAgentName.trim(),
      initials: newAgentName.trim().split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2),
      creator: 'Admin',
      created_at: new Date().toISOString(),
    };
    
    setSelectedAgent(newAgent);
    setShowCreateDialog(false);
    setNewAgentName("");
    setSelectedTemplate("customer-service");
    toast.info('Creating new AI agent...');
  };

  // Load agents on component mount
  useEffect(() => {
    fetchAgents();
  }, []);

  if (selectedAgent) {
    return (
      <AIAgentSettings 
        agentName={selectedAgent.name}
        onBack={() => {
          setSelectedAgent(null);
          fetchAgents(); // Refresh the list when returning
        }}
        profileId={selectedAgent.id === 'new' ? undefined : selectedAgent.id}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading AI agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">AI Agents</h1>
        <div className="text-muted-foreground max-w-2xl mx-auto">
          <p>Ini adalah halaman di mana Anda dapat mengunjungi AI yang telah Anda buat sebelumnya.</p>
          <p>Jangan ragu untuk membuat perubahan dan membuat chatbot sebanyak yang Anda inginkan kapan saja!</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">Error: {error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={fetchAgents}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">{agents.length}</div>
          <div className="text-sm text-muted-foreground">Total AI Agents</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {agents.filter(agent => agent.creator === 'Hanna').length}
          </div>
          <div className="text-sm text-muted-foreground">Active Agents</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {agents.length > 0 ? new Date(Math.max(...agents.map(a => new Date(a.created_at).getTime()))).toLocaleDateString() : 'N/A'}
          </div>
          <div className="text-sm text-muted-foreground">Last Created</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {agents.map((agent) => (
          <AIAgentCard 
            key={agent.id} 
            agent={agent} 
            onSettings={setSelectedAgent}
            onDelete={handleDeleteAgent}
          />
        ))}
        <CreateNewCard onClick={handleCreateNew} />
      </div>

      {/* Empty State */}
      {agents.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Plus className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No AI Agents Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first AI agent to get started with automated customer support.
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First AI Agent
          </Button>
        </div>
      )}

      {/* Create New Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Create New AI Agent</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Enter AI name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer-service">
                    <div className="space-y-1">
                      <div className="font-medium">Customer Service AI</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {selectedTemplate === "customer-service" && (
                <p className="text-sm text-muted-foreground mt-2">
                  and sales inquiries for your business.
                </p>
              )}
            </div>

            <Button 
              onClick={handleCreateAgent}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!newAgentName.trim()}
            >
              Create AI Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIAgents;