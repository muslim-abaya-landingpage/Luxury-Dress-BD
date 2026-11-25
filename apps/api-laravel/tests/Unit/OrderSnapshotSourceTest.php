<?php

namespace Tests\Unit;

use App\Contracts\OrderSnapshotSource;
use App\Support\OrderSnapshotPage;
use App\Repositories\FixtureOrderSnapshotSource;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class OrderSnapshotSourceTest extends TestCase
{
    public function test_fixture_implements_the_read_only_snapshot_contract(): void
    {
        $source = new FixtureOrderSnapshotSource();
        self::assertInstanceOf(OrderSnapshotSource::class, $source);
        self::assertInstanceOf(OrderSnapshotPage::class, $source->readOrderSnapshotPage());
        self::assertCount(3, $source->readOrderSnapshotPage()->rows);
    }

    public function test_snapshot_page_has_only_canonical_lifecycle_fields(): void
    {
        $rows = (new FixtureOrderSnapshotSource())->readOrderSnapshotPage()->rows;
        self::assertSame(
            ['order_id', 'status', 'stock_stage', 'source_updated_at'],
            array_keys($rows[0])
        );
        self::assertSame('MA-DEMO-ORDER-001', $rows[0]['order_id']);
        self::assertSame('RESERVED', $rows[0]['stock_stage']);
    }

    public function test_pages_are_bounded_and_cursor_returns_the_next_page(): void
    {
        $source = new FixtureOrderSnapshotSource();
        $first = $source->readOrderSnapshotPage(null, 2);

        self::assertCount(2, $first->rows);
        self::assertNotNull($first->nextCursor);

        $second = $source->readOrderSnapshotPage($first->nextCursor, 2);
        self::assertCount(1, $second->rows);
        self::assertNull($second->nextCursor);
        self::assertSame('MA-DEMO-ORDER-003', $second->rows[0]['order_id']);
    }

    public function test_invalid_limits_and_cursors_are_rejected(): void
    {
        $source = new FixtureOrderSnapshotSource();
        foreach ([0, -1, 5001] as $limit) {
            try {
                $source->readOrderSnapshotPage(null, $limit);
                self::fail('Expected invalid limit to throw.');
            } catch (InvalidArgumentException) {
                self::assertTrue(true);
            }
        }

        foreach (['', 'not-a-cursor', 'eyJzb3VyY2UiOiJvdGhlciIsIm9mZnNldCI6MX0'] as $cursor) {
            try {
                $source->readOrderSnapshotPage($cursor, 2);
                self::fail('Expected invalid cursor to throw.');
            } catch (InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_reads_are_repeatable_and_do_not_mutate_fixture_data(): void
    {
        $source = new FixtureOrderSnapshotSource();
        self::assertSame(
            $source->readOrderSnapshotPage(),
            $source->readOrderSnapshotPage()
        );
    }
}
