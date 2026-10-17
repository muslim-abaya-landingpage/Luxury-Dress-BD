# Filter Backend Code Examples

## 1. Shopify: metafield definitions (GraphQL Admin API)

Shopify-তে product metafield definition একবার তৈরি করে পরে Search & Discovery-তে filter হিসেবে enable করুন। নিচের mutation-গুলো Admin GraphQL API বা Shopify CLI থেকে চালানো যায়।

```graphql
mutation CreateFabricDefinition {
  metafieldDefinitionCreate(definition: {
    name: "Fabric"
    namespace: "custom"
    key: "fabric"
    description: "Normalized fabric name used by collection filters"
    type: "single_line_text_field"
    ownerType: PRODUCT
  }) {
    createdDefinition { id name namespace key type }
    userErrors { field message }
  }
}

mutation CreateCollectionDefinition {
  metafieldDefinitionCreate(definition: {
    name: "Collection"
    namespace: "custom"
    key: "collection"
    type: "single_line_text_field"
    ownerType: PRODUCT
  }) {
    createdDefinition { id name namespace key type }
    userErrors { field message }
  }
}
```

### Shopify product data example

```json
{
  "product": {
    "title": "Premium Black 3 Part Abaya Set",
    "productType": "Abaya",
    "tags": ["collection:eid-2026", "occasion:daily"],
    "metafields": [
      { "namespace": "custom", "key": "fabric", "type": "single_line_text_field", "value": "dubai-cherry" },
      { "namespace": "custom", "key": "collection", "type": "single_line_text_field", "value": "eid-2026" }
    ],
    "options": [
      { "name": "Size", "values": ["50", "52", "54", "56"] },
      { "name": "Color", "values": ["black"] }
    ]
  }
}
```

## 2. Shopify: Liquid filter + sorting template

`sections/main-collection-product-grid.liquid` বা theme-এর collection section-এ:

```liquid
<form class="collection-filters" method="get">
  {% for filter in collection.filters %}
    <fieldset class="filter-group">
      <legend>{{ filter.label }}</legend>
      {% for value in filter.values %}
        <label class="filter-option">
          <input
            type="checkbox"
            name="{{ value.param_name }}"
            value="{{ value.value }}"
            {% if value.active %}checked{% endif %}
            {% if value.count == 0 and value.active == false %}disabled{% endif %}>
          <span>{{ value.label }}</span>
          <small>{{ value.count }}</small>
        </label>
      {% endfor %}
    </fieldset>
  {% endfor %}

  <label class="sort-control">
    Sort by
    <select name="sort_by" onchange="this.form.submit()">
      {% for option in collection.sort_options %}
        <option value="{{ option.value }}" {% if option.value == collection.sort_by %}selected{% endif %}>
          {{ option.name }}
        </option>
      {% endfor %}
    </select>
  </label>

  <a class="clear-filters" href="{{ collection.url }}">Clear all filters</a>
</form>
```

**গুরুত্বপূর্ণ:** `collection.filters` Shopify Search & Discovery-এর configured filters থেকে আসে। Fabric filter দেখাতে `custom.fabric` metafield definition-টি storefront filter হিসেবে enable করতে হবে।

## 3. WooCommerce: global attributes ও PHP query example

প্রথমে Products → Attributes-এ এই global attributes তৈরি করুন:

- `pa_size`
- `pa_color`
- `pa_fabric`

তারপর theme-এর `functions.php` বা একটি ছোট custom plugin-এ:

