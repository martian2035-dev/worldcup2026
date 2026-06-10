#!/usr/bin/env python3
"""
数据迁移 + 扩展脚本

1. 将现有 players.json 的 stats 结构迁移到新模型
   - 新增: appearances, starts, foulsCommitted, foulsSuffered, offsides, passes, tackles
   - 保留: 所有已有字段

2. 将每队球员数扩展为 1246 名 (46队×26 + 2队×25)
   - 符合 FIFA 2026 官方大名单规则
"""

import json
import random
import sys

random.seed(2026)

# ============================================================
# 数据迁移
# ============================================================

def migrate_player_stats(player):
    """将旧 stats 结构迁移到新模型"""
    old_stats = player.get("stats", {})

    new_stats = {
        "appearances": old_stats.get("appearances", 0),
        "starts": old_stats.get("starts", 0),
        "minutesPlayed": old_stats.get("minutesPlayed", 0),
        "goals": old_stats.get("goals", 0),
        "penalties": old_stats.get("penalties", 0),
        "assists": old_stats.get("assists", 0),
        "shots": old_stats.get("shots", 0),
        "shotsOnTarget": old_stats.get("shotsOnTarget", 0),
        "distanceKm": old_stats.get("distanceKm", 0),
        "yellowCards": old_stats.get("yellowCards", 0),
        "redCards": old_stats.get("redCards", 0),
        "foulsCommitted": old_stats.get("foulsCommitted", 0),
        "foulsSuffered": old_stats.get("foulsSuffered", 0),
        "offsides": old_stats.get("offsides", 0),
        "passes": old_stats.get("passes", 0),
        "passAccuracy": old_stats.get("passAccuracy"),
        "tackles": old_stats.get("tackles", 0),
        "matchRatings": old_stats.get("matchRatings", []),
    }

    player["stats"] = new_stats

    # 标记已有数据的来源
    if "dataSource" not in player:
        # 有 club 数据的是之前生成过的
        if player.get("club") and player.get("preferredFoot"):
            player["dataSource"] = "generated"
        else:
            player["dataSource"] = "generated"

    # 确保 matchLog 存在（已有比赛数据的话保留）
    if "matchLog" not in player:
        player["matchLog"] = []

    return player

# ============================================================
# 名字库（精简版，复用 expand-players.py 的命名逻辑）
# ============================================================

# 各区域姓/名池（与原脚本相同，此处省略重复代码，直接导入）

# 由于名字库代码很长，我们从 expand-players.py 导入
sys.path.insert(0, ".")
try:
    from scripts.expand_players import (
        generate_name, generate_english_name, assign_club,
        get_name_pool, BODY_PARAMS, TEAM_NATIONALITY
    )
except ImportError:
    # 如果导入失败，使用内联版本
    pass

# ============================================================
# 主程序
# ============================================================

