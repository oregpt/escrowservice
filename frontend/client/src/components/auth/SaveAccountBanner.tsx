import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, X, AlertCircle } from 'lucide-react';
import { useAuth, useConvertAccount, useLogin, useRegister } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';

export function SaveAccountBanner() {
  const { toast } = useToast();
  const { data: authData, refetch: refetchAuth } = useAuth();
  const convertAccount = useConvertAccount();
  const login = useLogin();
  const register = useRegister();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'save' | 'login'>('save');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const user = authData?.user;

  // Don't show if already authenticated
  if (user?.isAuthenticated) {
    return null;
  }

  const handleSaveAccount = async () => {
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      // If user has a session, convert it. Otherwise, create a new account.
      if (user?.id) {
        await convertAccount.mutateAsync({
          username: username.trim(),
          password,
          email: email.trim(),
          displayName: displayName.trim() || undefined,
        });
      } else {
        // No session - create a fresh account
        await register.mutateAsync({
          username: username.trim(),
          password,
          email: email.trim(),
          displayName: displayName.trim() || undefined,
        });
      }
      // Force immediate refetch of auth data
      await refetchAuth();
      toast({
        title: 'Account created!',
        description: 'Your account has been created. You can now log in anytime.',
      });
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  const handleLogin = async () => {
    setError('');

    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      await login.mutateAsync({ username: username.trim(), password });
      // Force immediate refetch of auth data
      await refetchAuth();
      toast({
        title: 'Welcome back!',
        description: 'You have been logged in successfully.',
      });
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username or password');
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setEmail('');
    setDisplayName('');
    setError('');
  };

  const isLoading = convertAccount.isPending || login.isPending;

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <span>
            You're using a guest session. Save your account to keep your progress!
          </span>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="border-amber-300 bg-white hover:bg-amber-50">
              <Save className="h-4 w-4 mr-1" />
              Save Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {mode === 'save' ? 'Save Your Account' : 'Sign In'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'save'
                  ? 'Create a username and password to save your progress and access your account from anywhere.'
                  : 'Sign in to your existing account.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={mode === 'save' ? 'Choose a password (min 6 characters)' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {mode === 'save' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name (optional)</Label>
                    <Input
                      id="displayName"
                      placeholder="How should we call you?"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}

              <Button
                className="w-full"
                onClick={mode === 'save' ? handleSaveAccount : handleLogin}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === 'save' ? 'Save Account' : 'Sign In'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {mode === 'save' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setMode('login');
                        setError('');
                      }}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setMode('save');
                        setError('');
                      }}
                    >
                      Create one
                    </button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