```php
<?php
add_action('woocommerce_product_query', function (WC_Query $wc_query) {
    if (!is_shop() && !is_product_category() && !is_product_taxonomy()) {
        return;
    }

    $tax_query = (array) $wc_query->get('tax_query');

    $map = [
        'filter_size'  => 'pa_size',
        'filter_color' => 'pa_color',
        'filter_fabric'=> 'pa_fabric',
    ];

    foreach ($map as $query_key => $taxonomy) {
        if (empty($_GET[$query_key])) {
            continue;
        }

        $terms = array_filter(array_map(
            'sanitize_title',
            (array) wp_unslash($_GET[$query_key])
        ));

        if (!$terms) {
            continue;
        }

        $tax_query[] = [
            'taxonomy' => $taxonomy,
            'field'    => 'slug',
            'terms'    => $terms,
            'operator' => 'IN', // একই attribute-এর terms = OR
        ];
    }

    if (count($tax_query) > 1) {
        $tax_query['relation'] = 'AND'; // আলাদা attribute = AND
    }

    $wc_query->set('tax_query', $tax_query);
});
```

### WooCommerce filter form

```php
<form method="get" class="wc-filter-form">
  <fieldset>
    <legend>Size</legend>
    <?php foreach (['50', '52', '54', '56'] as $size) : ?>
      <label>
        <input type="checkbox" name="filter_size[]" value="<?php echo esc_attr(sanitize_title($size)); ?>">
        <?php echo esc_html($size); ?>
      </label>
    <?php endforeach; ?>
  </fieldset>

  <label>
    Sort by
    <select name="orderby" onchange="this.form.submit()">
      <option value="menu_order">Default</option>
      <option value="price">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
      <option value="date">Newest</option>
    </select>
  </label>

  <a href="<?php echo esc_url(wc_get_page_permalink('shop')); ?>">Clear all filters</a>
</form>
```

## 4. Mobile filter drawer CSS

এই CSS existing `.shop-sidebar`, `.shop-filter-backdrop`, `.shop-filter-open` markup-এর সঙ্গে কাজ করবে।

```css
@media (max-width: 960px) {
  :root {
    --filter-drawer-width: min(360px, 90vw);
    --filter-ease: cubic-bezier(.22, 1, .36, 1);
  }

  body.shop-filter-open { overflow: hidden; overscroll-behavior: contain; }

  .shop-filter-backdrop {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    background: rgba(42, 42, 42, .42);
    backdrop-filter: blur(3px);
    transition: opacity .24s ease, visibility 0s linear .24s;
  }

  .shop-filter-backdrop.is-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition-delay: 0s;
  }

  .shop-sidebar {
    width: var(--filter-drawer-width);
    padding: max(18px, env(safe-area-inset-top)) 18px max(28px, env(safe-area-inset-bottom));
    transform: translate3d(-104%, 0, 0);
    opacity: .96;
    will-change: transform;
    transition: transform .38s var(--filter-ease), opacity .24s ease;
    box-shadow: 12px 0 34px rgba(42, 42, 42, .16);
  }

  .shop-sidebar.is-open {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }

  .shop-filter-head {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #fff;
    padding-top: 4px;
  }

  .shop-filter-close {
    width: 40px;
    height: 40px;
    border: 1px solid #dcd5c9;
    border-radius: 50%;
    font-size: 24px;
    line-height: 1;
    transition: transform .2s ease, background .2s ease;
  }

  .shop-filter-close:active { transform: rotate(90deg) scale(.94); background: #f0eae1; }

  .filter-check-option,
  .color-filter-option {
    min-height: 44px;
    padding: 10px 0;
  }

  .filter-check-option input,
  .color-filter-check {
    width: 20px;
    height: 20px;
  }

  .shop-filter-reset {
    position: sticky;
    bottom: max(8px, env(safe-area-inset-bottom));
    background: #2a2a2a;
    color: #faf6f0;
    border-color: #2a2a2a;
    min-height: 44px;
  }

  @media (prefers-reduced-motion: reduce) {
    .shop-sidebar,
    .shop-filter-backdrop,
    .shop-filter-close { transition: none; }
  }
}
```

## 5. Accessibility notes

- drawer open button-এ `aria-controls="shopFilterPanel"` এবং dynamic `aria-expanded` রাখুন।
- close button-এ visible label বা `aria-label="Close filters"` রাখুন।
- drawer open হলে focus panel-এর heading/close button-এ move করুন এবং Escape key-তে close করুন।
- backdrop click ও close button—দুটিই close action হিসেবে রাখুন।
