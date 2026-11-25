<?php

namespace Tests\Unit;

use App\Support\ExactProductIdentity;
use PHPUnit\Framework\TestCase;

class ExactProductIdentityTest extends TestCase
{
    private array $products = [
        ['product_id' => 'MA-100', 'sku' => 'ABAYA-100', 'name' => 'Existing A'],
        ['product_id' => 'MA-200', 'sku' => 'HIJAB-200', 'name' => 'Existing B'],
    ];

    public function test_exact_product_id_resolves_existing_product(): void
    {
        $result = ExactProductIdentity::resolve($this->products, 'MA-100', null);

        self::assertSame('match', $result['status']);
        self::assertSame('MA-100', $result['product']['product_id']);
    }

    public function test_exact_sku_is_trimmed_and_case_insensitive(): void
    {
        $result = ExactProductIdentity::resolve($this->products, null, ' abaya-100 ');

        self::assertSame('match', $result['status']);
        self::assertSame('MA-100', $result['product']['product_id']);
    }

    public function test_unmatched_identity_creates_a_separate_product(): void
    {
        self::assertSame(
            ['status' => 'create'],
            ExactProductIdentity::resolve($this->products, 'MA-NEW', 'NEW-SKU')
        );
    }

    public function test_different_product_id_and_sku_matches_are_a_conflict(): void
    {
        self::assertSame(
            ['status' => 'conflict'],
            ExactProductIdentity::resolve($this->products, 'MA-100', 'HIJAB-200')
        );
    }

    public function test_duplicate_sku_is_a_conflict_not_an_arbitrary_match(): void
    {
        $products = [
            ...$this->products,
            ['product_id' => 'MA-300', 'sku' => 'ABAYA-100', 'name' => 'Duplicate'],
        ];

        self::assertSame(
            ['status' => 'conflict'],
            ExactProductIdentity::resolve($products, null, 'ABAYA-100')
        );
    }

    public function test_partial_sku_does_not_match(): void
    {
        self::assertSame(
            ['status' => 'create'],
            ExactProductIdentity::resolve($this->products, null, 'ABAYA-10')
        );
    }
}
