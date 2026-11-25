<?php

namespace Tests\Unit;

use App\Support\OrderStockReconciliation;
use PHPUnit\Framework\TestCase;

class OrderStockReconciliationTest extends TestCase
{
    public function test_clean_snapshot_is_in_sync(): void
    {
        $report = OrderStockReconciliation::analyze(
            [['order_id' => 'MA-1', 'status' => 'Confirmed', 'stock_stage' => 'RESERVED']],
            [['operation_id' => 'op-1', 'order_id' => 'MA-1', 'action' => 'reserve', 'state' => 'applied', 'resulting_stage' => 'RESERVED']],
            [['operation_id' => 'op-1']]
        );
        self::assertSame('in_sync', $report['status']);
        self::assertSame([], $report['issues']);
    }

    public function test_reserved_stock_without_order_row_is_flagged(): void
    {
        $report = OrderStockReconciliation::analyze(
            [],
            [['operation_id' => 'op-1', 'order_id' => 'MA-orphan', 'action' => 'reserve', 'state' => 'applied', 'resulting_stage' => 'RESERVED']],
            [['operation_id' => 'op-1']]
        );
        self::assertContains(['type' => 'orphaned_reservation', 'reference' => 'op-1'], $report['issues']);
    }

    public function test_applied_stock_operation_without_ledger_is_flagged(): void
    {
        $report = OrderStockReconciliation::analyze(
            [['order_id' => 'MA-1', 'status' => 'Confirmed', 'stock_stage' => 'RESERVED']],
            [['operation_id' => 'op-1', 'order_id' => 'MA-1', 'action' => 'reserve', 'state' => 'applied', 'resulting_stage' => 'RESERVED']],
            []
        );
        self::assertContains(['type' => 'missing_ledger_entry', 'reference' => 'op-1'], $report['issues']);
    }

    public function test_order_stock_stage_mismatch_is_flagged(): void
    {
        $report = OrderStockReconciliation::analyze(
            [['order_id' => 'MA-1', 'status' => 'Confirmed', 'stock_stage' => 'RESERVED']],
            [['operation_id' => 'op-1', 'order_id' => 'MA-1', 'action' => 'release', 'state' => 'applied', 'resulting_stage' => 'RELEASED']],
            [['operation_id' => 'op-1']]
        );
        self::assertContains(['type' => 'stale_order_stock_stage', 'reference' => 'MA-1'], $report['issues']);
    }

    public function test_partial_compensation_states_are_never_treated_as_success(): void
    {
        foreach (['pending', 'failed', 'compensation_failed'] as $state) {
            $report = OrderStockReconciliation::analyze(
                [['order_id' => 'MA-1', 'status' => 'Pending', 'stock_stage' => 'RESERVED']],
                [['operation_id' => 'op-' . $state, 'order_id' => 'MA-1', 'action' => 'reserve', 'state' => $state, 'resulting_stage' => 'RESERVED']],
                []
            );
            self::assertSame('review_required', $report['status']);
            self::assertContains(
                ['type' => 'partial_compensation', 'reference' => 'op-' . $state],
                $report['issues']
            );
        }
    }

    public function test_duplicate_operation_ids_are_reported(): void
    {
        $op = ['operation_id' => 'op-1', 'order_id' => 'MA-1', 'action' => 'reserve', 'state' => 'applied', 'resulting_stage' => 'RESERVED'];
        $report = OrderStockReconciliation::analyze(
            [['order_id' => 'MA-1', 'status' => 'Confirmed', 'stock_stage' => 'RESERVED']],
            [$op, $op],
            [['operation_id' => 'op-1']]
        );
        self::assertContains(['type' => 'duplicate_operation_id', 'reference' => 'op-1'], $report['issues']);
    }

    public function test_legacy_and_new_orders_do_not_get_false_missing_operation_alerts(): void
    {
        $report = OrderStockReconciliation::analyze([
            ['order_id' => 'MA-legacy', 'status' => 'Pending', 'stock_stage' => 'LEGACY_SKIPPED'],
            ['order_id' => 'MA-new', 'status' => 'Pending', 'stock_stage' => 'NEW'],
        ], [], []);
        self::assertSame('in_sync', $report['status']);
    }

    public function test_missing_order_identity_is_flagged_without_mutation(): void
    {
        $report = OrderStockReconciliation::analyze(
            [['status' => 'Pending', 'stock_stage' => 'NEW']],
            [],
            []
        );
        self::assertContains(['type' => 'invalid_order_identity', 'reference' => 'unknown'], $report['issues']);
    }

    public function test_analyzer_is_read_only_and_reports_multiple_issue_categories(): void
    {
        $orders = [['order_id' => 'MA-1', 'status' => 'Confirmed', 'stock_stage' => 'RESERVED']];
        $operations = [['operation_id' => 'op-1', 'order_id' => 'MA-1', 'action' => 'reserve', 'state' => 'applied', 'resulting_stage' => 'RESERVED']];
        $before = [$orders, $operations];
        $report = OrderStockReconciliation::analyze($orders, $operations, []);
        self::assertSame($before, [$orders, $operations]);
        self::assertSame('review_required', $report['status']);
        self::assertSame(1, $report['counts']['missing_ledger_entry']);
    }
}
