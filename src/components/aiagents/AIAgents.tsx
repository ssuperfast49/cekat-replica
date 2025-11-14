import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Trash2, Plus, Loader2 } from "lucide-react";
import PermissionGate from "@/components/rbac/PermissionGate";
import AIAgentSettings from "./AIAgentSettings";
import { useAIProfiles, AIProfile } from "@/hooks/useAIProfiles";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";

interface AIAgent {
  id: string;
  name: string;
  initials: string;
  creator: string;
  description?: string;
  created_at: string;
  modelId?: string | null;
}

// Helpers for model UI
const formatCost = (v: number | null | undefined) => {
  if (v == null) return "Pricing on request";
  return `${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:v>=1?2:3}).format(v)} / 1M`;
};
const formatProvider = (p: string | null | undefined) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : "Unknown");

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
          <PermissionGate permission={'ai_profiles.update'}>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onSettings(agent)}>
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </PermissionGate>
        </TooltipTrigger>
        <TooltipContent>
          <p>Konfigurasi pengaturan agen AI</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <PermissionGate permission={'ai_profiles.delete'}>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => onDelete(agent.id)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </PermissionGate>
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
  const [aiModels, setAiModels] = useState<Array<{ id: string; display_name: string | null; model_name: string; provider: string; cost_per_1m_tokens: number | null; is_active: boolean; description?: string | null }>>([]);
  const [fallbackModels, setFallbackModels] = useState<Array<{ id: string; display_name: string | null; model_name: string; provider: string; cost_per_1m_tokens: number | null; is_active: boolean; description?: string | null }>>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedFallbackModelId, setSelectedFallbackModelId] = useState<string>("");
  
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

    if (!selectedModelId) {
      toast.error('Please select an AI model');
      return;
    }

    const newAgent: AIAgent = {
      id: 'new',
      name: newAgentName.trim(),
      initials: newAgentName.trim().split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2),
      creator: 'Admin',
      created_at: new Date().toISOString(),
      modelId: selectedModelId,
    };
    
    setSelectedAgent(newAgent);
    setShowCreateDialog(false);
    setNewAgentName("");
    setSelectedTemplate("customer-service");
    toast.info('Creating new AI agent...');
  };

  // Load AI models (separate regular and fallback)
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        setModelsError(null);
        const { data, error } = await supabase
          .from('ai_models')
          .select('id, display_name, model_name, provider, cost_per_1m_tokens, is_active')
          .eq('is_active', true)
          .order('display_name', { ascending: true });
        
        if (error) throw error;
        
        const allModels = (data || []) as Array<{ id: string; display_name: string | null; model_name: string; provider: string; cost_per_1m_tokens: number | null; is_active: boolean }>;
        
        // Separate regular models from fallback models
        const regular = allModels.filter(m => (m.display_name || '').toLowerCase() !== 'fallback');
        const fallback = allModels.filter(m => (m.display_name || '').toLowerCase() === 'fallback');
        
        setAiModels(regular);
        setFallbackModels(fallback);
        
        // Auto-select first model if available
        if (regular.length > 0 && !selectedModelId) {
          setSelectedModelId(regular[0].id);
        }
        if (fallback.length > 0 && !selectedFallbackModelId) {
          setSelectedFallbackModelId(fallback[0].id);
        }
      } catch (err) {
        console.error('Error loading AI models:', err);
        setModelsError('Failed to load AI models');
        toast.error('Failed to load AI models');
      } finally {
        setModelsLoading(false);
      }
    };
    loadModels();
  }, []);

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
        initialModelId={selectedAgent.modelId || undefined}
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
        <PermissionGate permission={'ai_profiles.create'}>
          <CreateNewCard onClick={handleCreateNew} />
        </PermissionGate>
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
      <PermissionGate permission={'ai_profiles.create'}>
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
                  {/* <SelectItem value="customer-service">
                    <div className="space-y-1">
                      <div className="font-medium">Customer Service AI</div>
                    </div>
                  </SelectItem> */}
                </SelectContent>
              </Select>
              
              {selectedTemplate === "customer-service" && (
                <p className="text-sm text-muted-foreground mt-2">
                  and sales inquiries for your business.
                </p>
              )}
            </div>

            {/* AI Model picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">AI Model</label>
              <Select value={selectedModelId} onValueChange={setSelectedModelId} disabled={modelsLoading || aiModels.length === 0}>
                    <SelectTrigger className="w-full py-3">
                      {selectedModelId ? (
                    (() => {
                      const m = aiModels.find(x => x.id === selectedModelId);
                      if (!m) return <SelectValue placeholder={modelsLoading ? 'Loading models...' : 'Select an AI model'} />;
                      return (
                        <span className="flex w-full items-center gap-2 text-sm font-medium truncate pr-2">
                          <span className="truncate">{m.display_name || 'Custom'} · {formatCost(m.cost_per_1m_tokens)} · {formatProvider(m.provider)}</span>
                        </span>
                      );
                    })()
                  ) : (
                    <SelectValue placeholder={modelsLoading ? 'Loading models...' : 'Select an AI model'} />
                  )}
                </SelectTrigger>
                <SelectContent side="bottom" align="start" sideOffset={4}>
                  {aiModels.map((m) => {
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex flex-col text-left">
                          <div className="flex items-center justify-between text-sm font-medium">
                            <span>{m.display_name || 'Custom'}</span>
                            <span className="text-muted-foreground">{formatCost(m.cost_per_1m_tokens)}</span>
                          </div>
                          <span className="text-xs text-muted-foreground leading-tight">{m.description || 'No description available'}</span>
                          <span className="text-[11px] font-mono text-muted-foreground">{m.model_name} · {formatProvider(m.provider)}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {modelsError && (
                <p className="text-xs text-destructive">{modelsError}</p>
              )}
            </div>

            {/* Fallback Model picker */}
            {fallbackModels.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Fallback Model</label>
                <Select value={selectedFallbackModelId} onValueChange={setSelectedFallbackModelId} disabled={modelsLoading || fallbackModels.length === 0}>
                  <SelectTrigger className="w-full py-3">
                    {selectedFallbackModelId ? (
                      (() => {
                        const m = fallbackModels.find(x => x.id === selectedFallbackModelId);
                        if (!m) return <SelectValue placeholder={modelsLoading ? 'Loading models...' : 'Select a fallback model'} />;
                        return (
                          <span className="flex w-full items-center gap-2 text-sm font-medium truncate pr-2">
                            <span className="truncate">{m.display_name || 'Custom'} · {formatCost(m.cost_per_1m_tokens)} · {formatProvider(m.provider)}</span>
                          </span>
                        );
                      })()
                    ) : (
                      <SelectValue placeholder={modelsLoading ? 'Loading models...' : 'Select a fallback model'} />
                    )}
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4}>
                    {fallbackModels.map((m) => {
                      return (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex flex-col text-left">
                            <div className="flex items-center justify-between text-sm font-medium">
                              <span>{m.display_name || 'Custom'}</span>
                              <span className="text-muted-foreground">{formatCost(m.cost_per_1m_tokens)}</span>
                            </div>
                            <span className="text-xs text-muted-foreground leading-tight">{m.description || 'No description available'}</span>
                            <span className="text-[11px] font-mono text-muted-foreground">{m.model_name} · {formatProvider(m.provider)}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              onClick={handleCreateAgent}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!newAgentName.trim() || !selectedModelId}
            >
              Create AI Agent
            </Button>
          </div>
        </DialogContent>
        </Dialog>
      </PermissionGate>
    </div>
  );
};

export default AIAgents;