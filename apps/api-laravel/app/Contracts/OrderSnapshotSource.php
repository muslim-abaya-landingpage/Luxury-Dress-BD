<?php

namespace App\Contracts;

use App\Support\OrderSnapshotPage;

/**
 * Read-only boundary for importing order lifecycle snapshots.
 *
 * Implementations must not expose customer PII unless a separately approved
 * use case requires it. No write methods belong on this interface.
 */
interface OrderSnapshotSource
{
    /**
     * Return one bounded page of canonical order lifecycle fields.
     *
     * @param string|null $cursor Opaque continuation cursor issued by this source.
     */
    public function readOrderSnapshotPage(?string $cursor = null, int $limit = 500): OrderSnapshotPage;
}
