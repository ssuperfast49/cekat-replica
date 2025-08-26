import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, MessageCircle, Globe, Send } from "lucide-react";

interface PlatformSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlatformSelect: (platform: 'whatsapp' | 'web' | 'telegram') => void;
}

const PlatformSelectionModal = ({ isOpen, onClose, onPlatformSelect }: PlatformSelectionModalProps) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'whatsapp' | 'web' | 'telegram' | null>(null);

  const handlePlatformSelect = (platform: 'whatsapp' | 'web' | 'telegram') => {
    setSelectedPlatform(platform);
    onPlatformSelect(platform);
    onClose();
  };

  const platforms = [
    {
      id: 'whatsapp' as const,
      name: 'WhatsApp',
      description: 'Connect your WhatsApp Business account',
      icon: MessageCircle,
      color: 'bg-green-500',
      iconColor: 'text-white'
    },
    {
      id: 'web' as const,
      name: 'Web Live Chat',
      description: 'Add live chat to your website',
      icon: Globe,
      color: 'bg-blue-500',
      iconColor: 'text-white'
    },
    {
      id: 'telegram' as const,
      name: 'Telegram Bot',
      description: 'Connect your Telegram bot via BotFather',
      icon: Send,
      color: 'bg-blue-400',
      iconColor: 'text-white'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            {/* <DialogTitle className="text-lg font-semibold">Platform</DialogTitle> */}
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button> */}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Select the platform you wish to establish your new inbox.
          </p>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handlePlatformSelect(platform.id)}
                className="flex flex-col items-center p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/50 transition-all duration-200 group"
              >
                <div className={`w-12 h-12 rounded-full ${platform.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                  <platform.icon className={`h-6 w-6 ${platform.iconColor}`} />
                </div>
                <span className="text-sm font-medium text-center">{platform.name}</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  {platform.description}
                </span>
              </button>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              More platforms coming soon
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlatformSelectionModal;
