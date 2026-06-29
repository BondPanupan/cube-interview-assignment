CREATE TABLE IF NOT EXISTS product_observations (
  id BIGSERIAL PRIMARY KEY,
  observed_at DATE NOT NULL,
  country TEXT NOT NULL,
  channel TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  listing_url TEXT NOT NULL,
  category_l2 TEXT NOT NULL,
  category_l3 TEXT NOT NULL,
  is_official BOOLEAN NOT NULL,
  in_stock BOOLEAN NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  competitor_median_price NUMERIC(10, 2) NOT NULL,
  rating NUMERIC(3, 2) NOT NULL,
  review_count INTEGER NOT NULL,
  content_score INTEGER NOT NULL CHECK (content_score BETWEEN 0 AND 100),
  raw_snapshot TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_observations_report
  ON product_observations (observed_at, country, channel, brand_name);
