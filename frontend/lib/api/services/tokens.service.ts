import { apiClient } from '../client';
import {
  CreateTokenRequest,
  CreateTokenResponse,
  GetTokensParams,
  GetTokensResponse,
  TokenDetails,
  GetTokenChartParams,
  TokenChartResponse,
  GetTokenTradesParams,
  TokenTradesResponse,
} from '../types/token.types';
import { Address } from '../types/common.types';

export class TokensService {
  private static instance: TokensService;
  
  private constructor() {}

  public static getInstance(): TokensService {
    if (!TokensService.instance) {
      TokensService.instance = new TokensService();
    }
    return TokensService.instance;
  }

  /**
   * Create a new token
   * This initiates the token creation process
   */
  async createToken(data: CreateTokenRequest): Promise<CreateTokenResponse> {
    return apiClient.post<CreateTokenResponse>('/tokens/create', data);
  }

  /**
   * Launch a new token - returns transaction data for wallet signing
   */
  async launchToken(data: CreateTokenRequest): Promise<{
    to: string;
    data: string;
    value: string;
    launchFee: string;
    message: string;
  }> {
    return apiClient.post('/tokens/launch', data);
  }

  /**
   * Confirm token launch after transaction is mined
   */
  async confirmTokenLaunch(data: {
    txHash: string;
    name: string;
    symbol: string;
    description?: string;
    imageUrl?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
  }): Promise<{
    token: any;
    message: string;
  }> {
    return apiClient.post('/tokens/launch/confirm', data);
  }

  /**
   * Get current launch fee
   */
  async getLaunchFee(): Promise<{
    fee: string;
    feeFormatted: string;
    currency: string;
  }> {
    return apiClient.get('/tokens/launch/fee');
  }

  /**
   * Get all tokens with filtering, sorting, and pagination
   */
  async getTokens(params?: GetTokensParams): Promise<GetTokensResponse> {
    return apiClient.get<GetTokensResponse>('/tokens', { params });
  }

  /**
   * Get detailed information about a specific token
   */
  async getTokenDetails(address: Address): Promise<TokenDetails> {
    return apiClient.get<TokenDetails>(`/tokens/${address}`);
  }

  /**
   * Get price chart data for a token
   */
  async getTokenChart(address: Address, params?: GetTokenChartParams): Promise<TokenChartResponse> {
    return apiClient.get<TokenChartResponse>(`/tokens/${address}/chart`, { params });
  }

  /**
   * Get trade history for a token
   */
  async getTokenTrades(address: Address, params?: GetTokenTradesParams): Promise<TokenTradesResponse> {
    return apiClient.get<TokenTradesResponse>(`/tokens/${address}/trades`, { params });
  }

  /**
   * Search tokens by name, symbol, or description
   */
  async searchTokens(query: string, limit: number = 10): Promise<GetTokensResponse> {
    return this.getTokens({ search: query, limit });
  }

  /**
   * Get tokens created by a specific address
   */
  async getTokensByCreator(creator: Address, params?: Omit<GetTokensParams, 'creator'>): Promise<GetTokensResponse> {
    return this.getTokens({ ...params, creator });
  }

  /**
   * Get migrated tokens
   */
  async getMigratedTokens(params?: Omit<GetTokensParams, 'migrated'>): Promise<GetTokensResponse> {
    return this.getTokens({ ...params, migrated: true });
  }

  /**
   * Get tokens by market cap
   */
  async getTokensByMarketCap(order: 'asc' | 'desc' = 'desc', params?: Omit<GetTokensParams, 'sort' | 'order'>): Promise<GetTokensResponse> {
    return this.getTokens({ ...params, sort: 'marketCap', order });
  }

  /**
   * Get tokens by volume
   */
  async getTokensByVolume(order: 'asc' | 'desc' = 'desc', params?: Omit<GetTokensParams, 'sort' | 'order'>): Promise<GetTokensResponse> {
    return this.getTokens({ ...params, sort: 'volume', order });
  }

  /**
   * Get trending tokens (alias for getTokensByVolume)
   */
  async getTrendingTokens(limit: number = 10): Promise<GetTokensResponse> {
    return this.getTokensByVolume('desc', { limit });
  }

  /**
   * Get recently created tokens
   */
  async getRecentTokens(limit: number = 10): Promise<GetTokensResponse> {
    return this.getTokens({ sort: 'created', order: 'desc', limit });
  }
}

// Export singleton instance
export const tokensService = TokensService.getInstance();