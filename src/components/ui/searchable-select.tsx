import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: Option[]
  value?: string | null
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedLabel = React.useMemo(() => {
    return options.find((option) => option.value === value)?.label
  }, [options, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
          disabled={disabled}
        >
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface SearchableMultiSelectProps {
  options: Option[]
  value: string[]
  onChange: (value: string[]) => void
  onAdd?: (value: string) => void
  onRemove?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
}

export function SearchableMultiSelect({
  options,
  value = [],
  onChange,
  onAdd,
  onRemove,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(() => {
    return value.map(v => options.find(o => o.value === v) || { value: v, label: v })
  }, [value, options])

  const unselectedOptions = React.useMemo(() => {
    return options.filter(o => !value.includes(o.value))
  }, [options, value])

  const handleSelect = (val: string) => {
    if (value.includes(val)) return
    const newValue = [...value, val]
    onChange(newValue)
    onAdd?.(val)
    setOpen(false)
  }

  const handleRemove = (val: string) => {
    const newValue = value.filter((v) => v !== val)
    onChange(newValue)
    onRemove?.(val)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-1">
           {selected.map((item) => (
              <Badge key={item.value} variant="secondary" className="pr-1 py-1 flex items-center gap-1">
                {item.label}
                <button
                  type="button"
                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-muted"
                  onClick={(e) => {
                    e.preventDefault()
                    handleRemove(item.value)
                  }}
                  disabled={disabled}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  <span className="sr-only">Remove {item.label}</span>
                </button>
              </Badge>
            ))}
        </div>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
             variant="outline"
             role="combobox"
             aria-expanded={open}
             className="w-full justify-between font-normal text-muted-foreground"
             disabled={disabled}
          >
            <span>{placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {unselectedOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

