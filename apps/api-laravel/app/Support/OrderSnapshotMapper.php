<?php

namespace App\Support;

use DateTimeImmutable;
use InvalidArgumentException;
use Throwable;

/**
 * Maps bounded Google Sheets row arrays into a PII-minimized order snapshot.
 * This class performs no network access and never writes to the source.
 */
final class OrderSnapshotMapper
{
    private const MAX_ROWS = 5000;

    /**
     * @param list<string> $headers
     * @param list<list<mixed>> $rows
     * @return list<array{order_id: string, status: string, stock_stage: string|null, source_updated_at: string|null}>
     */
    public static function map(array $headers, array $rows): array
    {
        if (count($rows) > self::MAX_ROWS) {
            throw new InvalidArgumentException('Snapshot exceeds the maximum row limit.');
        }

        $positions = [];
        foreach ($headers as $index => $header) {
            $key = self::normalizeHeader((string) $header);
            if ($key !== '') {
                if (isset($positions[$key])) {
                    throw new InvalidArgumentException('Duplicate source column header.');
                }
                $positions[$key] = $index;
            }
        }

        foreach (['order id', 'status', 'stockstage'] as $required) {
            if (!array_key_exists($required, $positions)) {
                throw new InvalidArgumentException('A required source column is missing.');
            }
        }

        $result = [];
        $seenOrderIds = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                throw new InvalidArgumentException('Invalid source row.');
            }

            $orderId = trim((string) ($row[$positions['order id']] ?? ''));
            $status = trim((string) ($row[$positions['status']] ?? ''));
            $stockStageRaw = trim((string) ($row[$positions['stockstage']] ?? ''));

            if ($orderId === '' && $status === '' && $stockStageRaw === '') {
                continue;
            }
            if ($orderId === '' || $status === '') {
                throw new InvalidArgumentException('Order identity or status is missing.');
            }
            if (isset($seenOrderIds[$orderId])) {
                throw new InvalidArgumentException('Duplicate Order ID in source snapshot.');
            }
            $seenOrderIds[$orderId] = true;

            $updatedAt = null;
            if (isset($positions['updated at'])) {
                $rawTimestamp = trim((string) ($row[$positions['updated at']] ?? ''));
                if ($rawTimestamp !== '') {
                    if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/', $rawTimestamp)) {
                        throw new InvalidArgumentException('Source update timestamp must be ISO-8601.');
                    }
                    try {
                        $updatedAt = (new DateTimeImmutable($rawTimestamp))->format(DATE_ATOM);
                    } catch (Throwable) {
                        throw new InvalidArgumentException('Invalid source update timestamp.');
                    }
                }
            }

            $result[] = [
                'order_id' => $orderId,
                'status' => $status,
                'stock_stage' => $stockStageRaw === '' ? null : $stockStageRaw,
                'source_updated_at' => $updatedAt,
            ];
        }

        return $result;
    }

    private static function normalizeHeader(string $header): string
    {
        return strtolower(trim((string) preg_replace('/\s+/', ' ', $header)));
    }
}
