<?php

namespace Tests\Unit;

use App\Support\OrderLifecycleContract;
use PHPUnit\Framework\TestCase;

class OrderLifecycleContractTest extends TestCase
{
    public function test_production_status_vocabulary_is_preserved(): void
    {
        self::assertSame([
            'Pending', 'Confirmed', 'Processing', 'Shipped',
            'Delivered', 'Cancelled', 'Fake',
        ], OrderLifecycleContract::STATUSES);
    }

    public function test_status_normalization_is_case_insensitive_but_rejects_unknown_values(): void
    {
        self::assertSame('Processing', OrderLifecycleContract::normalizeStatus(' processing '));
        self::assertNull(OrderLifecycleContract::normalizeStatus('Returned'));
        self::assertNull(OrderLifecycleContract::normalizeStatus(''));
    }

    public function test_same_status_is_idempotent_and_processing_does_not_change_stock(): void
    {
        self::assertSame(
            ['status' => 'unchanged', 'from' => 'Pending', 'to' => 'Pending'],
            OrderLifecycleContract::statusChangePlan('Pending', 'pending')
        );
        self::assertSame(
            ['status' => 'no_stock_change', 'from' => 'Confirmed', 'to' => 'Processing'],
            OrderLifecycleContract::statusChangePlan('Confirmed', 'Processing')
        );
    }

    public function test_other_stock_lifecycle_changes_require_the_existing_adapter(): void
    {
        self::assertSame(
            ['status' => 'adapter_required', 'from' => 'Pending', 'to' => 'Cancelled'],
            OrderLifecycleContract::statusChangePlan('Pending', 'Cancelled')
        );
    }

    public function test_checkout_retry_key_uses_event_id_and_normalized_phone(): void
    {
        $a = OrderLifecycleContract::checkoutIdempotencyKey('order_12345678_abcd', '01712345678');
        $b = OrderLifecycleContract::checkoutIdempotencyKey('order_12345678_abcd', '+8801712345678');
        self::assertNotNull($a);
        self::assertSame($a, $b);
    }

    public function test_checkout_retry_key_rejects_missing_or_invalid_identity(): void
    {
        self::assertNull(OrderLifecycleContract::checkoutIdempotencyKey('', '01712345678'));
        self::assertNull(OrderLifecycleContract::checkoutIdempotencyKey('order_12345678', '018'));
        self::assertNull(OrderLifecycleContract::checkoutIdempotencyKey('bad event id', '01712345678'));
    }
}
