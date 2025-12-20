import { Link } from "wouter";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, RefreshCw, Home } from "lucide-react";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="max-w-md mx-auto mt-12">
          <Card className="text-center">
            <CardHeader className="pb-2">
              <div className="mx-auto mb-4">
                <XCircle className="h-16 w-16 text-slate-400" />
              </div>
              <CardTitle className="text-xl">Payment Cancelled</CardTitle>
              <CardDescription>
                Your payment was not completed. No charges have been made.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <Link href="/account">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
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
                If you experienced any issues, please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
