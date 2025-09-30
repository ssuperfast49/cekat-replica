import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "Select...", disabled, className }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selected = new Set(value);

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val); else next.add(val);
    onChange(Array.from(next));
  };

  const selectedLabels = options.filter(o => selected.has(o.value)).map(o => o.label);
  const buttonLabel = selectedLabels.length === 0 ? placeholder : `${selectedLabels.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("justify-between w-64", className)}
        >
          <span className="truncate text-left">{buttonLabel}</span>
          <span className="ml-2 text-muted-foreground">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem key={opt.value} onSelect={() => toggle(opt.value)} className="cursor-pointer">
                  <div className="mr-2 flex h-4 w-4 items-center justify-center">
                    <Checkbox checked={selected.has(opt.value)} onCheckedChange={() => toggle(opt.value)} />
                  </div>
                  <span>{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelect;


