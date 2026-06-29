TRUNCATE product_observations RESTART IDENTITY;

INSERT INTO product_observations (
  observed_at,
  country,
  channel,
  shop_name,
  brand_name,
  product_name,
  sku_id,
  listing_url,
  category_l2,
  category_l3,
  is_official,
  in_stock,
  price,
  competitor_median_price,
  rating,
  review_count,
  content_score,
  raw_snapshot
)
SELECT
  DATE '2026-01-05' + ((week_index % 8) * 7),
  country,
  channel,
  shop_name,
  brand_name,
  brand_name || ' ' || category_l3 || ' Item ' || product_index,
  'SKU-' || product_index,
  'https://example.invalid/listing/' || channel || '/' || product_index,
  category_l2,
  category_l3,
  product_index % 3 <> 0,
  product_index % 7 <> 0,
  (8 + (product_index % 90) + (week_index * 0.75))::numeric(10, 2),
  (9 + (product_index % 88) + ((week_index % 5) * 0.55))::numeric(10, 2),
  (3.2 + ((product_index % 18) / 10.0))::numeric(3, 2),
  20 + (product_index * 13) % 1500,
  55 + (product_index * 7) % 46,
  (
    'snowflake_snapshot=' ||
    product_index ||
    ';week=' ||
    week_index ||
    ';attributes=' ||
    repeat('availability,price,ratings,content,search,competitor,', 7)
  )
FROM generate_series(1, 25000) AS product_index
CROSS JOIN generate_series(0, 19) AS week_index
CROSS JOIN LATERAL (
  SELECT
    (ARRAY['Indonesia', 'Malaysia', 'Philippines', 'Singapore', 'Thailand', 'Vietnam', 'Taiwan', 'China'])[1 + (product_index % 8)] AS country,
    (ARRAY['Shopee', 'Lazada', 'TikTok Shop'])[1 + (product_index % 3)] AS channel,
    (ARRAY['Official Store', 'Mall Partner', 'Marketplace Seller'])[1 + (product_index % 3)] AS shop_name,
    (ARRAY['Acme', 'Nova', 'Pinnacle', 'Everyday Co'])[1 + (product_index % 4)] AS brand_name,
    (ARRAY['Beauty', 'Home Care', 'Food'])[1 + (product_index % 3)] AS category_l2,
    (ARRAY['Shampoo', 'Detergent', 'Snacks', 'Serum'])[1 + (product_index % 4)] AS category_l3
) AS dims;
