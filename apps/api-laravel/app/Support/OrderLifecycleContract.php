<?php

namespace App\Support;

final class OrderLifecycleContract
{
    /** @var list<string> */
    public const STATUSES = [
        'Pending', 'Confirmed', 'Processing', 'Shipped',
        'Delivered', 'Cancelled', 'Fake',
    ];

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

    public static function checkoutIdempotencyKey(?string $eventId, ?string $phone): ?string
    {
        $event = trim((string) $eventId);
        $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';
        if (str_starts_with($digits, '88') && strlen($digits) === 13) {
            $digits = substr($digits, 2);
        }
        if ($event === '' || preg_match('/^[A-Za-z0-9_-]{8,120}$/', $event) !== 1
            || preg_match('/^01[0-9]{9}$/', $digits) !== 1) {
            return null;
        }
        return hash('sha256', $event . '|' . $digits);
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
