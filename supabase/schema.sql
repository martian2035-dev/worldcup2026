-- 世界杯竞猜数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件

-- 1. 用户资料表
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username   TEXT UNIQUE NOT NULL,
  beans      INTEGER DEFAULT 10000,
  total_bets INTEGER DEFAULT 0,
  won_bets   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 比赛赔率表
CREATE TABLE IF NOT EXISTS match_odds (
  match_id   TEXT PRIMARY KEY,
  home_win   DECIMAL(6,2) NOT NULL,
  draw       DECIMAL(6,2) NOT NULL,
  away_win   DECIMAL(6,2) NOT NULL,
  bookmaker  TEXT DEFAULT 'default',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 投注记录表
CREATE TABLE IF NOT EXISTS bets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_id   TEXT NOT NULL,
  bet_type   TEXT NOT NULL CHECK (bet_type IN ('home_win', 'draw', 'away_win')),
  amount     INTEGER NOT NULL CHECK (amount >= 10 AND amount <= 100),
  odds       DECIMAL(6,2) NOT NULL,
  payout     INTEGER,
  status     TEXT DEFAULT 'pending' CHECK (status IN ('pending','won','lost','refunded')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 排行榜视图
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  username,
  beans,
  total_bets,
  won_bets,
  CASE WHEN total_bets > 0
    THEN ROUND(100.0 * won_bets / total_bets, 1)
    ELSE 0
  END AS win_rate
FROM profiles
ORDER BY beans DESC
LIMIT 100;

-- 5. 新用户自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || SUBSTRING(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Row Level Security

-- profiles: 所有人可读，只能更新自己
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- bets: 只能读写自己的投注
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bets_select_own" ON bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bets_insert_own" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- match_odds: 所有人可读
ALTER TABLE match_odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "odds_read_all" ON match_odds FOR SELECT USING (true);

-- 7. 索引
CREATE INDEX IF NOT EXISTS idx_bets_user_id    ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_match_id   ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_status     ON bets(status);
CREATE INDEX IF NOT EXISTS idx_profiles_beans  ON profiles(beans DESC);
