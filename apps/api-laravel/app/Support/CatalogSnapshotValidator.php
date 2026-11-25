<?php

namespace App\Support;

class CatalogSnapshotValidator
{
    /**
     * Validate a canonical, already-mapped snapshot without mutating or merging it.
     *
     * @param array<int, array<string, mixed>> $products
     * @return array{valid: bool, product_count: int, issues: array<int, array{code: string, indexes: array<int, int>}>}
     */
    public static function validate(array $products): array
    {
        $issues = [];
        $ids = [];
        $skus = [];

        foreach (array_values($products) as $index => $product) {
            $id = isset($product['product_id']) ? trim((string) $product['product_id']) : '';
            $sku = isset($product['sku']) ? mb_strtolower(trim((string) $product['sku'])) : '';

            if ($id === '') {
                $issues[] = ['code' => 'missing_product_id', 'indexes' => [$index]];
            } else {
                $ids[$id][] = $index;
            }

            if ($sku === '') {
                $issues[] = ['code' => 'missing_sku', 'indexes' => [$index]];
            } else {
                $skus[$sku][] = $index;
            }

            foreach (['name', 'slug', 'category', 'currency'] as $field) {
                if (!isset($product[$field]) || trim((string) $product[$field]) === '') {
                    $issues[] = ['code' => 'missing_' . $field, 'indexes' => [$index]];
                }
            }

            if (!array_key_exists('price', $product)
                || !is_numeric($product['price'])
                || (float) $product['price'] < 0) {
                $issues[] = ['code' => 'invalid_price', 'indexes' => [$index]];
            }

            if (!is_bool($product['published'] ?? null)) {
                $issues[] = ['code' => 'invalid_published_flag', 'indexes' => [$index]];
            }
        }

        foreach ($ids as $indexes) {
            if (count($indexes) > 1) {
                $issues[] = ['code' => 'duplicate_product_id', 'indexes' => $indexes];
            }
        }

        foreach ($skus as $indexes) {
            if (count($indexes) > 1) {
                $issues[] = ['code' => 'duplicate_sku', 'indexes' => $indexes];
            }
        }

        return [
            'valid' => $issues === [],
            'product_count' => count($products),
            'issues' => $issues,
        ];
    }
}
