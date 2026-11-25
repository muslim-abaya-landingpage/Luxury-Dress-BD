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

    public function test_checkout_idempotency_key_matches_apps_script_phone_normalization(): void
    {
        $local = OrderLifecycleContract::checkoutIdempotencyKey('evt_12345', '01712345678');
        $international = OrderLifecycleContract::checkoutIdempotencyKey('evt_12345', '+8801712345678');
        self::assertNotNull($local);
        self::assertSame($local, $international);
        self::assertNull(OrderLifecycleContract::checkoutIdempotencyKey('short', '01712345678'));
    }

    public function test_confirmed_reserves_and_processing_or_shipped_preserve_stage(): void
    {
        self::assertSame('reserve', OrderLifecycleContract::stockStagePlan('Confirmed', 'NEW')['action']);
        self::assertSame('no_transition', OrderLifecycleContract::stockStagePlan('Processing', 'RESERVED')['status']);
        self::assertSame('no_transition', OrderLifecycleContract::stockStagePlan('Shipped', 'RESERVED')['status']);
    }

    public function test_delivered_finalizes_reserved_or_sells_new_directly(): void
    {
        self::assertSame('finalize_reserved_sale', OrderLifecycleContract::stockStagePlan('Delivered', 'RESERVED')['action']);
        self::assertSame('sell_direct', OrderLifecycleContract::stockStagePlan('Delivered', 'NEW')['action']);
    }

    public function test_cancel_fake_and_return_release_reserved_stock_only(): void
    {
        self::assertSame('release', OrderLifecycleContract::stockStagePlan('Cancelled', 'RESERVED')['action']);
        self::assertSame('release', OrderLifecycleContract::stockStagePlan('Fake', 'RESERVED')['action']);
        self::assertSame('release', OrderLifecycleContract::stockStagePlan('Returned', 'RESERVED')['action']);
        self::assertSame('stage_only', OrderLifecycleContract::stockStagePlan('Cancelled', 'NEW')['action']);
    }

    public function test_sold_return_does_not_automatically_restock(): void
    {
        $plan = OrderLifecycleContract::stockStagePlan('Cancelled', 'SOLD');
        self::assertSame('manual_review', $plan['status']);
        self::assertSame('return_review_no_auto_restock', $plan['action']);
    }

    public function test_legacy_and_unknown_stages_never_mutate_stock_automatically(): void
    {
        self::assertSame('legacy_skipped', OrderLifecycleContract::stockStagePlan('Cancelled', '')['status']);
        self::assertSame('manual_review', OrderLifecycleContract::stockStagePlan('Confirmed', 'CORRUPT')['status']);
    }

    public function test_reconfirming_sold_order_is_flagged_instead_of_reserving_again(): void
    {
        $plan = OrderLifecycleContract::stockStagePlan('Confirmed', 'SOLD');
        self::assertSame('manual_review', $plan['status']);
        self::assertSame('review_needed_no_reserve', $plan['action']);
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
}
