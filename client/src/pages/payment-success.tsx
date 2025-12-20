import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, ArrowRight, Home, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function PaymentSuccessPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get session_id from URL
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (!sessionId) {
      setStatus('success'); // Just show success without verification
      return;
    }

    // Verify the payment session
    const verifyPayment = async () => {
      try {
        // Give Stripe webhook a moment to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Invalidate account queries to refresh balance
        await queryClient.invalidateQueries({ queryKey: ['account'] });
        await queryClient.invalidateQueries({ queryKey: ['ledger'] });

        setStatus('success');
      } catch (err) {
        console.error('Error verifying payment:', err);
        setError(err instanceof Error ? err.message : 'Failed to verify payment');
        setStatus('error');
      }
    };

    verifyPayment();
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="max-w-md mx-auto mt-12">
          <Card className="text-center">
            <CardHeader className="pb-2">
              {status === 'verifying' && (
                <>
                  <div className="mx-auto mb-4">
                    <Loader2 className="h-16 w-16 text-primary animate-spin" />
                  </div>
                  <CardTitle className="text-xl">Processing Payment</CardTitle>
                  <CardDescription>
                    Please wait while we confirm your payment...
                  </CardDescription>
                </>
              )}

              {status === 'success' && (
                <>
                  <div className="mx-auto mb-4">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                  </div>
                  <CardTitle className="text-xl text-green-700">Payment Successful!</CardTitle>
                  <CardDescription>
                    Your funds have been added to your account.
                  </CardDescription>
                </>
              )}

              {status === 'error' && (
                <>
                  <div className="mx-auto mb-4">
                    <AlertCircle className="h-16 w-16 text-amber-500" />
                  </div>
                  <CardTitle className="text-xl text-amber-700">Payment Processing</CardTitle>
                  <CardDescription>
                    {error || 'Your payment is being processed. It may take a moment to reflect in your balance.'}
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {status !== 'verifying' && (
                <>
                  <div className="flex flex-col gap-2">
                    <Button asChild>
                      <Link href="/account">
                        <ArrowRight className="mr-2 h-4 w-4" />
                        View Balance
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/">
                        <Home className="mr-2 h-4 w-4" />
                        Back to Dashboard
                      </Link>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A receipt has been sent to your email.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
