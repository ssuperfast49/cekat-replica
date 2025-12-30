import React, { useMemo, useState } from "react";
import { Search, Check, AlertTriangle, Shield, Lock, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  PERMISSIONS_SCHEMA, 
  getActionCategory, 
  isHighRiskAction, 
  PermissionResource 
} from "@/config/permissions";

// Types matching the provided structure
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

interface PermissionMatrixProps {
  permissions: Permission[];
  assignedPermissionIds: string[]; // List of permission IDs currently assigned to the role
  onToggle: (permissionId: string, isAssigned: boolean) => Promise<void> | void;
  isReadOnly?: boolean;
  className?: string;
}

// Helper to format resource names
// (e.g. "org_members" -> "Org Members")
const formatResourceName = (resource: string) => {
  return resource
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

// Format action labels for UI
const formatActionLabel = (action: string) => {
  if (action === 'read_own') return 'Own';
  if (action === 'read_all') return 'All';
  if (action === 'read_channel_owned') return 'My Channels';
  if (action === 'read_collaborator') return 'Collaborator';
  if (action === 'read') return 'Read';
  
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  permissions,
  assignedPermissionIds,
  onToggle,
  isReadOnly = false,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isTogglingAll, setIsTogglingAll] = useState<Record<string, boolean>>({});
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Transform permissions into a lookup map for fast access by resource+action
  const permissionMap = useMemo(() => {
    const map: Record<string, Record<string, Permission>> = {};
    permissions.forEach(p => {
      if (!map[p.resource]) map[p.resource] = {};
      map[p.resource][p.action] = p;
    });
    return map;
  }, [permissions]);

  // Filter the SCHEMA based on search query
  const filteredResources = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return Object.keys(PERMISSIONS_SCHEMA) as PermissionResource[];

    return (Object.keys(PERMISSIONS_SCHEMA) as PermissionResource[]).filter(resource => {
      // Match resource name
      if (resource.toLowerCase().includes(query)) return true;
      
      // Match any action in the schema for this resource
      const actions = PERMISSIONS_SCHEMA[resource];
      return actions.some(action => action.toLowerCase().includes(query));
    });
  }, [searchQuery]);

  const handleToggle = async (id: string, nextState: boolean) => {
    if (isReadOnly || togglingIds.has(id)) return;
    try {
      setTogglingIds(prev => new Set(prev).add(id));
      await onToggle(id, nextState);
    } catch (error) {
      console.error("Failed to toggle permission", error);
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Bulk toggle for a resource
  const handleSelectAll = async (resource: string, actions: readonly string[]) => {
    if (isReadOnly || isTogglingAll[resource]) return;

    // Get actual permission IDs that exist in DB for this resource's actions
    const resourcePerms = actions
      .map(action => permissionMap[resource]?.[action])
      .filter((p): p is Permission => !!p);

    if (resourcePerms.length === 0) return;

    const allSelected = resourcePerms.every(p => assignedPermissionIds.includes(p.id));
    const targetState = !allSelected;

    setIsTogglingAll(prev => ({ ...prev, [resource]: true }));

    try {
      // Split read-level vs other actions
      const readLevel = actions.filter(a => a === 'read' || a.startsWith('read_'));
      const nonReadPerms = resourcePerms.filter(p => !readLevel.includes(p.action));
      const readPerms = resourcePerms.filter(p => readLevel.includes(p.action));

      // Determine highest read level available for this resource
      const order = ['read_own','read_channel_owned','read_collaborator','read_all','read'];
      const highestRead = order.findLast(a => readPerms.some(p => p.action === a)) || null;

      const ops: Array<Promise<void> | void> = [];

      if (targetState) {
        // Turn on non-read perms
        for (const p of nonReadPerms) {
          const isAssigned = assignedPermissionIds.includes(p.id);
          if (!isAssigned) ops.push(onToggle(p.id, true));
        }
        // Set access level to the most permissive only
        for (const p of readPerms) {
          const shouldBeOn = highestRead ? p.action === highestRead : false;
          const isAssigned = assignedPermissionIds.includes(p.id);
          if (isAssigned !== shouldBeOn) ops.push(onToggle(p.id, shouldBeOn));
        }
      } else {
        // Turn everything off, including all read levels
        for (const p of [...nonReadPerms, ...readPerms]) {
          const isAssigned = assignedPermissionIds.includes(p.id);
          if (isAssigned) ops.push(onToggle(p.id, false));
        }
      }

      // Batch processing
      const chunk = 5;
      for (let i = 0; i < ops.length; i += chunk) {
        await Promise.all(ops.slice(i, i + chunk));
      }
    } catch (error) {
      console.error(`Failed to bulk toggle for ${resource}`, error);
    } finally {
      setIsTogglingAll(prev => ({ ...prev, [resource]: false }));
    }
  };

  // Render a toggle item
  const renderToggle = (resource: string, action: string, labelOverride?: string, showIcon: boolean = false) => {
    const permission = permissionMap[resource]?.[action];
    
    // If permission doesn't exist in DB, show disabled state or skip
    if (!permission) return null;

    const isAssigned = assignedPermissionIds.includes(permission.id);
    const isRisk = isHighRiskAction(action);
    const isProcessing = togglingIds.has(permission.id) || isTogglingAll[resource];
    const label = labelOverride || formatActionLabel(action);

    return (
      <div key={action} className={cn(
        "flex items-center justify-between p-2 rounded-md transition-colors text-sm",
        isAssigned ? "bg-primary/5" : "hover:bg-muted/50",
        isRisk && isAssigned && "bg-red-50 dark:bg-red-950/20"
      )}>
        <div className="flex items-center gap-2 flex-1">
          <Label 
            htmlFor={permission.id}
            className={cn("cursor-pointer font-medium flex items-center gap-2", 
              isRisk ? "text-red-600 dark:text-red-400" : "text-foreground"
            )}
          >
            {label}
            {isRisk && showIcon && <AlertTriangle className="h-3 w-3 text-red-500" />}
          </Label>
        </div>
        <Switch
          id={permission.id}
          checked={isAssigned}
          onCheckedChange={(checked) => handleToggle(permission.id, checked)}
          disabled={isReadOnly || isProcessing}
          className={cn(isRisk && isAssigned && "data-[state=checked]:bg-red-500")}
        />
      </div>
    );
  };

  // Exclusive Access Level control for read_* actions
  const renderAccessLevel = (resource: string, actions: readonly string[]) => {
    const readLevelActions = actions.filter(a => a === 'read' || a.startsWith('read_'));
    if (readLevelActions.length === 0) return null;

    // Order from least to most permissive
    const order = [
      'read_own',
      'read_channel_owned',
      'read_collaborator',
      'read_all',
      'read',
    ];

    const available = order.filter(a => readLevelActions.includes(a));

    // Determine currently selected level (highest precedence among assigned)
    const current = available.findLast(a => {
      const id = permissionMap[resource]?.[a]?.id;
      return id ? assignedPermissionIds.includes(id) : false;
    }) || null;

    const setLevel = async (target: string | null) => {
      if (isReadOnly) return;
      const ops: Array<Promise<void> | void> = [];
      for (const a of available) {
        const perm = permissionMap[resource]?.[a];
        if (!perm) continue;
        const isAssigned = assignedPermissionIds.includes(perm.id);
        const shouldBeOn = target === a;
        if (isAssigned !== shouldBeOn) {
          ops.push(onToggle(perm.id, shouldBeOn));
        }
      }
      // If "None" selected, turn all off
      if (target === null) {
        for (const a of available) {
          const perm = permissionMap[resource]?.[a];
          if (!perm) continue;
          const isAssigned = assignedPermissionIds.includes(perm.id);
          if (isAssigned) ops.push(onToggle(perm.id, false));
        }
      }
      await Promise.all(ops);
    };

    return (
      <div className="space-y-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-md border p-1 bg-muted/30">
          <Button
            size="sm"
            variant={current === null ? 'default' : 'ghost'}
            className={cn('h-7 text-xs')}
            onClick={() => setLevel(null)}
            disabled={isReadOnly}
          >
            None
          </Button>
          {available.map(a => {
            const label = formatActionLabel(a);
            const needsTooltip = (resource === 'threads' && (a === 'read_channel_owned' || a === 'read_collaborator'))
              || (resource === 'messages' && a === 'read_collaborator');
            const tooltipText =
              resource === 'threads' && a === 'read_channel_owned' ? 'Can view threads that belong to channels assigned to this agent.' :
              resource === 'threads' && a === 'read_collaborator' ? 'Can view threads where the user is directly involved (assignee, creator, resolver, or collaborator).' :
              resource === 'messages' && a === 'read_collaborator' ? 'Can view messages in threads where the user is involved as collaborator or assignee.' :
              '';
            const buttonEl = (
              <Button
                key={a}
                size="sm"
                variant={current === a ? 'default' : 'ghost'}
                className={cn('h-7 text-xs')}
                onClick={() => setLevel(a)}
                disabled={isReadOnly}
              >
                {label}
              </Button>
            );
            return needsTooltip ? (
              <TooltipProvider key={a}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {buttonEl}
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="max-w-xs text-xs">{tooltipText}</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : buttonEl;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-4 pt-2">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search resources or actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* Masonry Layout */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
        {filteredResources.map((resource) => {
          const actions = PERMISSIONS_SCHEMA[resource];
          const validPermissions = actions
            .map(a => permissionMap[resource]?.[a])
            .filter(Boolean);
            
          // Skip resource if no permissions found in DB (schema mismatch safeguard)
          if (validPermissions.length === 0) return null;

          const allSelected = validPermissions.every(p => assignedPermissionIds.includes(p?.id));
          const isProcessingResource = isTogglingAll[resource];

          // Categorize actions
          const crudActions = actions.filter(a => {
            const cat = getActionCategory(a);
            return ['create', 'update', 'delete'].includes(cat);
          });
          
          const readActions = actions.filter(a => getActionCategory(a) === 'read');
          const specialActions = actions.filter(a => getActionCategory(a) === 'special');

          // Split read actions into level-based and others (e.g., view_*)
          const levelReadActions = readActions.filter(a => a === 'read' || a.startsWith('read_'));
          const otherReadActions = readActions.filter(a => !levelReadActions.includes(a));

          return (
            <div key={resource} className="break-inside-avoid mb-6">
              <Card className={cn("h-full border-t-4 shadow-sm", allSelected ? "border-t-primary" : "border-t-muted")}>
                <CardHeader className="pb-3 bg-muted/30 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {resource === "security" ? <Lock className="h-4 w-4 text-orange-500" /> : 
                       resource === "analytics" ? <Search className="h-4 w-4 text-blue-500" /> :
                       <Shield className="h-4 w-4 text-muted-foreground" />
                      }
                      {formatResourceName(resource)}
                    </CardTitle>
                    
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => handleSelectAll(resource, actions)}
                        disabled={isProcessingResource}
                      >
                        {isProcessingResource ? "..." : allSelected ? "Unselect All" : "Select All"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-4 space-y-4">
                  
                  {/* CRUD Section */}
                  {crudActions.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Manage</h4>
                      <div className="grid gap-1">
                        {crudActions.map(action => renderToggle(
                          resource,
                          action,
                          resource === 'admin_panel' && action === 'update' ? 'Update Settings' : undefined
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scoped Reads Section */}
                  {readActions.length > 0 && (
                    <div className={cn(crudActions.length > 0 && "pt-2 border-t")}>                      
                      <div className="flex items-center justify-between mb-2 mt-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          Access Level
                        </h4>
                      </div>

                      {/* Segmented control for read_* levels */}
                      {levelReadActions.length > 0 && renderAccessLevel(resource, actions)}

                      {/* Additional read actions (e.g., view_*), keep as toggles */}
                      {otherReadActions.length > 0 && (
                        <div className="mt-2 grid gap-1">
                          {otherReadActions.map(action => renderToggle(resource, action))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Special Actions Section */}
                  {specialActions.length > 0 && (
                    <div className={cn((crudActions.length > 0 || readActions.length > 0) && "pt-2 border-t")}>
                       <h4 className="text-xs font-semibold text-orange-600/80 dark:text-orange-400/80 uppercase tracking-wider mb-2 mt-2 flex items-center gap-1">
                         Special Actions
                       </h4>
                       <div className="grid gap-1">
                         {specialActions.map(action => {
                           const labelOverride =
                             resource === 'alerts' && action === 'ack' ? 'Acknowledge' :
                             resource === 'messages' && action === 'send' ? 'Send' :
                             undefined;
                           const content = renderToggle(resource, action, labelOverride, true);
                           // Add tooltips for tricky specials
                           if (resource === 'alerts' && action === 'ack' && content) {
                             return (
                               <TooltipProvider key={action}>
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <div>{content}</div>
                                   </TooltipTrigger>
                                   <TooltipContent side="top">
                                     <div className="max-w-xs text-xs">Mark alerts as acknowledged on behalf of this role.</div>
                                   </TooltipContent>
                                 </Tooltip>
                               </TooltipProvider>
                             );
                           }
                           return content;
                         })}
                       </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>
          );
        })}

        {filteredResources.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
            <Search className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No matching permissions</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionMatrix;
