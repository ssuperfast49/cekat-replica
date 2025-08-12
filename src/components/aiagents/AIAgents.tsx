import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Trash2, Plus } from "lucide-react";
import AIAgentSettings from "./AIAgentSettings";

interface AIAgent {
  id: string;
  name: string;
  initials: string;
  creator: string;
}

const AIAgentCard = ({ agent, onSettings }: { agent: AIAgent; onSettings: (agent: AIAgent) => void }) => (
  <Card className="p-6 text-center space-y-4 hover:shadow-md transition-shadow">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground">
        {agent.initials}
      </div>
      <div>
        <h3 className="font-semibold text-lg">{agent.name}</h3>
        <p className="text-sm text-muted-foreground">{agent.creator}</p>
      </div>
    </div>
    <div className="flex gap-2 justify-center">
      <Button variant="outline" size="sm" className="gap-2" onClick={() => onSettings(agent)}>
        <Settings className="w-4 h-4" />
        Settings
      </Button>
      <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
        <Trash2 className="w-4 h-4" />
        Delete
      </Button>
    </div>
  </Card>
);

const CreateNewCard = () => (
  <Card className="p-6 text-center space-y-4 hover:shadow-md transition-shadow bg-primary text-primary-foreground cursor-pointer group">
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
  
  const aiAgents: AIAgent[] = [
    {
      id: "1",
      name: "ANITATOTO AI",
      initials: "AA",
      creator: "Hanna"
    },
    {
      id: "2", 
      name: "OKBANG AI",
      initials: "OA",
      creator: "Cathlyn"
    },
    {
      id: "3",
      name: "GULTIK AI", 
      initials: "GA",
      creator: "Sherly"
    }
  ];

  if (selectedAgent) {
    return (
      <AIAgentSettings 
        agentName={selectedAgent.name}
        onBack={() => setSelectedAgent(null)}
      />
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {aiAgents.map((agent) => (
          <AIAgentCard key={agent.id} agent={agent} onSettings={setSelectedAgent} />
        ))}
        <CreateNewCard />
      </div>
    </div>
  );
};

export default AIAgents;