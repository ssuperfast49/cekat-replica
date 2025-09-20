import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Search, MessageSquare, Edit, ChevronLeft, ChevronRight, Loader2, RefreshCw, X, Copy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useContacts, ContactWithDetails, ContactsFilter } from "@/hooks/useContacts";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Remove hardcoded data - will use Supabase data instead

export default function Contacts() {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ContactsFilter>({
    chatStatus: '',
    handledBy: '',
    dateRange: {}
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Use the contacts hook
  const { 
    contacts, 
    loading, 
    error, 
    totalCount, 
    fetchContacts, 
    deleteContact, 
    deleteMultipleContacts 
  } = useContacts();

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchContacts(currentPage, itemsPerPage, searchQuery, filters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentPage, itemsPerPage, filters]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(contacts.map(contact => contact.id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts([...selectedContacts, contactId]);
    } else {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
    }
  };

  const handleEditSelected = () => {
    if (selectedContacts.length === 0) return;
    setEditDialogOpen(true);
  };

  const handleDeleteSelected = () => {
    if (selectedContacts.length === 0) return;
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSelected = async () => {
    try {
      await deleteMultipleContacts(selectedContacts);
      setSelectedContacts([]);
      setDeleteDialogOpen(false);
      toast.success(`Successfully deleted ${selectedContacts.length} contact(s)`);
    } catch (error) {
      toast.error('Failed to delete contacts');
    }
  };

  const confirmEditSelected = () => {
    // For now, just show a toast. In a real app, you'd open an edit modal/form
    toast.info(`Edit feature for ${selectedContacts.length} contact(s) will be implemented`);
    setEditDialogOpen(false);
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteContact(contactId);
      toast.success('Contact deleted successfully');
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  const handleRefresh = () => {
    fetchContacts(currentPage, itemsPerPage, searchQuery, filters);
    toast.info('Contacts refreshed');
  };

  const handleFilterChange = <K extends keyof ContactsFilter>(key: K, value: ContactsFilter[K]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDateRangeChange = (key: 'from' | 'to', value: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [key]: value
      }
    }));
  };

  const clearFilters = () => {
    setFilters({ chatStatus: '', handledBy: '', dateRange: {} });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    typeof value === 'string' ? value !== '' : 
    Object.values(value).some(v => v !== '')
  );

  const isAllSelected = selectedContacts.length === contacts.length && contacts.length > 0;
  const isSomeSelected = selectedContacts.length > 0 && selectedContacts.length < contacts.length;

  const renderChatStatus = (status?: string) => {
    if (!status || status === '—') return <span className="text-muted-foreground">—</span>;
    const color = status === 'open' ? 'bg-blue-100 text-blue-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
    return <Badge className={`${color} border-0`}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Total Contacts: {loading ? '...' : totalCount.toLocaleString()}
          </p>
        </div>
        
        {/* Toolbar */}
        <div className="flex gap-4 items-center justify-between">
          <div className="flex gap-2 items-center">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filter
                  {hasActiveFilters && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Filter Contacts</h3>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 px-2 text-xs"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Chat Status</label>
                      <Select
                        value={filters.chatStatus}
                        onValueChange={(value) =>
                          handleFilterChange(
                            'chatStatus',
                            (value === 'all' ? '' : (value as ContactsFilter['chatStatus']))
                          )
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    
                    <div>
                      <label className="text-sm font-medium">Handled By</label>
                      <Select
                        value={filters.handledBy || ''}
                        onValueChange={(value) =>
                          handleFilterChange('handledBy', (value === 'all' ? '' : (value as ContactsFilter['handledBy'])))
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="All agents" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date Range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Input
                            type="date"
                            placeholder="From"
                            value={filters.dateRange.from}
                            onChange={(e) => handleDateRangeChange('from', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Input
                            type="date"
                            placeholder="To"
                            value={filters.dateRange.to}
                            onChange={(e) => handleDateRangeChange('to', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search by Name or Phone" 
                className="pl-10 pr-8 w-80"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline">Recipient/Campaign</Button>
            <Button 
              variant={selectedContacts.length > 0 ? "default" : "outline"}
              className={selectedContacts.length > 0 ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
              disabled={selectedContacts.length === 0}
              onClick={handleEditSelected}
            >
              Edit Selected ({selectedContacts.length})
            </Button>
            <Button 
              variant={selectedContacts.length > 0 ? "destructive" : "outline"}
              className={selectedContacts.length > 0 ? "bg-red-600 hover:bg-red-700 text-white" : ""}
              onClick={handleDeleteSelected}
              disabled={selectedContacts.length === 0}
            >
              Delete Selected ({selectedContacts.length})
            </Button>
            <Button variant="outline">Export</Button>
            <Button variant="outline">Customize Columns</Button>
          </div>
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all contacts"
                    className={isSomeSelected ? "data-[state=checked]:bg-blue-600" : ""}
                  />
                </TableHead>
                <TableHead>ACTION</TableHead>
                <TableHead>NAME</TableHead>
                <TableHead>PHONE</TableHead>
                <TableHead>NOTE</TableHead>
                <TableHead>LABEL NAMES</TableHead>
                <TableHead>INBOX</TableHead>
                
                <TableHead>CHAT STATUS</TableHead>
                <TableHead>CHAT CREATED AT</TableHead>
                <TableHead>HANDLED BY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading contacts...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchQuery ? 'No contacts found matching your search.' : 'No contacts found.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id} className={`hover:bg-muted/50 ${selectedContacts.includes(contact.id) ? 'bg-blue-50' : ''}`}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                        aria-label={`Select ${contact.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                              aria-label="Open conversation"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open conversation</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600"
                              aria-label="Edit contact"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit contact</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{(contact.name || contact.phone || '?')[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate">{contact.name || 'Unnamed Contact'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{contact.phone || '-'}</span>
                        {contact.phone && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => { navigator.clipboard.writeText(contact.phone as string); toast.success('Phone copied'); }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy phone</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.notes ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="line-clamp-1 max-w-[260px] inline-block align-middle">{contact.notes}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">{contact.notes}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{contact.labelNames || '-'}</TableCell>
                    <TableCell>{contact.inbox ? <Badge variant="outline">{contact.inbox}</Badge> : '—'}</TableCell>
                    <TableCell>{renderChatStatus(contact.chatStatus)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {contact.chatCreatedAt || '-'}
                    </TableCell>
                    <TableCell>
                      {contact.handledBy && contact.handledBy !== '—' ? (
                        <Badge className="bg-purple-100 text-purple-700 border-0">{contact.handledBy}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">
              {Math.ceil(totalCount / itemsPerPage)}
            </span>
          </span>
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage >= Math.ceil(totalCount / itemsPerPage) || loading}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span>Items per page:</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            <span>rows</span>
          </div>
          <span>Total: <span className="font-medium">{totalCount.toLocaleString()}</span></span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedContacts.length} contact{selectedContacts.length > 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteSelected}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete {selectedContacts.length} Contact{selectedContacts.length > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Confirmation Dialog */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Selected Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to edit {selectedContacts.length} contact{selectedContacts.length > 1 ? 's' : ''}. This feature is currently being developed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmEditSelected}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}