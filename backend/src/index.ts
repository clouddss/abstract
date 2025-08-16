import { appConfig } from './config';
import { prisma } from './database/client';
import app from './api';
import { wsManager } from './websocket/server';

async function startServer() {
  try {
    console.log('🚀 Starting Abstract Pump Backend...');

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Start HTTP server
    const server = app.listen(appConfig.PORT, () => {
      console.log(`🌐 Server running on port ${appConfig.PORT}`);
      console.log(`📍 Environment: ${appConfig.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${appConfig.PORT}/health`);
      console.log(`📚 API docs: http://localhost:${appConfig.PORT}/api`);
      console.log(`🔌 WebSocket server: ws://localhost:${appConfig.PORT}/ws`);
    });

    // Initialize WebSocket server
    wsManager.initialize(server);
    console.log('✅ WebSocket server initialized');

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server closed');
        
        try {
          await prisma.$disconnect();
          console.log('🗄️  Database disconnected');
          
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();