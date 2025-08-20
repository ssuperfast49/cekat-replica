import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search, MessageSquare, Edit, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useContacts, ContactWithDetails } from "@/hooks/useContacts";
import { toast } from "@/components/ui/sonner";

// Remove hardcoded data - will use Supabase data instead

export default function Contacts() {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
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
      fetchContacts(currentPage, itemsPerPage, searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentPage, itemsPerPage]);

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

  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) return;
    
    try {
      await deleteMultipleContacts(selectedContacts);
      setSelectedContacts([]);
      toast.success(`Successfully deleted ${selectedContacts.length} contact(s)`);
    } catch (error) {
      toast.error('Failed to delete contacts');
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
    fetchContacts(currentPage, itemsPerPage, searchQuery);
    toast.info('Contacts refreshed');
  };

  const isAllSelected = selectedContacts.length === contacts.length && contacts.length > 0;
  const isSomeSelected = selectedContacts.length > 0 && selectedContacts.length < contacts.length;

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
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search by Name or Phone" 
                className="pl-10 w-80"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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
              variant="outline" 
              disabled={selectedContacts.length === 0}
            >
              Edit Selected ({selectedContacts.length})
            </Button>
            <Button 
              variant="outline" 
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
                <TableHead>PIPELINE STATUS</TableHead>
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
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                        aria-label={`Select ${contact.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* <Button 
                          size="sm" 
                          className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          ×
                        </Button> */}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{contact.name || 'Unnamed Contact'}</TableCell>
                    <TableCell>{contact.phone || '-'}</TableCell>
                    <TableCell>{contact.notes || '-'}</TableCell>
                    <TableCell>{contact.labelNames || '-'}</TableCell>
                    <TableCell>{contact.inbox || '-'}</TableCell>
                    <TableCell>{contact.pipelineStatus || '-'}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contact.chatStatus || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {contact.chatCreatedAt || '-'}
                    </TableCell>
                    <TableCell>{contact.handledBy || '-'}</TableCell>
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
    </div>
  );
}