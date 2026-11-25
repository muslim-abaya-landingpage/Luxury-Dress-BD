<?php

namespace App\Support;

class CatalogFixture
{
    /**
     * Synthetic records only. This is deliberately not connected to production data.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function products(): array
    {
        return [
            [
                'product_id' => 'MA-DEMO-001',
                'sku' => 'DEMO-ABAYA-001',
                'name' => 'Demo Everyday Abaya',
                'slug' => 'demo-everyday-abaya',
                'category' => 'abaya',
                'price' => 1250,
                'currency' => 'BDT',
                'published' => true,
                'image_url' => null,
            ],
            [
                'product_id' => 'MA-DEMO-002',
                'sku' => 'DEMO-HIJAB-002',
                'name' => 'Demo Soft Hijab',
                'slug' => 'demo-soft-hijab',
                'category' => 'hijab',
                'price' => 350,
                'currency' => 'BDT',
                'published' => true,
                'image_url' => null,
            ],
            [
                'product_id' => 'MA-DEMO-003',
                'sku' => 'DEMO-DRAFT-003',
                'name' => 'Unpublished Demo Product',
                'slug' => 'unpublished-demo-product',
                'category' => 'abaya',
                'price' => 990,
                'currency' => 'BDT',
                'published' => false,
                'image_url' => null,
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function findPublishedById(string $productId): ?array
    {
        foreach (self::products() as $product) {
            if ($product['published'] && $product['product_id'] === $productId) {
                return $product;
            }
        }

        return null;
    }
}
