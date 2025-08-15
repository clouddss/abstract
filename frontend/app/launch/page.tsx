'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseEther } from 'viem'
import { Button } from '@/components/ui/Button'
import { tokensService } from '@/lib/api/services/tokens.service'
import { useAuth } from '@/hooks/useAuth'
import { 
  Rocket, 
  Upload, 
  Info, 
  Zap, 
  Shield, 
  Globe,
  MessageCircle,
  Twitter,
  DollarSign,
  Users,
  Target,
  AlertCircle
} from 'lucide-react'

export default function LaunchPage() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    website: '',
    twitter: '',
    telegram: ''
  })
  const [step, setStep] = useState(1)
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchFee, setLaunchFee] = useState('0.01')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch current launch fee
    tokensService.getLaunchFee().then(response => {
      if (response.success) {
        setLaunchFee(response.data.feeFormatted)
      }
    }).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected || !walletClient || !publicClient || !user) {
      setError('Please connect your wallet first')
      return
    }

    setIsLaunching(true)
    setError(null)

    try {
      // Step 1: Get transaction data from backend
      const launchResponse = await tokensService.launchToken(formData)
      
      if (!launchResponse.success) {
        throw new Error('Failed to prepare token launch')
      }

      const { to, data, value, estimatedGas } = launchResponse.data

      // Step 2: Send transaction via wallet
      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        value: BigInt(value),
        gas: BigInt(estimatedGas)
      })

      console.log('Transaction sent:', hash)

      // Step 3: Wait for transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      if (receipt.status !== 'success') {
        throw new Error('Transaction failed')
      }

      // Step 4: Confirm with backend
      const confirmResponse = await tokensService.confirmTokenLaunch({
        txHash: hash,
        ...formData
      })

      if (confirmResponse.success) {
        // Navigate to the new token page
        router.push(`/token/${confirmResponse.data.token.address}`)
      } else {
        throw new Error('Failed to confirm token launch')
      }
    } catch (err: any) {
      console.error('Launch error:', err)
      setError(err.message || 'Failed to launch token')
    } finally {
      setIsLaunching(false)
    }
  }

  const nextStep = () => setStep(step + 1)
  const prevStep = () => setStep(step - 1)

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Rocket className="h-10 w-10 text-primary animate-pulse" />
            <h1 className="text-4xl font-bold gradient-text">Launch Your Token</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create your token with fair launch bonding curves. No presales, no team allocations - just pure community-driven growth.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${step >= stepNum 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : 'border-muted-foreground text-muted-foreground'
                  }
                `}>
                  {stepNum}
                </div>
                {stepNum < 3 && (
                  <div className={`
                    w-12 h-0.5 mx-2 transition-all duration-300
                    ${step > stepNum ? 'bg-primary' : 'bg-muted-foreground'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2 space-x-16">
            <span className={`text-sm ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              Token Info
            </span>
            <span className={`text-sm ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              Socials
            </span>
            <span className={`text-sm ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
              Launch
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Token Information */}
          {step === 1 && (
            <div className="glass-card rounded-lg p-8 space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <Info className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold">Token Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-3 flex items-center">
                    <Zap className="h-4 w-4 mr-2 text-primary" />
                    Token Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="My Awesome Token"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3 flex items-center">
                    <Target className="h-4 w-4 mr-2 text-primary" />
                    Symbol *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="AWESOME"
                    value={formData.symbol}
                    onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Description</label>
                <textarea
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  rows={4}
                  placeholder="Describe your token and its purpose..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 flex items-center">
                  <Upload className="h-4 w-4 mr-2 text-primary" />
                  Image URL
                </label>
                <input
                  type="url"
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="https://example.com/image.png"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Recommended: 512x512px PNG or JPG
                </p>
              </div>

              <div className="flex justify-end">
                <Button 
                  type="button" 
                  onClick={nextStep}
                  disabled={!formData.name || !formData.symbol}
                  className="btn-gradient px-8"
                >
                  Next Step
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Social Links */}
          {step === 2 && (
            <div className="glass-card rounded-lg p-8 space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <Users className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold">Social Links</h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-3 flex items-center">
                    <Globe className="h-4 w-4 mr-2 text-primary" />
                    Website
                  </label>
                  <input
                    type="url"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="https://yourtoken.com"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3 flex items-center">
                    <Twitter className="h-4 w-4 mr-2 text-primary" />
                    Twitter
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="@yourtoken"
                    value={formData.twitter}
                    onChange={(e) => setFormData({...formData, twitter: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3 flex items-center">
                    <MessageCircle className="h-4 w-4 mr-2 text-primary" />
                    Telegram
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="@yourtokencommunity"
                    value={formData.telegram}
                    onChange={(e) => setFormData({...formData, telegram: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" onClick={prevStep} variant="outline">
                  Previous
                </Button>
                <Button type="button" onClick={nextStep} className="btn-gradient px-8">
                  Next Step
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Launch Confirmation */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Preview Card */}
              <div className="glass-card rounded-lg p-8">
                <h2 className="text-2xl font-semibold mb-6 flex items-center">
                  <Shield className="h-6 w-6 mr-2 text-primary" />
                  Launch Preview
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg gradient-text">{formData.name || 'Token Name'}</h3>
                      <p className="text-muted-foreground">${formData.symbol || 'SYMBOL'}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formData.description || 'Token description will appear here...'}
                    </p>
                    <div className="space-y-2 text-sm">
                      {formData.website && (
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-primary" />
                          <span className="text-primary">{formData.website}</span>
                        </div>
                      )}
                      {formData.twitter && (
                        <div className="flex items-center space-x-2">
                          <Twitter className="h-4 w-4 text-primary" />
                          <span className="text-primary">{formData.twitter}</span>
                        </div>
                      )}
                      {formData.telegram && (
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <span className="text-primary">{formData.telegram}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="glass-morphism rounded-lg p-6 space-y-4">
                    <h4 className="font-semibold">Launch Parameters</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Supply</span>
                        <span className="font-semibold">1,000,000,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Initial Price</span>
                        <span className="font-semibold">$0.000001</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Launch Fee</span>
                        <span className="font-semibold text-yellow-400">{launchFee} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform Fee</span>
                        <span className="font-semibold">0.5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Launch Info */}
              <div className="glass-card rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <Info className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center">
                      <DollarSign className="h-4 w-4 mr-1 text-yellow-400" />
                      Launch Fee: {launchFee} ETH
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This one-time fee helps prevent spam and funds continued platform development. 
                      Your token will be immediately available for trading with a fair bonding curve mechanism.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span>Fair launch - no presale</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span>Automatic liquidity provision</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span>Bonding curve price discovery</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span>Auto-migration to DEX</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="glass-card rounded-lg p-4 border border-red-500/20 bg-red-500/10">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <p className="text-red-500">{error}</p>
                  </div>
                </div>
              )}

              {/* Wallet Connection Check */}
              {!isConnected && (
                <div className="glass-card rounded-lg p-4 border border-yellow-500/20 bg-yellow-500/10">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <p className="text-yellow-500">Please connect your wallet to launch a token</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button type="button" onClick={prevStep} variant="outline">
                  Previous
                </Button>
                <Button 
                  type="submit" 
                  className="btn-gradient px-8 py-3"
                  disabled={isLaunching || !isConnected}
                >
                  {isLaunching ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Launching...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Rocket className="h-4 w-4" />
                      <span>Launch Token</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}