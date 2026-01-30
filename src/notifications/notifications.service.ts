// src/notifications/notifications.service.ts
// YANGILANGAN VERSIYA - to'g'ri response format

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Create notification for user
   */
  async create(userId: string, type: string, message: string, link?: string) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO notifications (user_id, type, message, link)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [userId, type, message, link ?? null],
    );
    return rows[0];
  }

  /**
   * List notifications for user
   * Returns { notifications: [...] } format as frontend expects
   */
  async list(userId: string): Promise<{ notifications: Notification[] }> {
    const { rows } = await this.pool.query(
      `
      SELECT 
        id,
        type,
        message,
        is_read as read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [userId],
    );

    const notifications: Notification[] = rows.map((row) => ({
      id: row.id,
      type: this.mapTypeToSeverity(row.type),
      title: this.getTitle(row.type),
      message: row.message,
      read: row.read,
      createdAt: row.created_at,
    }));

    return { notifications };
  }

  /**
   * Mark notification as read
   * Returns { success: true } as frontend expects
   */
  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const { rowCount } = await this.pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND user_id = $2
      `,
      [notificationId, userId],
    );

    if (rowCount === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { success: true };
  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(userId: string): Promise<{ success: boolean }> {
    await this.pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1 AND is_read = FALSE
      `,
      [userId],
    );

    return { success: true };
  }

  /**
   * Map notification type to severity for frontend
   */
  private mapTypeToSeverity(type: string): 'info' | 'success' | 'warning' | 'error' {
    const typeMap: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
      FILTER_MATCH: 'info',
      SIGNAL_TP: 'success',
      SIGNAL_SL: 'error',
      SIGNAL_ENTERED: 'info',
      PURCHASE: 'success',
      TOPUP: 'success',
      WELCOME: 'success',
    };
    return typeMap[type] || 'info';
  }

  /**
   * Get title based on notification type
   */
  private getTitle(type: string): string {
    const titleMap: Record<string, string> = {
      FILTER_MATCH: 'New Signal Match',
      SIGNAL_TP: 'Take Profit Hit',
      SIGNAL_SL: 'Stop Loss Hit',
      SIGNAL_ENTERED: 'Signal Entered',
      PURCHASE: 'Purchase Successful',
      TOPUP: 'Wallet Top-up',
      WELCOME: 'Welcome to ScoreX',
    };
    return titleMap[type] || 'Notification';
  }
}
