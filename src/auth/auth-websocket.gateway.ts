import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface SubscribePayload {
  loginId: string;
}

interface LoginConfirmedPayload {
  loginId: string;
  accessToken: string;
  user: {
    id: string;
    telegramId: number;
    telegramUsername?: string;
    role: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*', // Configure properly in production
  },
  namespace: '/auth',
})
export class AuthWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuthWebSocketGateway.name);

  // Map loginId -> Set of socket IDs waiting for it
  private readonly loginSubscribers = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Cleanup subscriptions
    for (const [loginId, subscribers] of this.loginSubscribers.entries()) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.loginSubscribers.delete(loginId);
      }
    }
  }

  /**
   * Client subscribes to a specific login session
   * Usage: socket.emit('subscribe_login', { loginId: '...' })
   */
  @SubscribeMessage('subscribe_login')
  handleSubscribeLogin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ) {
    const { loginId } = payload;

    if (!loginId) {
      client.emit('error', { message: 'loginId is required' });
      return;
    }

    // Add client to subscribers
    if (!this.loginSubscribers.has(loginId)) {
      this.loginSubscribers.set(loginId, new Set());
    }
    this.loginSubscribers.get(loginId)!.add(client.id);

    this.logger.log(`Client ${client.id} subscribed to login ${loginId}`);

    client.emit('subscribed', { loginId });
  }

  /**
   * Server-side method to notify clients when login is confirmed
   * Called by AuthService after successful Telegram confirmation
   */
  notifyLoginConfirmed(payload: LoginConfirmedPayload) {
    const { loginId } = payload;
    const subscribers = this.loginSubscribers.get(loginId);

    if (!subscribers || subscribers.size === 0) {
      this.logger.warn(`No subscribers for login ${loginId}`);
      return;
    }

    this.logger.log(
      `Notifying ${subscribers.size} clients about login ${loginId}`,
    );

    // Emit to all subscribed clients
    for (const socketId of subscribers) {
      this.server.to(socketId).emit('login_confirmed', {
        accessToken: payload.accessToken,
        user: payload.user,
      });
    }

    // Cleanup
    this.loginSubscribers.delete(loginId);
  }

  /**
   * Notify clients when login expires
   */
  notifyLoginExpired(loginId: string) {
    const subscribers = this.loginSubscribers.get(loginId);

    if (subscribers && subscribers.size > 0) {
      for (const socketId of subscribers) {
        this.server.to(socketId).emit('login_expired', { loginId });
      }
      this.loginSubscribers.delete(loginId);
    }
  }
}
