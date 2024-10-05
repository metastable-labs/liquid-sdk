import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiquidSDK, WebPassKeys } from 'liquid-sdk';
import React, { useState } from 'react';

const PasskeysAuth: React.FC = () => {
  const [username, setUsername] = useState('');
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sdk = new LiquidSDK(
    'https://mainnet.base.org',
    new WebPassKeys(),
    'https://lserver.local',
    'fjnsvjl', // make sure this matches with set backend api key
  );

  const handleRegister = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { address } = await sdk.createSmartAccount(username);
      setAddress(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Welcome</CardTitle>
          <CardDescription className="text-center">Sign in or create an account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="register">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRegister();
                }}>
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Registering...' : 'Register'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        {error && (
          <CardFooter>
            <p className="text-sm text-destructive w-full text-center">{error}</p>
          </CardFooter>
        )}
        {address && (
          <CardFooter>
            <p className="text-sm w-full text-center">Smart Account Address: {address}</p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default PasskeysAuth;
