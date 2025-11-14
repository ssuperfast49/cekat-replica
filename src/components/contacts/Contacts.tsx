import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Filter, Search, MessageSquare, Edit, ChevronLeft, ChevronRight, Loader2, RefreshCw, X, Copy, Eye, User, Phone, Mail, Calendar, MessageCircle, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle, Key } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useContacts, ContactWithDetails, ContactsFilter } from "@/hooks/useContacts";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { useRBAC } from "@/contexts/RBACContext";
import PermissionGate from "@/components/rbac/PermissionGate";
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
  const { hasRole } = useRBAC();
  const isMasterAgent = hasRole('master_agent');
  
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [sortKey, setSortKey] = useState<'name' | 'phone' | 'notes' | 'inbox' | 'channelProvider' | 'channelType' | 'chatStatus' | 'chatCreatedAtISO' | 'handledBy' | 'created_at' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ContactsFilter>({
    chatStatus: '',
    handledBy: '',
    dateRange: {}
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [contactDetailsOpen, setContactDetailsOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactWithDetails | null>(null);
  const navigate = useNavigate();
  const { hasPermission } = useRBAC();
  const canDeleteContacts = hasPermission('contacts.delete');
  
  // Use the contacts hook
  const { 
    contacts, 
    loading, 
    error, 
    totalCount, 
    fetchContacts, 
    deleteContact, 
    updateContact,
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

  // Remove bulk edit: edits happen per row

  const handleDeleteSelected = () => {
    if (selectedContacts.length === 0) return;
    if (!canDeleteContacts) {
      toast.error('You do not have permission to delete contacts');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleViewConversation = (contact: ContactWithDetails) => {
    // Navigate to chat page with contact filter
    navigate(`/chat?contact=${contact.id}`);
    toast.success(`Opening conversation with ${contact.name || 'contact'}`);
  };

  const handleViewDetails = (contact: ContactWithDetails) => {
    setSelectedContact(contact);
    setContactDetailsOpen(true);
  };

  const handleEditContact = (contact: ContactWithDetails) => {
    setSelectedContact(contact);
    setEditName(contact.name || "");
    setEditPhone(contact.phone || "");
    setEditNotes(contact.notes || "");
    setEditDialogOpen(true);
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

  const saveEditedContact = async () => {
    if (!selectedContact) return;
    try {
      setEditSaving(true);
      await updateContact(selectedContact.id, {
        name: editName.trim() || null,
        phone: editPhone.trim() || null,
        notes: editNotes.trim() || null,
      });
      toast.success('Contact updated');
    setEditDialogOpen(false);
    } catch {
      toast.error('Failed to update contact');
    } finally {
      setEditSaving(false);
    }
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

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedContacts = (() => {
    if (!sortKey) return contacts;
    const copy = [...contacts];
    copy.sort((a: any, b: any) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return sortAsc ? 1 : -1;
      if (bv == null) return sortAsc ? -1 : 1;
      if (sortKey === 'chatCreatedAtISO' || sortKey === 'created_at') {
        const at = new Date(av).getTime();
        const bt = new Date(bv).getTime();
        return sortAsc ? at - bt : bt - at;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortAsc ? -1 : 1;
      if (as > bs) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  })();

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
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium">Chat Status</label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Filter berdasarkan status percakapan: Open (terbuka), Pending (menunggu), atau Closed (tertutup)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
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
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-sm font-medium">Handled By</label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Filter berdasarkan siapa yang menangani percakapan: Assigned (ditugaskan ke agen) atau Unassigned (belum ditugaskan)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
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
                      <div className="flex items-center gap-1">
                        <label className="text-sm font-medium">Date Range</label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Filter berdasarkan rentang tanggal kontak dibuat. Pilih tanggal mulai dan tanggal akhir untuk membatasi hasil pencarian</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
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
                placeholder="Cari berdasarkan Nama atau Telepon" 
                className="pl-10 pr-8 w-80"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Hapus pencarian</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Segarkan daftar kontak</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="flex gap-2">
            {canDeleteContacts && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={selectedContacts.length > 0 ? "destructive" : "outline"}
                    className={selectedContacts.length > 0 ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                    onClick={handleDeleteSelected}
                    disabled={selectedContacts.length === 0}
                  >
                    Delete Selected ({selectedContacts.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Hapus kontak yang dipilih</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Export</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ekspor daftar kontak</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Customize Columns</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Kustomisasi kolom yang ditampilkan</p>
              </TooltipContent>
            </Tooltip>
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
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">ACTION</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Aksi yang dapat dilakukan pada kontak (lihat, edit, hapus)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('name')}>
                        NAME {sortKey==='name' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Nama kontak (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('phone')}>
                        PHONE {sortKey==='phone' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Nomor telepon kontak (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('notes')}>
                        NOTE {sortKey==='notes' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Catatan atau keterangan tambahan kontak (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('inbox')}>
                        CHANNEL {sortKey==='inbox' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Saluran komunikasi kontak (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('channelType')}>
                        PLATFORM {sortKey==='channelType' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Platform komunikasi (WhatsApp, Telegram, dll) (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('chatStatus')}>
                        CHAT STATUS {sortKey==='chatStatus' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Status percakapan (Open, Pending, Closed) (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('chatCreatedAtISO')}>
                        CREATED AT {sortKey==='chatCreatedAtISO' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tanggal dan waktu kontak dibuat (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-xs py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex items-center gap-1 text-xs" onClick={()=>toggleSort('handledBy')}>
                        HANDLED BY {sortKey==='handledBy' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5"/> : <ArrowDown className="h-3.5 w-3.5"/>) : <ArrowUpDown className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Agen yang menangani percakapan (klik untuk mengurutkan)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading contacts...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchQuery ? 'No contacts found matching your search.' : 'No contacts found.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedContacts.map((contact) => (
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
                              className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white"
                              aria-label="View detailed conversation"
                              onClick={() => handleViewConversation(contact)}
                              variant="ghost"
                              title="Open conversation"
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
                              className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white"
                              aria-label="View contact details"
                              onClick={() => handleViewDetails(contact)}
                              variant="ghost"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View details</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-white"
                              aria-label="Edit contact"
                              onClick={() => handleEditContact(contact)}
                              variant="ghost"
                              title="Edit contact"
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
                    <TableCell>{contact.inbox ? <Badge variant="outline">{contact.inbox}</Badge> : '—'}</TableCell>
                    <TableCell>
                      {contact.channelProvider ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {contact.channelProvider}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{renderChatStatus(contact.chatStatus)}</TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">
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

      {/* Edit Contact Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editName} onChange={(e)=>setEditName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={(e)=>setEditPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={editNotes} onChange={(e)=>setEditNotes(e.target.value)} placeholder="Notes" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={()=>setEditDialogOpen(false)} disabled={editSaving}>Cancel</Button>
              <Button onClick={saveEditedContact} disabled={editSaving} className="bg-blue-600 hover:bg-blue-700">
                {editSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Details Modal */}
      <Dialog open={contactDetailsOpen} onOpenChange={setContactDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {selectedContact?.name?.[0]?.toUpperCase() || selectedContact?.phone?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-semibold">
                  {selectedContact?.name || 'Unnamed Contact'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Contact Details
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.name || 'Unnamed Contact'}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.phone || '-'}</span>
                    {selectedContact.phone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedContact.phone as string);
                          toast.success('Phone copied to clipboard');
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                <div className="p-3 bg-muted rounded-md">
                  {selectedContact.notes ? (
                    <p className="text-sm">{selectedContact.notes}</p>
                  ) : (
                    <span className="text-muted-foreground text-sm">No notes</span>
                  )}
                </div>
              </div>

              {/* Labels and Inbox */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Label Names</Label>
                  <div className="flex items-center gap-2">
                    <span>{selectedContact.labelNames || '-'}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Inbox</Label>
                  <div className="flex items-center gap-2">
                    {selectedContact.inbox ? (
                      <Badge variant="outline">{selectedContact.inbox}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Chat Status</Label>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    {renderChatStatus(selectedContact.chatStatus)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Handled By</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selectedContact.handledBy && selectedContact.handledBy !== '—' ? (
                      <Badge className="bg-purple-100 text-purple-700 border-0">{selectedContact.handledBy}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact and Chat Creation Times */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Contact Created At</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">
                      {selectedContact.created_at ? 
                        new Date(selectedContact.created_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }) : '-'
                      }
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Chat Created At</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{selectedContact.chatCreatedAt || '-'}</span>
                  </div>
                </div>
              </div>

              {/* UUID - Master Agent Only */}
              {isMasterAgent && selectedContact && (
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Contact UUID
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <code className="flex-1 font-mono text-xs text-foreground break-all">
                      {selectedContact.id}
                    </code>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedContact.id);
                            toast.success('Contact UUID copied to clipboard');
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy UUID</TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for this contact. Use this UUID for GDPR deletion requests or system integrations.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  onClick={() => handleViewConversation(selectedContact)}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View Conversation
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleEditContact(selectedContact)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contact
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}