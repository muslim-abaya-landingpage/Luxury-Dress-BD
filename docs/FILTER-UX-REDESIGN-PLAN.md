# Muslim Abaya — All Categories Filter & Sorting Redesign Plan

**Status:** Implemented in the static catalog code and verified on the local preview.

## 1. সমস্যার সারাংশ

আগের `/category` পেইজটি শুধু category tile hub ছিল; সেখানে unified product listing বা faceted filtering ছিল না। ক্যাটাগরি পেইজে Price Range ও Color থাকলেও Size, Availability, Category combination, Clear/Reset এবং desktop sorting অসম্পূর্ণ ছিল। একই পণ্যের back/side/detail ছবিও আলাদা card হিসেবে দেখা যাচ্ছিল।

## 2. নতুন UI/UX অভিজ্ঞতা

### Desktop

- বাম পাশে sticky filter rail: **Category, Price Range, Color, Size, Availability**
- ডান পাশে unified product grid
- grid header-এ product count এবং **Sort By**: Default, Price low-high, Price high-low, Name A-Z
- bottom-এ `Clear all filters` action
- All Categories-এ gallery variant (Back/Side/Detail) বাদ দিয়ে primary product card দেখানো

### Mobile

- `Filter` button দিয়ে drawer খুলবে
- backdrop ও close action আছে
- একই toolbar-এ sorting dropdown
- checkbox touch target 16px+ এবং filter controls vertical list
- filter result count dynamic update হয়

### Empty state

- কোনো combination-এ ফল না থাকলে `No products found for this filter.` বার্তা
- clear button দিয়ে এক ক্লিকে initial state-এ ফেরা যায়

## 3. এই রিপোজিটরিতে করা পরিবর্তন

| ফাইল | পরিবর্তন |
|---|---|
| `category-renderer.js` | All Categories-কে unified product listing করা; gallery duplicate বাদ; category/size/availability filter; clear reset; All Categories link ঠিক করা; sorting রাখা/সক্রিয় করা |
| `category-sidebar.css` | checkbox filter list, reset button, desktop toolbar ও responsive control styling |
| `category.html` | SEO title/description আপডেট এবং cache-busting renderer version |

## 4. Front-end data contract

প্রতিটি product object-এ যত বেশি structured data থাকবে, filter তত নির্ভুল হবে:

```js
{
  id: "ABY-BLK-3P-02",
  name: "Premium Black 3 Part Abaya Set",
  category: "abaya",
  price: 1450,
  color: "black",
  colorLabel: "Classic Black",
  sizes: ["44", "46", "48", "50", "52", "54", "56"],
  fabric: "Premium Chiffon Georgette",
  stock: 12,
  createdAt: "2026-10-01"
}
```

## 5. Filter logic

1. প্রতিটি facet-এর checked value array-তে রাখা হয়।
2. একই facet-এর একাধিক value OR হিসেবে কাজ করে—যেমন Black অথবা Maroon।
3. আলাদা facetগুলো AND হিসেবে কাজ করে—যেমন Black + Size 52 + ৳1,000-এর বেশি।
4. Price slider inclusive range হিসেবে কাজ করে।
5. Availability stock-sync-এর `productIsInStock()` status ব্যবহার করে।
6. Product count প্রতি interaction-এ refresh হয়।

## 6. Shopify হলে কী পরিবর্তন লাগবে

Shopify-তে custom client-side filtering না লিখে **Search & Discovery app-এর filter definitions** ব্যবহার করা উচিত।

### Admin configuration

- Settings → Search & Discovery → Filters:
  - Availability
  - Price
  - Product category
  - Size / Color / Fabric-এর জন্য product options বা metafield
- Product taxonomy ও option values normalize করতে হবে। যেমন `Black`, `Classic Black`, `black`—একটিতে নামিয়ে আনা।

### Liquid implementation

`collection.json` বা collection template-এ:

```liquid
{% render 'facets', results: collection, enable_filtering: true, enable_sorting: true %}
```

`snippets/facets.liquid`-এ প্রতিটি `filter` loop:

