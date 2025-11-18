import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AiPausedModalProps {
	open: boolean;
	onClose: () => void;
	isMasterAgent: boolean;
	pausedByName?: string | null;
	pausedAt?: string | null;
	onOpenAdminPanel?: () => void;
}

export default function AiPausedModal({
	open,
	onClose,
	isMasterAgent,
	pausedByName,
	pausedAt,
	onOpenAdminPanel,
}: AiPausedModalProps) {
	const formattedAt = pausedAt ? new Date(pausedAt).toLocaleString() : null;

	return (
		<Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>AI Replies Are Currently Paused</DialogTitle>
					<DialogDescription>
						{isMasterAgent ? (
							<span>
								AI responses are paused across every channel. Synka will not send AI replies until you resume them in <strong>Admin Panel → AI Controls</strong>.
							</span>
						) : (
							<span>
								A master agent paused all AI responses across every channel. Synka will not send AI replies until this setting is changed. Only a master agent can resume AI replies.
							</span>
						)}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-1 text-xs text-muted-foreground">
					{pausedByName ? <div>Paused by: {pausedByName}</div> : null}
					{formattedAt ? <div>At: {formattedAt}</div> : null}
				</div>
				<DialogFooter className="gap-2">
					{isMasterAgent ? (
						<Button variant="ghost" onClick={onOpenAdminPanel}>
							Open Admin Panel
						</Button>
					) : null}
					<Button onClick={onClose}>Got it</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

