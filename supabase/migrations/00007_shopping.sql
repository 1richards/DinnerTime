-- Phase 8 Shopping & Instacart foundation
-- Three tables: shopping_lists, shopping_list_items, shopping_orders
-- RLS mirrors Phase 7 pattern (EXISTS subquery through parent for items)

-- shopping_lists: one per generated grocery list (optionally tied to a meal plan)
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- shopping_list_items: one row per consolidated grocery line
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  sources JSONB NOT NULL DEFAULT '[]',
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  user_added BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- shopping_orders: snapshot of an Instacart link/order created for a profile
CREATE TABLE shopping_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
  items_snapshot JSONB NOT NULL,
  instacart_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  placed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shopping_lists_profile ON shopping_lists(profile_id, created_at DESC);
CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_orders_profile ON shopping_orders(profile_id, placed_at DESC);

-- Enable Row Level Security
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_orders ENABLE ROW LEVEL SECURITY;

-- shopping_lists policies (scoped by profile_id = auth.uid())
CREATE POLICY "Users can view own shopping lists"
  ON shopping_lists
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own shopping lists"
  ON shopping_lists
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own shopping lists"
  ON shopping_lists
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete own shopping lists"
  ON shopping_lists
  FOR DELETE
  USING (auth.uid() = profile_id);

-- shopping_list_items policies (scoped via parent shopping_lists.profile_id)
CREATE POLICY "Users can view own shopping list items"
  ON shopping_list_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND shopping_lists.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own shopping list items"
  ON shopping_list_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND shopping_lists.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own shopping list items"
  ON shopping_list_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND shopping_lists.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND shopping_lists.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own shopping list items"
  ON shopping_list_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND shopping_lists.profile_id = auth.uid()
    )
  );

-- shopping_orders policies (scoped by profile_id = auth.uid())
CREATE POLICY "Users can view own shopping orders"
  ON shopping_orders
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own shopping orders"
  ON shopping_orders
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own shopping orders"
  ON shopping_orders
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete own shopping orders"
  ON shopping_orders
  FOR DELETE
  USING (auth.uid() = profile_id);

-- Update updated_at on row modification (reuses existing function from 00001_profiles.sql)
CREATE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
