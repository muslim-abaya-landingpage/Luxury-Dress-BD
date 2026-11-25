<?php

namespace Tests\Unit;

use App\Contracts\OrderSnapshotSource;
use App\Repositories\FixtureOrderSnapshotSource;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class OrderSnapshotSourceTest extends TestCase
{
    public function test_fixture_implements_the_read_only_snapshot_contract(): void
    {
        $source = new FixtureOrderSnapshotSource();
        self::assertInstanceOf(OrderSnapshotSource::class, $source);
        self::assertCount(3, $source->readOrderSnapshots());
    }

    public function test_snapshot_has_only_canonical_lifecycle_fields(): void
    {
        $rows = (new FixtureOrderSnapshotSource())->readOrderSnapshots();
        self::assertSame(
            ['order_id', 'status', 'stock_stage', 'source_updated_at'],
            array_keys($rows[0])
        );
        self::assertSame('MA-DEMO-ORDER-001', $rows[0]['order_id']);
        self::assertSame('RESERVED', $rows[0]['stock_stage']);
    }

    public function test_limit_is_applied_and_capped(): void
    {
        $source = new FixtureOrderSnapshotSource();
        self::assertCount(1, $source->readOrderSnapshots(1));
        self::assertCount(3, $source->readOrderSnapshots(5000));
    }

    public function test_invalid_limits_are_rejected(): void
    {
        $source = new FixtureOrderSnapshotSource();
        foreach ([0, -1, 5001] as $limit) {
            try {
                $source->readOrderSnapshots($limit);
                self::fail('Expected invalid limit to throw.');
            } catch (InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_reads_are_repeatable_and_do_not_mutate_fixture_data(): void
    {
        $source = new FixtureOrderSnapshotSource();
        $first = $source->readOrderSnapshots();
        $second = $source->readOrderSnapshots();
        self::assertSame($first, $second);
    }
}
