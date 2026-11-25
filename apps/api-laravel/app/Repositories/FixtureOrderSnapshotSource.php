<?php

namespace App\Repositories;

use App\Contracts\OrderSnapshotSource;
use InvalidArgumentException;

/**
 * Synthetic order snapshot source. No external service or production data.
 */
final class FixtureOrderSnapshotSource implements OrderSnapshotSource
{
    /** @var list<array{order_id: string, status: string, stock_stage: string|null, source_updated_at: string|null}> */
    private const ROWS = [
        [
            'order_id' => 'MA-DEMO-ORDER-001',
            'status' => 'Confirmed',
            'stock_stage' => 'RESERVED',
            'source_updated_at' => '2026-01-15T10:00:00+06:00',
        ],
        [
            'order_id' => 'MA-DEMO-ORDER-002',
            'status' => 'Delivered',
            'stock_stage' => 'SOLD',
            'source_updated_at' => '2026-01-15T11:00:00+06:00',
        ],
        [
            'order_id' => 'MA-DEMO-ORDER-003',
            'status' => 'Pending',
            'stock_stage' => 'LEGACY_SKIPPED',
            'source_updated_at' => null,
        ],
    ];

    public function readOrderSnapshots(int $limit = 500): array
    {
        if ($limit < 1 || $limit > 5000) {
            throw new InvalidArgumentException('Snapshot limit must be between 1 and 5000.');
        }

        return array_slice(self::ROWS, 0, $limit);
    }
}
