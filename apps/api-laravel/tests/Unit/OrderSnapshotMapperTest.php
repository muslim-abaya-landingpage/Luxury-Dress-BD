<?php

namespace Tests\Unit;

use App\Support\OrderSnapshotMapper;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class OrderSnapshotMapperTest extends TestCase
{
    public function test_maps_columns_by_header_name_not_position(): void
    {
        $mapped = OrderSnapshotMapper::map(
            ['Status', 'Updated At', 'Order ID', 'StockStage'],
            [['Confirmed', '2026-11-25T09:00:00+06:00', 'MA-1001', 'RESERVED']]
        );

        self::assertSame([[
            'order_id' => 'MA-1001',
            'status' => 'Confirmed',
            'stock_stage' => 'RESERVED',
            'source_updated_at' => '2026-11-25T09:00:00+06:00',
        ]], $mapped);
    }

    public function test_normalizes_header_whitespace_and_case(): void
    {
        $mapped = OrderSnapshotMapper::map(
            [' order   id ', 'STATUS', 'StockStage'],
            [['MA-1002', 'Pending', '']]
        );

        self::assertSame('MA-1002', $mapped[0]['order_id']);
        self::assertNull($mapped[0]['stock_stage']);
        self::assertNull($mapped[0]['source_updated_at']);
    }

    public function test_rejects_missing_or_duplicate_required_headers(): void
    {
        try {
            OrderSnapshotMapper::map(['Order ID', 'Status'], []);
            self::fail('Expected missing header to throw.');
        } catch (InvalidArgumentException) {
            self::assertTrue(true);
        }

        try {
            OrderSnapshotMapper::map(['Order ID', ' order id ', 'Status', 'StockStage'], []);
            self::fail('Expected duplicate header to throw.');
        } catch (InvalidArgumentException) {
            self::assertTrue(true);
        }
    }

    public function test_rejects_blank_identity_and_duplicate_order_ids(): void
    {
        foreach ([
            [['', 'Confirmed', 'RESERVED']],
            [['MA-1003', 'Confirmed', 'RESERVED'], ['MA-1003', 'Delivered', 'SOLD']],
        ] as $rows) {
            try {
                OrderSnapshotMapper::map(['Order ID', 'Status', 'StockStage'], $rows);
                self::fail('Expected invalid snapshot to throw.');
            } catch (InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_skips_empty_rows_and_preserves_legacy_blank_stock_stage(): void
    {
        $mapped = OrderSnapshotMapper::map(
            ['Order ID', 'Status', 'StockStage'],
            [['', '', ''], ['MA-1004', 'Pending', '']]
        );

        self::assertCount(1, $mapped);
        self::assertNull($mapped[0]['stock_stage']);
    }

    public function test_rejects_invalid_timestamp(): void
    {
        $this->expectException(InvalidArgumentException::class);
        OrderSnapshotMapper::map(
            ['Order ID', 'Status', 'StockStage', 'Updated At'],
            [['MA-1005', 'Pending', '', 'tomorrow']]
        );
    }

    public function test_does_not_mutate_source_rows(): void
    {
        $rows = [['MA-1006', 'Confirmed', 'RESERVED']];
        $before = $rows;
        OrderSnapshotMapper::map(['Order ID', 'Status', 'StockStage'], $rows);
        self::assertSame($before, $rows);
    }
}
