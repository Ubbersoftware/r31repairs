'use client'
import { useState } from 'react'
import Link from 'next/link'
import { StatusPill } from '@/components/orders/StatusPill'
import { ORDER_STATUSES, statusMeta, type Order, type OrderStatus } from '@/lib/types/order'
import styles from './OrderQueue.module.css'

function ageDays(createdAt: number): number {
  return Math.floor((Date.now() - createdAt) / 86_400_000)
}

function orderSummary(order: Order): string {
  const device = order.devices?.[0]?.modelName ?? ''
  const service = order.items?.[0]?.serviceName ?? ''
  if (device && service) return `${device} · ${service}`
  return device || service
}

export function OrderQueue({ orders }: { orders: Order[] }) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (query) {
      return (
        o.orderNumber.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query)
      )
    }
    return true
  })

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          <button
            className={`${styles.chip} ${statusFilter === 'all' ? styles.chipActive : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              className={`${styles.chip} ${statusFilter === s ? styles.chipActive : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {statusMeta[s].label}
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          type="search"
          placeholder="Order # or name…"
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No orders match this filter.</p>
      ) : (
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Summary</th>
              <th>Status</th>
              <th>Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className={styles.tableRow}>
                <td>
                  <span className={styles.orderNum}>{order.orderNumber}</span>
                </td>
                <td>
                  <span className={styles.customerName}>{order.customerName}</span>
                </td>
                <td>
                  <span className={styles.summary}>{orderSummary(order)}</span>
                </td>
                <td>
                  <StatusPill status={order.status} />
                </td>
                <td>
                  <span className={styles.age}>{ageDays(order.createdAt)}d</span>
                </td>
                <td>
                  <Link href={`/admin/orders/${order.id}`} className={styles.viewLink}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
