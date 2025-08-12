import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search, MessageSquare, Edit, ChevronLeft, ChevronRight } from "lucide-react";

const contactsData = [
  {
    id: 1,
    name: "QuickVisitor_FXScC",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 12:52:11",
    handledBy: ""
  },
  {
    id: 2,
    name: "HappyGuest_Cy7lm",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "OKBANG TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 12:51:31",
    handledBy: ""
  },
  {
    id: 3,
    name: "HappyMember_16M3w",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "OKBANG TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 12:50:11",
    handledBy: ""
  },
  {
    id: 4,
    name: "LuckyMember_3MmpK",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 12:48:55",
    handledBy: ""
  },
  {
    id: 5,
    name: "LuckyFriend_aP1N0",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 12:27:45",
    handledBy: ""
  },
  {
    id: 6,
    name: "QuickVisitor_hd-6H",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 11:45:30",
    handledBy: ""
  },
  {
    id: 7,
    name: "CleverMember_UOSur",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 11:44:00",
    handledBy: ""
  },
  {
    id: 8,
    name: "BrightGuest_vyVoN",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 10:08:41",
    handledBy: ""
  },
  {
    id: 9,
    name: "CleverGuest_JtZZJ",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 09:23:03",
    handledBy: ""
  },
  {
    id: 10,
    name: "CleverFriend_e2Y5l",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "OKBANG TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 07:54:53",
    handledBy: ""
  },
  {
    id: 11,
    name: "LuckyGuest_Asl6y",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 07:45:30",
    handledBy: ""
  },
  {
    id: 12,
    name: "QuickFriend_lbKwH",
    phone: "",
    note: "",
    labelNames: "",
    inbox: "ANITOTOTO TOP UP CENTER",
    pipelineStatus: "",
    chatStatus: "resolved",
    chatCreatedAt: "2025-08-12 05:48:57",
    handledBy: ""
  }
];

export default function Contacts() {
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(contactsData.map(contact => contact.id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (contactId: number, checked: boolean) => {
    if (checked) {
      setSelectedContacts([...selectedContacts, contactId]);
    } else {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
    }
  };

  const isAllSelected = selectedContacts.length === contactsData.length;
  const isSomeSelected = selectedContacts.length > 0 && selectedContacts.length < contactsData.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">Total Contacts: 4585</p>
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
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline">Recipient/Campaign</Button>
            <Button variant="outline">Edit Selected</Button>
            <Button variant="outline">Export</Button>
            <Button variant="outline">Customize Columns</Button>
          </div>
        </div>
      </div>
      
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
              {contactsData.map((contact) => (
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
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.phone}</TableCell>
                  <TableCell>{contact.note}</TableCell>
                  <TableCell>{contact.labelNames}</TableCell>
                  <TableCell>{contact.inbox}</TableCell>
                  <TableCell>{contact.pipelineStatus}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {contact.chatStatus}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {contact.chatCreatedAt}
                  </TableCell>
                  <TableCell>{contact.handledBy}</TableCell>
                </TableRow>
              ))}
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
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">46</span>
          </span>
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage === 46}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span>Item per page:</span>
            <Select defaultValue="100">
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
          <span>Total: <span className="font-medium">4,585</span></span>
        </div>
      </div>
    </div>
  );
}