import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config';
import logger from '../utils/logger';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  wallet?: string;
  subscriptions: Set<string>;
}

export interface WebSocketClient {
  ws: AuthenticatedWebSocket;
  subscriptions: Set<string>;
  userId?: string;
  wallet?: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, WebSocketClient>();
  private subscriptions = new Map<string, Set<WebSocket>>();

  public initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    logger.info('WebSocket server initialized');
  }

  private handleConnection(ws: AuthenticatedWebSocket, request: IncomingMessage) {
    logger.info('New WebSocket connection');
    
    // Initialize client
    ws.subscriptions = new Set();
    const client: WebSocketClient = {
      ws,
      subscriptions: new Set()
    };
    
    this.clients.set(ws, client);

    // Parse URL for auth token
    if (request.url) {
      const url = new URL(request.url, 'http://localhost');
      const token = url.searchParams.get('token');
      
      if (token) {
        this.authenticateClient(client, token);
      }
    }

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(client, data));
    ws.on('close', () => this.handleDisconnect(client));
    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.handleDisconnect(client);
    });

    // Send connection confirmation
    this.sendToClient(client, 'connection', { 
      status: 'connected',
      authenticated: !!client.userId
    });
  }

  private authenticateClient(client: WebSocketClient, token: string) {
    try {
      const decoded = jwt.verify(token, appConfig.JWT_SECRET) as any;
      client.userId = decoded.id;
      client.wallet = decoded.wallet;
      client.ws.userId = decoded.id;
      client.ws.wallet = decoded.wallet;
      
      logger.info(`WebSocket client authenticated: ${client.wallet}`);
    } catch (error) {
      logger.warn('Invalid WebSocket auth token:', error);
    }
  }

  private handleMessage(client: WebSocketClient, data: any) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(client, message.data.event);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(client, message.data.event);
          break;
          
        case 'heartbeat':
          this.sendToClient(client, 'heartbeat', { 
            timestamp: Date.now(),
            serverTime: new Date().toISOString()
          });
          break;
          
        default:
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
    }
  }

  private handleSubscribe(client: WebSocketClient, event: string) {
    // Add to client subscriptions
    client.subscriptions.add(event);
    client.ws.subscriptions.add(event);
    
    // Add to global subscriptions
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    this.subscriptions.get(event)!.add(client.ws);
    
    logger.info(`Client subscribed to: ${event}`);
    
    // Send confirmation
    this.sendToClient(client, 'subscribed', { event });
  }

  private handleUnsubscribe(client: WebSocketClient, event: string) {
    // Remove from client subscriptions
    client.subscriptions.delete(event);
    client.ws.subscriptions.delete(event);
    
    // Remove from global subscriptions
    const eventSubscriptions = this.subscriptions.get(event);
    if (eventSubscriptions) {
      eventSubscriptions.delete(client.ws);
      if (eventSubscriptions.size === 0) {
        this.subscriptions.delete(event);
      }
    }
    
    logger.info(`Client unsubscribed from: ${event}`);
    
    // Send confirmation
    this.sendToClient(client, 'unsubscribed', { event });
  }

  private handleDisconnect(client: WebSocketClient) {
    logger.info('WebSocket client disconnected');
    
    // Remove from all subscriptions
    for (const event of client.subscriptions) {
      const eventSubscriptions = this.subscriptions.get(event);
      if (eventSubscriptions) {
        eventSubscriptions.delete(client.ws);
        if (eventSubscriptions.size === 0) {
          this.subscriptions.delete(event);
        }
      }
    }
    
    // Remove client
    this.clients.delete(client.ws);
  }

  private sendToClient(client: WebSocketClient, type: string, data: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now()
      };
      client.ws.send(JSON.stringify(message));
    }
  }

  // Public methods for broadcasting events

  public broadcastTokenUpdate(tokenAddress: string, tokenData: any) {
    this.broadcast(`token:${tokenAddress}`, 'token:update', {
      address: tokenAddress,
      ...tokenData
    });
  }

  public broadcastNewToken(tokenData: any) {
    this.broadcast('platform:tokens', 'token:new', tokenData);
  }

  public broadcastNewTrade(trade: any) {
    // Broadcast to token-specific subscribers
    this.broadcast(`token:${trade.tokenAddress}`, 'trade:new', trade);
    
    // Broadcast to platform subscribers
    this.broadcast('platform:trades', 'trade:new', trade);
  }

  public broadcastStatsUpdate(stats: any) {
    this.broadcast('platform:stats', 'stats:update', stats);
  }

  public broadcastLeaderboardUpdate(leaderboard: any) {
    this.broadcast('platform:leaderboard', 'leaderboard:update', leaderboard);
  }

  public broadcastRewardClaimed(wallet: string, reward: any) {
    // Send to specific user
    this.broadcastToUser(wallet, 'reward:claimed', {
      wallet,
      ...reward
    });
  }

  public broadcastHolderUpdate(tokenAddress: string, holderData: any) {
    this.broadcast(`token:${tokenAddress}`, 'holder:update', holderData);
  }

  public broadcastPriceUpdate(tokenAddress: string, priceData: any) {
    this.broadcast(`token:${tokenAddress}`, 'price:update', priceData);
  }

  private broadcast(event: string, type: string, data: any) {
    const subscribers = this.subscriptions.get(event);
    if (!subscribers || subscribers.size === 0) return;

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now()
    };

    const messageStr = JSON.stringify(message);
    const deadConnections: WebSocket[] = [];

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          logger.error('Error sending WebSocket message:', error);
          deadConnections.push(ws);
        }
      } else {
        deadConnections.push(ws);
      }
    }

    // Clean up dead connections
    for (const deadWs of deadConnections) {
      subscribers.delete(deadWs);
      this.cleanupDeadConnection(deadWs);
    }

    if (subscribers.size === 0) {
      this.subscriptions.delete(event);
    }
  }

  private broadcastToUser(wallet: string, type: string, data: any) {
    for (const [ws, client] of this.clients) {
      if (client.wallet === wallet && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client, type, data);
      }
    }
  }

  private cleanupDeadConnection(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client) {
      this.handleDisconnect(client);
    }
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      subscriptionDetails: Array.from(this.subscriptions.entries()).map(([event, subscribers]) => ({
        event,
        subscriberCount: subscribers.size
      }))
    };
  }
}

export const wsManager = new WebSocketManager();