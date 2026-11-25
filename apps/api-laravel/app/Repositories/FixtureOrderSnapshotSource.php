<?php

namespace App\Repositories;

use App\Contracts\OrderSnapshotSource;
use App\Support\OrderSnapshotPage;
use InvalidArgumentException;

/**
 * Synthetic order snapshot source. No external service or production data.
 * Its unsigned cursor is test-only and must never be reused by a production adapter.
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

    public function readOrderSnapshotPage(?string $cursor = null, int $limit = 500): OrderSnapshotPage
    {
        if ($limit < 1 || $limit > 5000) {
            throw new InvalidArgumentException('Snapshot page limit must be between 1 and 5000.');
        }

        $offset = $cursor === null ? 0 : $this->decodeCursor($cursor);
        if ($offset > count(self::ROWS)) {
            throw new InvalidArgumentException('Snapshot cursor is outside the available fixture range.');
        }

        $rows = array_slice(self::ROWS, $offset, $limit);
        $nextOffset = $offset + count($rows);
        $nextCursor = $nextOffset < count(self::ROWS) ? $this->encodeCursor($nextOffset) : null;

        return new OrderSnapshotPage($rows, $nextCursor);
    }

    private function encodeCursor(int $offset): string
    {
        return rtrim(strtr(base64_encode(json_encode([
            'source' => 'fixture-order-snapshot-v1',
            'offset' => $offset,
        ], JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    }

    private function decodeCursor(string $cursor): int
    {
        if ($cursor === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $cursor)) {
            throw new InvalidArgumentException('Invalid snapshot cursor.');
        }

        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        if ($decoded === false) {
            throw new InvalidArgumentException('Invalid snapshot cursor.');
        }

        try {
            $payload = json_decode($decoded, true, 8, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new InvalidArgumentException('Invalid snapshot cursor.');
        }

        if (
            !is_array($payload)
            || ($payload['source'] ?? null) !== 'fixture-order-snapshot-v1'
            || !isset($payload['offset'])
            || !is_int($payload['offset'])
            || $payload['offset'] < 0
        ) {
            throw new InvalidArgumentException('Invalid snapshot cursor.');
        }

        return $payload['offset'];
    }
}
