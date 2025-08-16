import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LogOut, User, Mail, Calendar, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export default function UserProfile() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || user.email} />
            <AvatarFallback className="text-lg">
              {getUserInitials(user.user_metadata?.full_name, user.email || '')}
            </AvatarFallback>
          </Avatar>
        </div>
        <CardTitle className="text-xl">
          {user.user_metadata?.full_name || 'User'}
        </CardTitle>
        <CardDescription>{user.email}</CardDescription>
        <div className="flex justify-center mt-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {user.email_confirmed_at ? 'Verified' : 'Unverified'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Member since</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(user.created_at)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">User ID</p>
              <p className="text-sm text-muted-foreground font-mono">
                {user.id.substring(0, 8)}...
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleSignOut}
          disabled={loading}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {loading ? 'Signing out...' : 'Sign Out'}
        </Button>
      </CardContent>
    </Card>
  );
}
