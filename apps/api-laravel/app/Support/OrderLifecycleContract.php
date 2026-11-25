<?php

namespace App\Support;

final class OrderLifecycleContract
{
    /** @var list<string> */
    public const STATUSES = [
        'Pending', 'Confirmed', 'Processing', 'Shipped',
        'Delivered', 'Cancelled', 'Fake',
    ];

    /** @var list<string> */
    public const STOCK_STAGES = ['NEW', 'RESERVED', 'SOLD', 'RELEASED'];

    public static function normalizeStatus(?string $status): ?string
    {
        $candidate = trim((string) $status);
        foreach (self::STATUSES as $known) {
            if (strcasecmp($candidate, $known) === 0) {
                return $known;
            }
        }
        return null;
    }

    /**
     * Mirrors Apps Script orderIdempotencyKey_ and normalizePhone_.
     * This is a deterministic fingerprint only, not a persistent idempotency store.
     */
    public static function checkoutIdempotencyKey(?string $eventId, ?string $phone): ?string
    {
        $event = trim((string) $eventId);
        if (preg_match('/^[A-Za-z0-9_.:-]{6,100}$/', $event) !== 1) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';
        if (str_starts_with($digits, '880') && strlen($digits) >= 12) {
            $digits = '0' . substr($digits, 3);
        }
        if (strlen($digits) === 10 && str_starts_with($digits, '1')) {
            $digits = '0' . $digits;
        }

        return hash('sha256', $event . '|' . $digits);
    }

    /**
     * Pure mirror of the existing Apps Script StockStage decision table.
     * No stock mutation is performed here.
     *
     * @return array{status: string, stage_before?: string, stage_after?: string, action?: string}
     */
    public static function stockStagePlan(?string $status, ?string $stage): array
    {
        $normalizedStatus = trim((string) $status);
        $rawStage = strtoupper(trim((string) $stage));
        $legacy = $rawStage === '' || $rawStage === 'LEGACY_SKIPPED';
        $current = $legacy ? 'LEGACY_UNKNOWN' : $rawStage;

        if (!$legacy && !in_array($current, self::STOCK_STAGES, true)) {
            return ['status' => 'manual_review', 'stage_before' => $current, 'action' => 'unknown_stage'];
        }

        $lower = strtolower($normalizedStatus);
        $target = null;
        if (str_contains($lower, 'return') || str_contains($lower, 'refund')
            || str_contains($lower, 'ফেরত') || str_contains($lower, 'cancel')
            || str_contains($lower, 'বাতিল') || $lower === 'fake') {
            $target = 'RELEASED';
        } elseif ($normalizedStatus === 'Confirmed') {
            $target = 'RESERVED';
        } elseif ($normalizedStatus === 'Delivered') {
            $target = 'SOLD';
        } elseif ($normalizedStatus === 'Pending' && $current === 'RESERVED') {
            $target = 'RELEASED';
        }

        if ($target === null) {
            return ['status' => 'no_transition', 'stage_before' => $current];
        }

        if ($legacy) {
            return [
                'status' => 'legacy_skipped',
                'stage_before' => 'LEGACY_UNKNOWN',
                'stage_after' => 'LEGACY_SKIPPED',
                'action' => 'no_stock_mutation',
            ];
        }

        if ($current === $target) {
            return ['status' => 'unchanged', 'stage_before' => $current, 'stage_after' => $current, 'action' => 'none'];
        }

        if ($target === 'RESERVED') {
            if ($current === 'SOLD') {
                // Existing Apps Script logs REVIEW_NEEDED but still writes RESERVED.
                return ['status' => 'manual_review', 'stage_before' => $current, 'stage_after' => 'RESERVED', 'action' => 'review_needed_no_reserve'];
            }
            return ['status' => 'transition', 'stage_before' => $current, 'stage_after' => 'RESERVED', 'action' => 'reserve'];
        }

        if ($target === 'RELEASED') {
            if ($current === 'RESERVED') {
                return ['status' => 'transition', 'stage_before' => $current, 'stage_after' => 'RELEASED', 'action' => 'release'];
            }
            if ($current === 'SOLD') {
                return ['status' => 'manual_review', 'stage_before' => $current, 'stage_after' => 'RELEASED', 'action' => 'return_review_no_auto_restock'];
            }
            return ['status' => 'transition', 'stage_before' => $current, 'stage_after' => 'RELEASED', 'action' => 'stage_only'];
        }

        if ($target === 'SOLD') {
            if ($current === 'RESERVED') {
                return ['status' => 'transition', 'stage_before' => $current, 'stage_after' => 'SOLD', 'action' => 'finalize_reserved_sale'];
            }
            if ($current === 'NEW') {
                return ['status' => 'transition', 'stage_before' => $current, 'stage_after' => 'SOLD', 'action' => 'sell_direct'];
            }
            if ($current === 'RELEASED') {
                return ['status' => 'manual_review', 'stage_before' => $current, 'stage_after' => 'SOLD', 'action' => 'review_then_sell_direct'];
            }
        }

        return ['status' => 'manual_review', 'stage_before' => $current, 'action' => 'unmapped_transition'];
    }

    /**
     * @return array{status: 'invalid'|'unchanged'|'no_stock_change'|'adapter_required', from?: string, to?: string}
     */
    public static function statusChangePlan(?string $from, ?string $to): array
    {
        $previous = self::normalizeStatus($from);
        $next = self::normalizeStatus($to);
        if ($previous === null || $next === null) {
            return ['status' => 'invalid'];
        }
        if ($previous === $next) {
            return ['status' => 'unchanged', 'from' => $previous, 'to' => $next];
        }
        if ($next === 'Processing') {
            return ['status' => 'no_stock_change', 'from' => $previous, 'to' => $next];
        }
        return ['status' => 'adapter_required', 'from' => $previous, 'to' => $next];
    }
}
