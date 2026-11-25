<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Immutable page returned by a read-only order snapshot source.
 */
final readonly class OrderSnapshotPage
{
    /**
     * @param list<array{order_id: string, status: string, stock_stage: string|null, source_updated_at: string|null}> $rows
     */
    public function __construct(
        public array $rows,
        public ?string $nextCursor,
    ) {
        foreach ($rows as $row) {
            if (
                !is_array($row)
                || array_keys($row) !== ['order_id', 'status', 'stock_stage', 'source_updated_at']
                || !is_string($row['order_id'])
                || $row['order_id'] === ''
                || !is_string($row['status'])
                || $row['status'] === ''
                || (!is_string($row['stock_stage']) && $row['stock_stage'] !== null)
                || (!is_string($row['source_updated_at']) && $row['source_updated_at'] !== null)
            ) {
                throw new InvalidArgumentException('Invalid canonical order snapshot row.');
            }
        }

        if ($nextCursor !== null && $nextCursor === '') {
            throw new InvalidArgumentException('Continuation cursor cannot be blank.');
        }
    }
}
