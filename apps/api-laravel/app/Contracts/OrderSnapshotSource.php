<?php

namespace App\Contracts;

/**
 * Read-only boundary for importing order lifecycle snapshots.
 *
 * Implementations must not expose customer PII unless a separately approved
 * use case requires it. No write methods belong on this interface.
 */
interface OrderSnapshotSource
{
    /**
     * Return a bounded, canonical snapshot of order lifecycle fields.
     *
     * @return list<array{
     *   order_id: string,
     *   status: string,
     *   stock_stage: string|null,
     *   source_updated_at: string|null
     * }>
     */
    public function readOrderSnapshots(int $limit = 500): array;
}
