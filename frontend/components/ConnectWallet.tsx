import React from 'react'
import { Button } from './ui/Button'
import { Wallet } from 'lucide-react'

export function ConnectWallet() {
  // Mock implementation - in real app would use wagmi hooks
  const [isConnected, setIsConnected] = React.useState(false)
  const [address, setAddress] = React.useState<string>('')

  const handleConnect = () => {
    // Mock connection
    setIsConnected(true)
    setAddress('0x1234...5678')
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setAddress('')
  }

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-3 py-1 rounded-full text-sm font-medium">
          {address}
        </div>
        <Button variant="outline" size="sm" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={handleConnect} className="bg-purple-600 hover:bg-purple-700">
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  )
}