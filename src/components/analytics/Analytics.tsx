import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, Inbox, Tag } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

const conversationData = [
  { time: "06/08", value: 50, firstTime: 30, returning: 45 },
  { time: "07/08", value: 75, firstTime: 45, returning: 60 },
  { time: "08/08", value: 65, firstTime: 40, returning: 55 },
  { time: "09/08", value: 60, firstTime: 35, returning: 50 },
  { time: "10/08", value: 85, firstTime: 55, returning: 70 },
  { time: "11/08", value: 90, firstTime: 60, returning: 75 },
  { time: "12/08", value: 80, firstTime: 50, returning: 65 },
  { time: "13/08", value: 70, firstTime: 45, returning: 60 },
];

const sourceData = [
  { name: "Live Chat", value: 100, color: "#10b981" }
];

const resolutionData = [
  { name: "Resolved by Human", value: 15, color: "#3b82f6" },
  { name: "Resolved by AI", value: 85, color: "#1d4ed8" }
];

const chartConfig = {
  conversations: {
    label: "Conversations",
    color: "hsl(var(--primary))",
  },
  firstTime: {
    label: "First Time",
    color: "hsl(var(--chart-1))",
  },
  returning: {
    label: "Returning",
    color: "hsl(var(--chart-2))",
  },
};

export default function Analytics() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        
        {/* Tabs */}
        <Tabs defaultValue="conversation" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-md">
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="ai-agent">AI Agent</TabsTrigger>
            <TabsTrigger value="human-agent">Human Agent</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
          
          <TabsContent value="conversation" className="space-y-6">
            {/* Filters */}
            <div className="flex gap-4 items-center">
              <Select defaultValue="all-inbox">
                <SelectTrigger className="w-48">
                  <Inbox className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-inbox">All Inbox</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" className="gap-2">
                <Calendar className="w-4 h-4" />
                Aug 05, 2025 - Aug 12, 2025
                <ChevronDown className="w-4 h-4" />
              </Button>
              
              <Select defaultValue="label">
                <SelectTrigger className="w-32">
                  <Tag className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="label">Label</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Total Conversations */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Conversation
                  </CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">991</span>
                    <span className="text-sm text-muted-foreground">Total Conversations</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                      <span>First Time 405</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <span>Returning 586</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={conversationData}>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Line 
                          type="monotone" 
                          dataKey="firstTime" 
                          stroke="#60a5fa" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="returning" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              
              {/* Peak Chat Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Peak Chat Hours
                  </CardTitle>
                  <div className="text-3xl font-bold">00:00</div>
                  <div className="text-sm text-muted-foreground">Peak Time</div>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </CardContent>
              </Card>
            </div>
            
            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* First Time Conversation Source */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    First Time Conversation Source
                  </CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">421</span>
                    <span className="text-sm text-muted-foreground">Total Conversations</span>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="relative w-48 h-48">
                    <ChartContainer config={chartConfig} className="w-full h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sourceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                          >
                            {sourceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Live Chat</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Resolution Rate */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Resolution Rate
                  </CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">610</span>
                    <span className="text-sm text-muted-foreground">Total Conversations</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span>Resolved by Human</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-700"></div>
                      <span>Resolved by AI</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="w-48 h-48">
                    <ChartContainer config={chartConfig} className="w-full h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={resolutionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                          >
                            {resolutionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}