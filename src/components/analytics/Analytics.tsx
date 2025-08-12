import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, Inbox, Tag, Search, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const aiMessageData = [
  { time: "06/08", credits: 120, messages: 45 },
  { time: "07/08", credits: 150, messages: 55 },
  { time: "08/08", credits: 110, messages: 40 },
  { time: "09/08", credits: 90, messages: 35 },
  { time: "10/08", credits: 180, messages: 65 },
  { time: "11/08", credits: 200, messages: 75 },
  { time: "12/08", credits: 160, messages: 60 },
  { time: "13/08", credits: 140, messages: 50 },
];

const handoffData = [
  { name: "06/08", value: 85 },
  { name: "07/08", value: 92 },
  { name: "08/08", value: 78 },
  { name: "09/08", value: 88 },
  { name: "10/08", value: 95 },
  { name: "11/08", value: 90 },
  { name: "12/08", value: 87 },
  { name: "13/08", value: 82 },
];

const tableData = [
  {
    createdAt: "2025-06-17 20:25",
    agent: "GULTEK TOP LAB CENTER",
    startDate: "2025-06-02",
    endDate: "2025-06-16",
    classifications: "DONE",
    status: "DONE",
    estimatedTime: "",
    actions: "View Export"
  },
  {
    createdAt: "2025-06-17 20:23",
    agent: "ANTANOTO TOP LAB CENTER",
    startDate: "2025-06-02",
    endDate: "2025-06-16",
    classifications: "DONE",
    status: "DONE",
    estimatedTime: "",
    actions: "View Export"
  }
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
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
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
          
          <TabsContent value="ai-agent" className="space-y-6">
            {/* AI Agent Filters */}
            <div className="flex gap-4 items-center">
              <Select defaultValue="all-ai-agents">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-ai-agents">All AI Agents</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" className="gap-2">
                <Calendar className="w-4 h-4" />
                Aug 05, 2025 - Aug 12, 2025
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            
            {/* AI Agent Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Message Usage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    AI Message Usage
                  </CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">2.7</span>
                    <span className="text-sm text-muted-foreground">Average Credit Per Message</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                      <span>All Credits 6,256</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <span>All Messages 2,319</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aiMessageData}>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Line 
                          type="monotone" 
                          dataKey="credits" 
                          stroke="#60a5fa" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="messages" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              
              {/* Agent Handoff Rate */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Agent Handoff Rate
                  </CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">100%</span>
                    <span className="text-sm text-muted-foreground">From AI to AI conversations</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span>AI Agent 1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-700"></div>
                      <span>Human Agent 612</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={handoffData}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
            
            {/* Analysis Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FAQ Analysis */}
              <Card className="text-center">
                <CardContent className="pt-12 pb-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Frequently Asked Question Analysis</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Let AI analyze your customer conversations to uncover insights.
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    Data: 5 Aug to 12 Aug
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Search className="w-4 h-4 mr-2" />
                    Start Analysis
                  </Button>
                </CardContent>
              </Card>
              
              {/* Business Report Analysis */}
              <Card className="text-center">
                <CardContent className="pt-12 pb-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Business Report Analysis</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Generate comprehensive business reports based on your customer conversations and data.
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    Data: 5 Aug to 12 Aug
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            {/* Data Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CREATED AT</TableHead>
                      <TableHead>AGENT</TableHead>
                      <TableHead>START DATE</TableHead>
                      <TableHead>END DATE</TableHead>
                      <TableHead>CLASSIFICATIONS</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead>ESTIMATED TIME</TableHead>
                      <TableHead>ACTIONS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{row.createdAt}</TableCell>
                        <TableCell>{row.agent}</TableCell>
                        <TableCell>{row.startDate}</TableCell>
                        <TableCell>{row.endDate}</TableCell>
                        <TableCell>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            {row.classifications}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell>{row.estimatedTime}</TableCell>
                        <TableCell>
                          <Button variant="link" className="text-blue-600 p-0 h-auto">
                            {row.actions}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-4 text-sm text-muted-foreground border-t">
                  Showing 1 to 2 of 2 results
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}