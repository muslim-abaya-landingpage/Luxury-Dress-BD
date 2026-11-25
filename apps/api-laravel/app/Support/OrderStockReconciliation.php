<?php

namespace App\Support;

/**
 * Read-only reconciliation analyzer for synthetic order/stock snapshots.
 * It never connects to Sheets, Apps Script, D1, or a stock provider.
 */
final class OrderStockReconciliation
{
    /**
     * @param list<array<string, mixed>> $orders
     * @param list<array<string, mixed>> $stockOperations
     * @param list<array<string, mixed>> $ledgerEntries
     * @return array{status: string, counts: array<string, int>, issues: list<array<string, string>>}
     */
    public static function analyze(array $orders, array $stockOperations, array $ledgerEntries): array
    {
        $issues = [];
        $orderById = [];
        foreach ($orders as $order) {
            $id = trim((string) ($order['order_id'] ?? ''));
            if ($id === '') {
                $issues[] = ['type' => 'invalid_order_identity', 'reference' => 'unknown'];
                continue;
            }
            if (isset($orderById[$id])) {
                $issues[] = ['type' => 'duplicate_order_id', 'reference' => $id];
                continue;
            }
            $orderById[$id] = [
                'stage' => strtoupper(trim((string) ($order['stock_stage'] ?? ''))),
                'status' => trim((string) ($order['status'] ?? '')),
            ];
        }

        $ledgerByOperation = [];
        foreach ($ledgerEntries as $entry) {
            $operationId = trim((string) ($entry['operation_id'] ?? ''));
            if ($operationId !== '') {
                $ledgerByOperation[$operationId] = true;
            }
        }

        $seenOperationIds = [];
        $latestAppliedByOrder = [];
        foreach ($stockOperations as $operation) {
            $operationId = trim((string) ($operation['operation_id'] ?? ''));
            $orderId = trim((string) ($operation['order_id'] ?? ''));
            $action = trim((string) ($operation['action'] ?? ''));
            $state = strtolower(trim((string) ($operation['state'] ?? '')));
            $resultingStage = strtoupper(trim((string) ($operation['resulting_stage'] ?? '')));

            if ($operationId === '' || $orderId === '' || $action === '') {
                $issues[] = ['type' => 'invalid_operation_identity', 'reference' => $operationId ?: 'unknown'];
                continue;
            }
            if (isset($seenOperationIds[$operationId])) {
                $issues[] = ['type' => 'duplicate_operation_id', 'reference' => $operationId];
                continue;
            }
            $seenOperationIds[$operationId] = true;

            if (in_array($state, ['pending', 'failed', 'compensation_failed'], true)) {
                $issues[] = ['type' => 'partial_compensation', 'reference' => $operationId];
                continue;
            }
            if ($state !== 'applied') {
                $issues[] = ['type' => 'unknown_operation_state', 'reference' => $operationId];
                continue;
            }

            if (!isset($ledgerByOperation[$operationId])) {
                $issues[] = ['type' => 'missing_ledger_entry', 'reference' => $operationId];
            }

            if ($action === 'reserve' && !isset($orderById[$orderId])) {
                $issues[] = ['type' => 'orphaned_reservation', 'reference' => $operationId];
            }

            $latestAppliedByOrder[$orderId] = [
                'operation_id' => $operationId,
                'stage' => $resultingStage,
            ];
        }

        foreach ($orderById as $orderId => $order) {
            $stage = $order['stage'];
            if ($stage === '' || $stage === 'LEGACY_SKIPPED' || $stage === 'NEW') {
                continue;
            }
            if (!isset($latestAppliedByOrder[$orderId])) {
                $issues[] = ['type' => 'missing_stock_operation', 'reference' => $orderId];
                continue;
            }
            $latestStage = $latestAppliedByOrder[$orderId]['stage'];
            if ($latestStage !== '' && $latestStage !== $stage) {
                $issues[] = ['type' => 'stale_order_stock_stage', 'reference' => $orderId];
            }
        }

        $counts = [];
        foreach ($issues as $issue) {
            $counts[$issue['type']] = ($counts[$issue['type']] ?? 0) + 1;
        }
        ksort($counts);

        return [
            'status' => $issues === [] ? 'in_sync' : 'review_required',
            'counts' => $counts,
            'issues' => $issues,
        ];
    }
}
