<?php

namespace App\Support;

class ExactProductIdentity
{
    /**
     * Resolve identities without fuzzy matching.
     *
     * @param array<int, array<string, mixed>> $products
     * @return array{status: 'match'|'create'|'conflict', product?: array<string, mixed>}
     */
    public static function resolve(array $products, ?string $productId, ?string $sku): array
    {
        $productId = $productId === null ? null : trim($productId);
        $sku = $sku === null ? null : mb_strtolower(trim($sku));

        $idMatches = $productId === null || $productId === ''
            ? []
            : array_values(array_filter(
                $products,
                static fn (array $product): bool =>
                    isset($product['product_id']) && $product['product_id'] === $productId
            ));

        $skuMatches = $sku === null || $sku === ''
            ? []
            : array_values(array_filter(
                $products,
                static fn (array $product): bool =>
                    isset($product['sku'])
                    && mb_strtolower(trim((string) $product['sku'])) === $sku
            ));

        if (count($idMatches) > 1 || count($skuMatches) > 1) {
            return ['status' => 'conflict'];
        }

        $byId = $idMatches[0] ?? null;
        $bySku = $skuMatches[0] ?? null;

        if ($byId !== null && $bySku !== null
            && $byId['product_id'] !== $bySku['product_id']) {
            return ['status' => 'conflict'];
        }

        $match = $byId ?? $bySku;

        return $match === null
            ? ['status' => 'create']
            : ['status' => 'match', 'product' => $match];
    }
}