```liquid
{% for filter in results.filters %}
  <fieldset>
    <legend>{{ filter.label }}</legend>
    {% for value in filter.values %}
      <label>
        <input type="checkbox"
          name="{{ value.param_name }}"
          value="{{ value.value }}"
          {% if value.active %}checked{% endif %}>
        {{ value.label }} ({{ value.count }})
      </label>
    {% endfor %}
  </fieldset>
{% endfor %}
```

Sorting-এর জন্য `sort_by` query parameter ব্যবহার করতে হবে:

```liquid
<select name="sort_by" onchange="this.form.submit()">
  {% for option in collection.sort_options %}
    <option value="{{ option.value }}" {% if option.value == collection.sort_by %}selected{% endif %}>
      {{ option.name }}
    </option>
  {% endfor %}
</select>
```

### Shopify acceptance criteria

- Filter URL reload/back/forward-এ state ধরে রাখে
- Result count Shopify response-এর সঙ্গে মেলে
- Active filter chips দেখায়
- `Clear all` সব query parameter সরায়
- Mobile drawer keyboard এবং screen-reader accessible

## 7. WordPress / WooCommerce হলে কী পরিবর্তন লাগবে

WooCommerce-এ product attribute taxonomy এবং server-side query ব্যবহার করা উচিত।

### Admin/data setup

- Products → Attributes: Size, Color, Fabric, Collection তৈরি
- প্রতিটি product-এ normalized terms assign
- Stock status WooCommerce inventory থেকে আসবে
- Category ও price native taxonomy/price query হিসেবে থাকবে

### Block/theme approach

WooCommerce Product Collection block-এ filter blocks ব্যবহার করা যায়:

- Filter by price
- Filter by attribute
- Filter by stock
- Sort by

### Custom PHP approach

Classic theme হলে `pre_get_posts` বা WooCommerce product query-তে layered nav values map করতে হবে:

```php
add_action('woocommerce_product_query', function ($query) {
    if (!is_shop() && !is_product_category()) return;

    if (!empty($_GET['filter_size'])) {
        $query->set('tax_query', [
            [
                'taxonomy' => 'pa_size',
                'field'    => 'slug',
                'terms'    => array_map('sanitize_title', (array) $_GET['filter_size']),
            ],
        ]);
    }
});
```

Price-এর জন্য WooCommerce-এর `min_price`/`max_price`, sorting-এর জন্য `orderby`/`order`, availability-এর জন্য `stock_status` query ব্যবহার করতে হবে। Security-এর জন্য সব GET value sanitize/validate করতে হবে; user input সরাসরি SQL-এ দেওয়া যাবে না।

### WordPress acceptance criteria

- Query URL shareable ও crawl-safe
- AJAX ব্যবহার করলে History API দিয়ে URL sync
- WooCommerce stock source-এর সঙ্গে count ও card badge consistent
- Facet count server-side generate করা
- Cache variation: filter query অনুযায়ী cache key আলাদা করা

## 8. QA checklist

- [x] All Categories-এ product grid দেখা যায়
- [x] Category checkbox দেখা যায়
- [x] Price range দেখা যায়
- [x] Color checkbox দেখা যায়
- [x] Size checkbox দেখা যায়
- [x] In stock / Out of stock checkbox দেখা যায়
- [x] Clear all filters আছে
- [x] Sorting dropdown কাজ করে
- [x] Gallery duplicate primary listing-এ বাদ যায়
- [x] No-result state আছে
- [x] Mobile filter drawer markup ও backdrop আছে
- [x] Local preview HTTP 200
- [ ] Production smoke test after Cloudflare/GitHub Pages propagation

## 9. পরবর্তী অপারেশনাল সুপারিশ

1. Structured product data admin panel-এ বাধ্যতামূলক field validation দিন।
2. Filter state URL-এ serialize করুন, যাতে refresh/share/back-forward-এ state অক্ষুণ্ণ থাকে।
3. 100+ product হলে server-side filtering বা indexed API ব্যবহার করুন; পুরো catalog browser-এ পাঠাবেন না।
4. Analytics event যোগ করুন: `filter_apply`, `sort_change`, `no_results`, `clear_filters`।
5. প্রতি release-এ desktop 1440px, tablet 768px এবং mobile 390px smoke test চালান।
