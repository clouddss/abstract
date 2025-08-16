import { apiClient } from '../client';
import { Address, TradeType } from '../types/common.types';

export interface EstimateTradeRequest {
  tokenAddress: Address;
  type: TradeType;
  amountIn: string;
}

export interface EstimateTradeResponse {
  outputAmount: string;
  currentPrice: string;
  priceImpact: number;
  fee: string;
  minimumReceived: string;
  executionPrice: string;
  // Keep old field names for compatibility
  amountOut?: string;
  price?: string;
  estimatedGas?: string;
}

export interface ExecuteTradeRequest {
  tokenAddress: Address;
  type: TradeType;
  amountIn: string;
  minAmountOut: string;
  deadline?: number;
}

export interface ExecuteTradeResponse {
  txHash: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
  transactionData?: {
    to: string;
    data: string;
    value: string;
  };
}

export interface TradeStatus {
  txHash: string;
  status: 'pending' | 'success' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  trade?: {
    id: string;
    amountIn: string;
    amountOut: string;
    price: string;
    fee: string;
    timestamp: string;
  };
}

export interface GetUserTradesParams {
  page?: number;
  limit?: number;
  tokenAddress?: Address;
  type?: TradeType;
}

export interface UserTrade {
  id: string;
  tokenAddress: Address;
  tokenName: string;
  tokenSymbol: string;
  type: TradeType;
  amountIn: string;
  amountOut: string;
  price: string;
  fee: string;
  txHash: string;
  timestamp: string;
  status: 'success' | 'failed';
}

export interface GetUserTradesResponse {
  trades: UserTrade[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class TradesService {
  private static instance: TradesService;
  
  private constructor() {}

  public static getInstance(): TradesService {
    if (!TradesService.instance) {
      TradesService.instance = new TradesService();
    }
    return TradesService.instance;
  }

  /**
   * Estimate trade output and impact
   */
  async estimateTrade(data: EstimateTradeRequest): Promise<EstimateTradeResponse> {
    const response = await apiClient.post<EstimateTradeResponse>('/trades/estimate', data);
    // Map new field names to old ones for backward compatibility
    return {
      ...response,
      amountOut: response.outputAmount,
      price: response.currentPrice,
      estimatedGas: '0' // Default value since backend doesn't return this yet
    };
  }

  /**
   * Execute a trade
   */
  async executeTrade(data: ExecuteTradeRequest): Promise<ExecuteTradeResponse> {
    // Set default deadline to 20 minutes from now
    const defaultDeadline = Math.floor(Date.now() / 1000) + 20 * 60;
    
    return apiClient.post<ExecuteTradeResponse>('/trades/execute', {
      ...data,
      deadline: data.deadline || defaultDeadline,
    });
  }

  /**
   * Confirm a trade after blockchain confirmation
   */
  async confirmTrade(txHash: string, tokenAddress: string, tradeType: 'buy' | 'sell'): Promise<any> {
    return apiClient.post('/trades/confirm', {
      txHash,
      tokenAddress,
      tradeType
    });
  }

  /**
   * Get trade status by transaction hash
   */
  async confirmTrade(data: {
    txHash: string;
    tokenAddress: Address;
    tradeType: 'buy' | 'sell';
  }): Promise<{
    success: boolean;
    data?: any;
    message: string;
  }> {
    return apiClient.post('/trades/confirm', data);
  }

  /**
   * Get trade status by transaction hash
   */
  async getTradeStatus(txHash: string): Promise<TradeStatus> {
    return apiClient.get<TradeStatus>(`/trades/status/${txHash}`);
  }

  /**
   * Get user's trade history
   */
  async getUserTrades(address: Address, params?: GetUserTradesParams): Promise<GetUserTradesResponse> {
    return apiClient.get<GetUserTradesResponse>(`/trades/user/${address}`, { params });
  }

  /**
   * Calculate minimum output with slippage
   */
  calculateMinimumOutput(expectedOutput: string | undefined, slippagePercent: number = 0.5): string {
    if (!expectedOutput || expectedOutput === '0') {
      return '0';
    }
    try {
      const output = BigInt(expectedOutput);
      const slippage = BigInt(Math.floor(slippagePercent * 100)); // Convert to basis points
      const minOutput = output - (output * slippage) / BigInt(10000);
      return minOutput.toString();
    } catch (error) {
      console.error('Error calculating minimum output:', error);
      return '0';
    }
  }

  /**
   * Format trade for display
   */
  formatTrade(trade: UserTrade): {
    type: string;
    amount: string;
    token: string;
    price: string;
    value: string;
    status: string;
  } {
    const isBuy = trade.type === TradeType.BUY;
    
    return {
      type: isBuy ? 'Buy' : 'Sell',
      amount: isBuy ? trade.amountOut : trade.amountIn,
      token: trade.tokenSymbol,
      price: trade.price,
      value: isBuy ? trade.amountIn : trade.amountOut,
      status: trade.status,
    };
  }

  /**
   * Monitor trade status with polling
   */
  async monitorTradeStatus(
    txHash: string,
    onUpdate?: (status: TradeStatus) => void,
    maxAttempts: number = 60,
    interval: number = 2000
  ): Promise<TradeStatus> {
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.getTradeStatus(txHash);
          
          if (onUpdate) {
            onUpdate(status);
          }
          
          if (status.status === 'success' || status.status === 'failed') {
            resolve(status);
            return;
          }
          
          attempts++;
          
          if (attempts >= maxAttempts) {
            reject(new Error('Trade monitoring timeout'));
            return;
          }
          
          setTimeout(checkStatus, interval);
        } catch (error) {
          reject(error);
        }
      };
      
      checkStatus();
    });
  }

  /**
   * Get trade analytics for a user
   */
  async getUserTradeAnalytics(address: Address): Promise<{
    totalTrades: number;
    totalVolume: string;
    totalFees: string;
    successRate: number;
    favoriteTokens: Array<{
      address: Address;
      name: string;
      symbol: string;
      tradeCount: number;
      volume: string;
    }>;
  }> {
    // This would be implemented when the backend provides this endpoint
    throw new Error('User trade analytics not yet implemented');
  }
}

// Export singleton instance
export const tradesService = TradesService.getInstance();