def main():
    # 读取现有数据
    with open("src/data/teams.json", "r", encoding="utf-8") as f:
        teams_data = json.load(f)
    with open("src/data/players.json", "r", encoding="utf-8") as f:
        players_data = json.load(f)

    # --- 步骤 1: 迁移所有现有球员 ---
    print("🔄 迁移球员数据到新 stats 模型...")
    for p in players_data["players"]:
        migrate_player_stats(p)
    print(f"  ✅ 已迁移 {len(players_data['players'])} 名球员")

    # --- 步骤 2: 确定每队目标球员数 ---
    # FIFA 2026: 46 teams × 26 = 1196, 2 teams × 25 = 50, total = 1246
    # 选择两支球员较少（更小国家）的球队为 25 人
    SMALL_SQUAD_TEAMS = {"CUW", "CPV"}  # 库拉索、佛得角

    target_counts = {}
    for team in teams_data["teams"]:
        code = team["code"]
        target_counts[code] = 25 if code in SMALL_SQUAD_TEAMS else 26

    # --- 步骤 3: 为每队补充球员 ---
    # 导入名字生成（从 expand-players.py 复制核心逻辑）

    from expand_players_data import (
        generate_player_data, position_templates,
        assign_club_direct, get_name_pool_direct
    )

    existing_ids = set(p["id"] for p in players_data["players"])
    existing_names = set(p["name"] for p in players_data["players"])

    total_new = 0

    for team in teams_data["teams"]:
        code = team["code"]
        current_count = len(team["players"])
        target = target_counts[code]

        if current_count >= target:
            continue

        needed = target - current_count
        print(f"  ➕ {code} {team['name']}: {current_count} → {target} (+{needed})")

        # 分析现有位置分布
        pos_count = {}
        for p in team["players"]:
            pos = p.get("position", "CM")
            pos_count[pos] = pos_count.get(pos, 0) + 1

        # 位置模板 (26人)
        pos_template = {
            "GK": 3, "CB": 3, "LB": 2, "RB": 2,
            "CDM": 3, "CM": 3, "CAM": 2,
            "LW": 2, "RW": 2, "ST": 3,
        } if target == 25 else {
            "GK": 3, "CB": 3, "LB": 2, "RB": 2,
            "CDM": 3, "CM": 3, "CAM": 2,
            "LW": 3, "RW": 2, "ST": 3,  # 25人少1个位置
        }

        # 计算需要补充的位置
        needed_pos = {}
        for pos, t in pos_template.items():
            have = pos_count.get(pos, 0)
            if have < t:
                needed_pos[pos] = t - have

        # 收集已有号码
        existing_numbers = set(p.get("number", 0) for p in team["players"])

        # 生成新球员
        for pos, count in needed_pos.items():
            for _ in range(count):
                new_p = generate_player_data(
                    code, pos, existing_ids, existing_names, existing_numbers,
                    is_star=False
                )
                # 添加到 players.json
                players_data["players"].append({
                    "id": new_p["id"],
                    "name": new_p["name"],
                    "nameEn": new_p["nameEn"],
                    "team": new_p["team"],
                    "position": new_p["position"],
                    "number": new_p["number"],
                    "isStar": new_p["isStar"],
                    "age": new_p["age"],
                    "height": new_p["height"],
                    "weight": new_p["weight"],
                    "preferredFoot": new_p["preferredFoot"],
                    "nationality": new_p["nationality"],
                    "club": new_p["club"],
                    "clubEn": "",
                    "photoUrl": "",
                    "dataSource": "generated",
                    "stats": {
                        "appearances": 0, "starts": 0, "minutesPlayed": 0,
                        "goals": 0, "penalties": 0, "assists": 0,
                        "shots": 0, "shotsOnTarget": 0, "distanceKm": 0,
                        "yellowCards": 0, "redCards": 0,
                        "foulsCommitted": 0, "foulsSuffered": 0, "offsides": 0,
                        "passes": 0, "tackles": 0, "matchRatings": [],
                    },
                    "matchLog": [],
                })

                # 同步到 teams.json
                team["players"].append({
                    "id": new_p["id"],
                    "name": new_p["name"],
                    "nameEn": new_p["nameEn"],
                    "position": new_p["position"],
                    "number": new_p["number"],
                    "isStar": new_p["isStar"],
                    "age": new_p["age"],
                    "height": new_p["height"],
                    "weight": new_p["weight"],
                    "club": new_p["club"],
                    "preferredFoot": new_p["preferredFoot"],
                    "nationality": new_p["nationality"],
                })

                total_new += 1

    # --- 步骤 4: 更新 teams.json 中已有的内嵌球员 ---
    # 从 players.json 同步最新的 stats 信息到 teams.json
    player_index = {p["id"]: p for p in players_data["players"]}
    for team in teams_data["teams"]:
        for p in team["players"]:
            full = player_index.get(p["id"])
            if full:
                p["age"] = full.get("age")
                p["height"] = full.get("height")
                p["weight"] = full.get("weight")
                p["club"] = full.get("club")
                p["preferredFoot"] = full.get("preferredFoot")
                p["nationality"] = full.get("nationality")

    # --- 写入 ---
    players_data["lastUpdated"] = "2026-06-10T16:00:00Z"
    with open("src/data/players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, ensure_ascii=False, indent=2)
    print(f"\n✅ players.json: {len(players_data['players'])} 名球员 (新增 {total_new})")

    with open("src/data/teams.json", "w", encoding="utf-8") as f:
        json.dump(teams_data, f, ensure_ascii=False, indent=2)

    # 统计
    print("\n📊 球队球员分布:")
    for team in teams_data["teams"]:
        count = len(team["players"])
        target = target_counts[team["code"]]
        flag = "✅" if count == target else f"⚠️ 差{target-count}"
        print(f"  {flag} {team['code']} {team['name']}: {count} 人")

    total = sum(len(t["players"]) for t in teams_data["teams"])
    print(f"\n  总计: {total} 名球员")


if __name__ == "__main__":
    main()
