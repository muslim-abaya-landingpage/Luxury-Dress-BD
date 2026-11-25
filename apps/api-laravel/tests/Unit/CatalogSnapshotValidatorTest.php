<?php

namespace Tests\\Unit;

use App\\Support\\CatalogSnapshotValidator;
use PHPUnit\\Framework\\TestCase;

class CatalogSnapshotValidatorTest extends TestCase
{
    private function product(string $id = 'MA-1', string $sku = 'SKU-1'): array
    {
        return [
            'product_id' => $id,
            'sku' => $sku,
            'name' => 'Demo product',
            'slug' => 'demo-product',
            'category' => 'abaya',
            'price' => 1200,
            'currency' => 'BDT',
            'published' => true,
            'image_url' => null,
        ];
    }

    public function test_valid_canonical_snapshot_passes(): void
    {
        $result = CatalogSnapshotValidator::validate([
            $this->product(),
            $this->product('MA-2', 'SKU-2'),
        ]);

        self::assertTrue($result['valid']);
        self::assertSame(2, $result['product_count']);
        self::assertSame([], $result['issues']);
    }

    public function test_duplicate_product_ids_and_skus_are_reported(): void
    {
        $result = CatalogSnapshotValidator::validate([
            $this->product('MA-1', 'SKU-1'),
            $this->product('MA-1', 'SKU-2'),
            $this->product('MA-3', ' sku-1 '),
        ]);

        self::assertFalse($result['valid']);
        self::assertContains('duplicate_product_id', array_column($result['issues'], 'code'));
        self::assertContains('duplicate_sku', array_column($result['issues'], 'code'));
    }

    public function test_missing_identity_and_invalid_price_are_reported(): void
    {
        $product = $this->product('', '');
        $product['price'] = -1;

        $result = CatalogSnapshotValidator::validate([$product]);
        $codes = array_column($result['issues'], 'code');

        self::assertContains('missing_product_id', $codes);
        self::assertContains('missing_sku', $codes);
        self::assertContains('invalid_price', $codes);
    }

    public function test_missing_canonical_fields_and_non_boolean_publish_flag_are_reported(): void
    {
        $product = $this->product();
        unset($product['name']);
        $product['published'] = 'yes';

        $result = CatalogSnapshotValidator::validate([$product]);
        $codes = array_column($result['issues'], 'code');

        self::assertContains('missing_name', $codes);
        self::assertContains('invalid_published_flag', $codes);
    }
}
