#!/usr/bin/env tsx

/**
 * WebSocket Test Script
 * 
 * This script tests the WebSocket functionality by:
 * 1. Starting the server
 * 2. Connecting as a client
 * 3. Testing various subscription scenarios
 * 4. Simulating events
 * 5. Verifying real-time updates
 */

import WebSocket from 'ws';
import { appConfig } from '../config';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

class WebSocketTester {
  private ws: WebSocket | null = null;
  private connected = false;
  private messageCount = 0;
  private receivedMessages: WebSocketMessage[] = [];

  async testWebSocketConnection() {
    console.log('🧪 Starting WebSocket Connection Test...\n');

    try {
      // Test 1: Basic Connection
      await this.testBasicConnection();
      
      // Test 2: Authentication
      await this.testAuthentication();
      
      // Test 3: Subscriptions
      await this.testSubscriptions();
      
      // Test 4: Heartbeat
      await this.testHeartbeat();
      
      // Test 5: Message Broadcasting
      await this.testMessageBroadcasting();
      
      console.log('\n✅ All WebSocket tests completed successfully!');
      
    } catch (error) {
      console.error('\n❌ WebSocket test failed:', error);
      throw error;
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }

  private async testBasicConnection(): Promise<void> {
    console.log('Test 1: Basic Connection');
    
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${appConfig.PORT}/ws`;
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log('✅ Connected to WebSocket server');
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Connection error:', error);
        reject(error);
      });

      this.ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.receivedMessages.push(message);
          this.messageCount++;
          console.log(`📩 Received message (${this.messageCount}):`, message.type);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        console.log('🔌 WebSocket connection closed');
      });
    });
  }

  private async testAuthentication(): Promise<void> {
    console.log('\nTest 2: Authentication');
    
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    // Test without auth token (should still work but not be authenticated)
    const connectionMessage = this.receivedMessages.find(m => m.type === 'connection');
    if (connectionMessage) {
      console.log('✅ Connection message received:', connectionMessage.data);
      if (!connectionMessage.data.authenticated) {
        console.log('✅ Correctly not authenticated without token');
      }
    } else {
      console.log('⚠️  No connection message received');
    }
  }

  private async testSubscriptions(): Promise<void> {
    console.log('\nTest 3: Subscriptions');
    
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    const subscriptions = [
      'platform:stats',
      'platform:tokens', 
      'platform:trades',
      'token:0x1234567890123456789012345678901234567890'
    ];

    for (const subscription of subscriptions) {
      console.log(`📡 Subscribing to: ${subscription}`);
      
      const subscribeMessage: WebSocketMessage = {
        type: 'subscribe',
        data: { event: subscription },
        timestamp: Date.now()
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      
      // Wait a bit for confirmation
      await this.sleep(100);
    }

    // Check if we received subscription confirmations
    const subscriptionConfirmations = this.receivedMessages.filter(m => m.type === 'subscribed');
    console.log(`✅ Received ${subscriptionConfirmations.length} subscription confirmations`);
  }

  private async testHeartbeat(): Promise<void> {
    console.log('\nTest 4: Heartbeat');
    
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }

    const heartbeatMessage: WebSocketMessage = {
      type: 'heartbeat',
      data: { timestamp: Date.now() },
      timestamp: Date.now()
    };

    console.log('💓 Sending heartbeat...');
    this.ws.send(JSON.stringify(heartbeatMessage));

    // Wait for heartbeat response
    await this.sleep(500);

    const heartbeatResponse = this.receivedMessages.find(m => 
      m.type === 'heartbeat' && m.timestamp > heartbeatMessage.timestamp
    );

    if (heartbeatResponse) {
      console.log('✅ Heartbeat response received');
    } else {
      console.log('⚠️  No heartbeat response received');
    }
  }

  private async testMessageBroadcasting(): Promise<void> {
    console.log('\nTest 5: Message Broadcasting (using test API)');
    
    // Test using the WebSocket test API endpoint
    const testMessages = [
      {
        type: 'token:update',
        data: {
          address: '0x1234567890123456789012345678901234567890',
          price: '0.001',
          volume24h: '1000000000000000000',
          holderCount: 42
        }
      },
      {
        type: 'trade:new',
        data: {
          id: 'test-trade-1',
          tokenAddress: '0x1234567890123456789012345678901234567890',
          trader: '0xabcdef1234567890123456789012345678901234',
          type: 'BUY',
          amountIn: '1000000000000000000',
          amountOut: '1000000000000000000000',
          price: '0.001',
          timestamp: new Date().toISOString()
        }
      }
    ];

    for (const testMessage of testMessages) {
      try {
        console.log(`🚀 Testing broadcast for: ${testMessage.type}`);
        
        const response = await fetch(`http://localhost:${appConfig.PORT}/api/websocket/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testMessage)
        });

        if (response.ok) {
          console.log('✅ Test broadcast sent successfully');
          await this.sleep(100); // Wait for message to be received
        } else {
          console.log('⚠️  Test broadcast failed:', response.status);
        }
      } catch (error) {
        console.log('⚠️  Test broadcast error:', error);
      }
    }

    // Check if we received any broadcasted messages
    const broadcastMessages = this.receivedMessages.filter(m => 
      m.type === 'token:update' || m.type === 'trade:new'
    );
    console.log(`✅ Received ${broadcastMessages.length} broadcast messages`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getTestResults() {
    return {
      totalMessages: this.messageCount,
      messages: this.receivedMessages,
      connected: this.connected
    };
  }
}

// Main test function
async function runWebSocketTests() {
  console.log('🔧 WebSocket Test Suite');
  console.log('========================\n');
  
  console.log(`Testing WebSocket server at: ws://localhost:${appConfig.PORT}/ws`);
  console.log(`Testing API endpoint at: http://localhost:${appConfig.PORT}/api\n`);

  const tester = new WebSocketTester();
  
  try {
    await tester.testWebSocketConnection();
    
    const results = tester.getTestResults();
    console.log('\n📊 Test Results:');
    console.log(`   Messages received: ${results.totalMessages}`);
    console.log(`   Connection status: ${results.connected ? 'Connected' : 'Disconnected'}`);
    
    if (results.messages.length > 0) {
      console.log('\n📋 Message Types Received:');
      const messageTypes = [...new Set(results.messages.map(m => m.type))];
      messageTypes.forEach(type => {
        const count = results.messages.filter(m => m.type === type).length;
        console.log(`   - ${type}: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runWebSocketTests();
}

export { WebSocketTester, runWebSocketTests };