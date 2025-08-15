import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <Button variant="outline" size="sm" className="gap-2" onClick={() => onSettings(agent)}>
        <Settings className="w-4 h-4" />
        Settings
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="gap-2 text-destructive hover:text-destructive"
        onClick={() => onDelete(agent.id)}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </Button>
    </div>
  </Card>
);

const CreateNewCard = ({ onClick }: { onClick: () => void }) => (
  <Card 
    className="p-6 text-center space-y-4 hover:shadow-md transition-shadow bg-primary text-primary-foreground cursor-pointer group"
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
          creator: profile.name.includes('ANITATOTO') ? 'Hanna' : 
                   profile.name.includes('OKBANG') ? 'Cathlyn' : 
                   profile.name.includes('GULTIK') ? 'Sherly' : 'Admin',
          description: profile.description,
          created_at: profile.created_at,
        }));
        
        setAgents(mappedAgents);
        toast.success(`Loaded ${mappedAgents.length} AI agent${mappedAgents.length !== 1 ? 's' : ''}`);
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

  // Create new AI agent
  const handleCreateNew = () => {
    const newAgent: AIAgent = {
      id: 'new',
      name: 'New AI Agent',
      initials: 'NA',
      creator: 'Admin',
      created_at: new Date().toISOString(),
    };
    setSelectedAgent(newAgent);
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
    </div>
  );
};

export default AIAgents;