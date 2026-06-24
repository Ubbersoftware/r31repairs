// src/lib/types/notification.ts
export type NotificationType = 'status_change' | 'price_update'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  link: string
  read: boolean
  createdAt: number
}
