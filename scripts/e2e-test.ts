import { ethers } from 'ethers';
import axios from 'axios';
import WebSocket from 'ws';
import chalk from 'chalk';

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:5000/api',
  WS_URL: process.env.WS_URL || 'ws://localhost:5000',
  RPC_URL: process.env.RPC_URL || 'https://api.testnet.abs.xyz',
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  FACTORY_ADDRESS: process.env.FACTORY_ADDRESS || '',
};

// Test utilities
const log = {
  info: (msg: string) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg: string) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`[ERROR] ${msg}`)),
  warn: (msg: string) => console.log(chalk.yellow(`[WARN] ${msg}`)),
};

// API client
const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 10000,
});

// Test runner class
class E2ETestRunner {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private ws: WebSocket | null = null;
  private testResults: { test: string; status: 'pass' | 'fail'; error?: string }[] = [];

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
  }

  async run() {
    log.info('Starting E2E tests...');
    
    try {
      // Test suite
      await this.testAPIHealth();
      await this.testWebSocketConnection();
      await this.testTokenList();
      await this.testTokenCreation();
      await this.testTokenTrading();
      await this.testRewardsSystem();
      await this.testLeaderboard();
      await this.testRealTimeUpdates();
      
      // Print results
      this.printResults();
    } catch (error) {
      log.error(`Test suite failed: ${error}`);
    } finally {
      this.cleanup();
    }
  }

  private async testAPIHealth() {
    const testName = 'API Health Check';
    try {
      const response = await api.get('/health');
      if (response.data.status === 'ok') {
        this.recordResult(testName, 'pass');
        log.success(`${testName} passed`);
      } else {
        throw new Error('Health check returned non-ok status');
      }
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private async testWebSocketConnection() {
    const testName = 'WebSocket Connection';
    try {
      await new Promise<void>((resolve, reject) => {
        this.ws = new WebSocket(CONFIG.WS_URL);
        
        this.ws.on('open', () => {
          log.success(`${testName} established`);
          this.recordResult(testName, 'pass');
          resolve();
        });
        
        this.ws.on('error', (error) => {
          reject(error);
        });
        
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private async testTokenList() {
    const testName = 'Token List API';
    try {
      const response = await api.get('/tokens', {
        params: { page: 1, limit: 10 }
      });
      
      if (response.data.success && Array.isArray(response.data.data.tokens)) {
        log.success(`${testName} passed - Found ${response.data.data.tokens.length} tokens`);
        this.recordResult(testName, 'pass');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private async testTokenCreation() {
    const testName = 'Token Creation Flow';
    try {
      // 1. Get creation estimate
      const estimateResponse = await api.post('/tokens/create', {
        name: 'E2E Test Token',
        symbol: 'E2E',
        description: 'Token created by E2E test',
        imageUrl: 'https://example.com/test.png'
      });
      
      if (!estimateResponse.data.success) {
        throw new Error('Failed to get creation estimate');
      }
      
      log.info(`Gas estimate: ${estimateResponse.data.data.estimatedGas}`);
      log.info(`Launch fee: ${estimateResponse.data.data.launchFee} ETH`);
      
      // 2. Would deploy contract here in real test
      // For now, we'll just validate the API response
      
      this.recordResult(testName, 'pass');
      log.success(`${testName} passed`);
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private async testTokenTrading() {
    const testName = 'Token Trading API';
    try {
      // Get a token to test with
      const tokensResponse = await api.get('/tokens', { params: { limit: 1 } });
      
      if (!tokensResponse.data.data.tokens.length) {
        throw new Error('No tokens available for testing');
      }
      
      const testToken = tokensResponse.data.data.tokens[0];
      log.info(`Testing trades for token: ${testToken.symbol}`);
      
      // Get token trades
      const tradesResponse = await api.get(`/tokens/${testToken.address}/trades`);
      
      if (!tradesResponse.data.success) {
        throw new Error('Failed to fetch trades');
      }
      
      log.success(`Found ${tradesResponse.data.data.trades.length} trades`);
      this.recordResult(testName, 'pass');
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private async testRewardsSystem() {
    const testName = 'Rewards System';
    try {
      // Get current epoch
      const epochResponse = await api.get('/rewards/current-epoch');
      
      if (!epochResponse.data.success) {
        throw new Error('Failed to get current epoch');
      }
      
      const epoch = epochResponse.data.data;
      log.info(`Current epoch: ${epoch.epochNumber}`);
      log.info(`Total rewards: ${epoch.totalEthRewards} ETH, ${epoch.totalUsdcRewards} USDC`);
      
      // Check eligibility for test wallet
      const eligibilityResponse = await api.get(`/rewards/eligibility/${this.wallet.address}`);
      
      if (eligibilityResponse.data.success) {
        log.success(`Eligibility check passed`);
      }
      
      this.recordResult(testName, 'pass');
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private async testLeaderboard() {
    const testName = 'Leaderboard API';
    try {
      const response = await api.get('/stats/leaderboard', {
        params: { period: '24h', limit: 10 }
      });
      
      if (!response.data.success || !Array.isArray(response.data.data.traders)) {
        throw new Error('Invalid leaderboard response');
      }
      
      log.success(`Leaderboard has ${response.data.data.traders.length} traders`);
      this.recordResult(testName, 'pass');
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private async testRealTimeUpdates() {
    const testName = 'Real-time Updates';
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.recordResult(testName, 'fail', 'WebSocket not connected');
      log.error(`${testName} failed: WebSocket not connected`);
      return;
    }
    
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for WebSocket message'));
        }, 10000);
        
        this.ws!.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            log.info(`Received WebSocket message: ${message.type}`);
            clearTimeout(timeout);
            this.recordResult(testName, 'pass');
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        // Subscribe to updates
        this.ws!.send(JSON.stringify({
          type: 'subscribe',
          channel: 'trades'
        }));
      });
      
      log.success(`${testName} passed`);
    } catch (error: any) {
      this.recordResult(testName, 'fail', error.message);
      log.error(`${testName} failed: ${error.message}`);
    }
  }

  private recordResult(test: string, status: 'pass' | 'fail', error?: string) {
    this.testResults.push({ test, status, error });
  }

  private printResults() {
    console.log('\n' + chalk.bold('=== E2E Test Results ==='));
    
    const passed = this.testResults.filter(r => r.status === 'pass').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;
    
    this.testResults.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : '❌';
      const color = result.status === 'pass' ? chalk.green : chalk.red;
      console.log(`${icon} ${color(result.test)}`);
      if (result.error) {
        console.log(`   ${chalk.gray(result.error)}`);
      }
    });
    
    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.bold(`Total: ${this.testResults.length}`));
    
    if (failed === 0) {
      console.log('\n' + chalk.green.bold('🎉 All tests passed!'));
    } else {
      console.log('\n' + chalk.red.bold('❌ Some tests failed'));
      process.exit(1);
    }
  }

  private cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Performance test utilities
async function performanceTest() {
  log.info('Running performance tests...');
  
  const endpoints = [
    { name: 'Token List', url: '/tokens', expectedMs: 500 },
    { name: 'Token Details', url: '/tokens/0x1234567890123456789012345678901234567890', expectedMs: 300 },
    { name: 'Platform Stats', url: '/stats/platform', expectedMs: 200 },
  ];
  
  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      await api.get(endpoint.url);
      const duration = Date.now() - start;
      
      if (duration <= endpoint.expectedMs) {
        log.success(`${endpoint.name}: ${duration}ms (✓ under ${endpoint.expectedMs}ms)`);
      } else {
        log.warn(`${endpoint.name}: ${duration}ms (⚠ over ${endpoint.expectedMs}ms)`);
      }
    } catch (error) {
      log.error(`${endpoint.name}: Failed`);
    }
  }
}

// Main execution
async function main() {
  console.log(chalk.bold.blue('\n🧪 Abstract Platform E2E Test Suite\n'));
  
  // Validate configuration
  if (!CONFIG.PRIVATE_KEY) {
    log.error('PRIVATE_KEY environment variable is required');
    process.exit(1);
  }
  
  // Run tests
  const runner = new E2ETestRunner();
  await runner.run();
  
  // Run performance tests
  console.log('\n');
  await performanceTest();
}

// Execute
main().catch(error => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});