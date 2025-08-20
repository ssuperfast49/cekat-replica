import React, { useState } from 'react';
import { Calendar, CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAIAgents } from '@/hooks/useAIAgents';
import { useHumanAgents } from '@/hooks/useHumanAgents';

interface FilterState {
  dateRange: {
    from?: Date;
    to?: Date;
  };
  inbox: string;
  label: string[];
  agent: string;
  status: string;
  resolvedBy: string;
  aiAgent: string;
  pipelineStatus: string;
}

interface ChatFilterProps {
  onFilterChange: (filters: FilterState) => void;
}

export const ChatFilter: React.FC<ChatFilterProps> = ({ onFilterChange }) => {
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    inbox: '',
    label: [],
    agent: '',
    status: '',
    resolvedBy: '',
    aiAgent: '',
    pipelineStatus: '',
  });

  const { aiAgents } = useAIAgents();
  const { agents: humanAgents } = useHumanAgents();

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const handleApply = () => {
    const finalFilters = {
      ...filters,
      dateRange: { from: fromDate, to: toDate },
    };
    onFilterChange(finalFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetFilters: FilterState = {
      dateRange: {},
      inbox: '',
      label: [],
      agent: '',
      status: '',
      resolvedBy: '',
      aiAgent: '',
      pipelineStatus: '',
    };
    setFilters(resetFilters);
    setFromDate(undefined);
    setToDate(undefined);
    onFilterChange(resetFilters);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Filter className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date Range</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "dd-MM-yyyy") : "DD-MM-YYYY"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="self-center text-muted-foreground">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "dd-MM-yyyy") : "DD-MM-YYYY"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Inbox */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Inbox</label>
              <Select value={filters.inbox} onValueChange={(value) => handleFilterChange('inbox', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Inbox" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Inbox</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Label and Resolved By */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Label</label>
              <Select value={filters.label.join(',')} onValueChange={(value) => handleFilterChange('label', value.split(',').filter(Boolean))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Labels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="follow-up">Follow Up</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Resolved By</label>
              <Select value={filters.resolvedBy} onValueChange={(value) => handleFilterChange('resolvedBy', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {humanAgents.map((agent) => (
                    <SelectItem key={agent.user_id} value={agent.user_id}>
                      {agent.display_name || `Agent ${agent.user_id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Agent and AI Agent */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Agent</label>
              <Select value={filters.agent} onValueChange={(value) => handleFilterChange('agent', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {humanAgents.map((agent) => (
                    <SelectItem key={agent.user_id} value={agent.user_id}>
                      {agent.display_name || `Agent ${agent.user_id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">AI Agent</label>
              <Select value={filters.aiAgent} onValueChange={(value) => handleFilterChange('aiAgent', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose AI Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All AI Agents</SelectItem>
                  {aiAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status and Pipeline Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Pipeline Status</label>
              <Select value={filters.pipelineStatus} onValueChange={(value) => handleFilterChange('pipelineStatus', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed-won">Closed Won</SelectItem>
                  <SelectItem value="closed-lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};