#!/usr/bin/env python3
"""更新 teams.json 和 players.json：教练对象、球员详细信息"""

import json
import random
import sys

random.seed(2026)

# ============================================================
# 1. 教练数据：48 支球队的教练详细信息
# ============================================================
COACH_DATA = {
    "MEX": {"name": "哈维尔·阿吉雷", "nameEn": "Javier Aguirre", "nationality": "墨西哥", "age": 66, "since": "2024-07"},
    "RSA": {"name": "雨果·布鲁斯", "nameEn": "Hugo Broos", "nationality": "比利时", "age": 73, "since": "2021-05"},
    "KOR": {"name": "洪明甫", "nameEn": "Hong Myung-bo", "nationality": "韩国", "age": 57, "since": "2024-07"},
    "CZE": {"name": "伊万·哈谢克", "nameEn": "Ivan Hašek", "nationality": "捷克", "age": 62, "since": "2024-01"},
    "CAN": {"name": "杰西·马什", "nameEn": "Jesse Marsch", "nationality": "美国", "age": 52, "since": "2024-05"},
    "BIH": {"name": "谢尔盖·巴尔巴雷兹", "nameEn": "Sergej Barbarez", "nationality": "波黑", "age": 54, "since": "2024-04"},
    "QAT": {"name": "巴托洛梅·马克斯", "nameEn": "Bartolomé Márquez", "nationality": "西班牙", "age": 63, "since": "2023-12"},
    "SUI": {"name": "穆拉特·雅金", "nameEn": "Murat Yakin", "nationality": "瑞士", "age": 51, "since": "2021-08"},
    "BRA": {"name": "多里瓦尔·儒尼奥尔", "nameEn": "Dorival Júnior", "nationality": "巴西", "age": 63, "since": "2024-01"},
    "MAR": {"name": "瓦利德·雷格拉吉", "nameEn": "Walid Regragui", "nationality": "摩洛哥", "age": 49, "since": "2022-08"},
    "HAI": {"name": "塞巴斯蒂安·米涅", "nameEn": "Sébastien Migné", "nationality": "法国", "age": 53, "since": "2024-03"},
    "SCO": {"name": "史蒂夫·克拉克", "nameEn": "Steve Clarke", "nationality": "苏格兰", "age": 62, "since": "2019-05"},
    "USA": {"name": "毛里西奥·波切蒂诺", "nameEn": "Mauricio Pochettino", "nationality": "阿根廷", "age": 54, "since": "2024-09"},
    "PAR": {"name": "古斯塔沃·阿尔法罗", "nameEn": "Gustavo Alfaro", "nationality": "阿根廷", "age": 63, "since": "2024-08"},
    "AUS": {"name": "托尼·波波维奇", "nameEn": "Tony Popovic", "nationality": "澳大利亚", "age": 52, "since": "2024-09"},
    "TUR": {"name": "文森佐·蒙特拉", "nameEn": "Vincenzo Montella", "nationality": "意大利", "age": 52, "since": "2023-09"},
    "GER": {"name": "尤利安·纳格尔斯曼", "nameEn": "Julian Nagelsmann", "nationality": "德国", "age": 38, "since": "2023-09"},
    "CUW": {"name": "迪恩·戈雷", "nameEn": "Dean Gorré", "nationality": "荷兰", "age": 55, "since": "2023-08"},
    "CIV": {"name": "埃默斯·法埃", "nameEn": "Emerse Faé", "nationality": "科特迪瓦", "age": 41, "since": "2024-01"},
    "ECU": {"name": "塞巴斯蒂安·贝卡塞塞", "nameEn": "Sebastián Beccacece", "nationality": "阿根廷", "age": 44, "since": "2024-08"},
    "NED": {"name": "罗纳德·科曼", "nameEn": "Ronald Koeman", "nationality": "荷兰", "age": 62, "since": "2023-01"},
    "JPN": {"name": "森保一", "nameEn": "Hajime Moriyasu", "nationality": "日本", "age": 57, "since": "2018-07"},
    "SWE": {"name": "容·达尔·托马森", "nameEn": "Jon Dahl Tomasson", "nationality": "丹麦", "age": 49, "since": "2024-02"},
    "TUN": {"name": "凯斯·亚古比", "nameEn": "Kais Yaâkoubi", "nationality": "突尼斯", "age": 59, "since": "2024-06"},
    "BEL": {"name": "鲁迪·加西亚", "nameEn": "Rudi Garcia", "nationality": "法国", "age": 61, "since": "2025-01"},
    "EGY": {"name": "霍萨姆·哈桑", "nameEn": "Hossam Hassan", "nationality": "埃及", "age": 59, "since": "2024-02"},
    "IRN": {"name": "阿米尔·加莱诺埃", "nameEn": "Amir Ghalenoei", "nationality": "伊朗", "age": 61, "since": "2023-03"},
    "NZL": {"name": "达伦·巴泽利", "nameEn": "Darren Bazeley", "nationality": "英格兰", "age": 53, "since": "2023-07"},
    "ESP": {"name": "路易斯·德拉富恩特", "nameEn": "Luis de la Fuente", "nationality": "西班牙", "age": 64, "since": "2022-12"},
    "CPV": {"name": "佩德罗·布里托", "nameEn": "Pedro Brito", "nationality": "佛得角", "age": 54, "since": "2024-04"},
    "KSA": {"name": "埃尔韦·勒纳尔", "nameEn": "Hervé Renard", "nationality": "法国", "age": 57, "since": "2024-10"},
    "URU": {"name": "马塞洛·贝尔萨", "nameEn": "Marcelo Bielsa", "nationality": "阿根廷", "age": 70, "since": "2023-05"},
    "FRA": {"name": "迪迪埃·德尚", "nameEn": "Didier Deschamps", "nationality": "法国", "age": 57, "since": "2012-07"},
    "SEN": {"name": "帕佩·蒂奥", "nameEn": "Pape Thiaw", "nationality": "塞内加尔", "age": 44, "since": "2024-10"},
    "IRQ": {"name": "赫苏斯·卡萨斯", "nameEn": "Jesús Casas", "nationality": "西班牙", "age": 52, "since": "2022-11"},
    "NOR": {"name": "斯托尔·索尔巴肯", "nameEn": "Ståle Solbakken", "nationality": "挪威", "age": 57, "since": "2020-12"},
    "ARG": {"name": "利昂内尔·斯卡洛尼", "nameEn": "Lionel Scaloni", "nationality": "阿根廷", "age": 47, "since": "2018-08"},
    "ALG": {"name": "弗拉基米尔·佩特科维奇", "nameEn": "Vladimir Petković", "nationality": "瑞士", "age": 62, "since": "2024-02"},
    "AUT": {"name": "拉尔夫·朗尼克", "nameEn": "Ralf Rangnick", "nationality": "德国", "age": 67, "since": "2022-04"},
    "JOR": {"name": "贾马尔·塞拉米", "nameEn": "Jamal Sellami", "nationality": "摩洛哥", "age": 55, "since": "2024-06"},
    "POR": {"name": "罗伯托·马丁内斯", "nameEn": "Roberto Martínez", "nationality": "西班牙", "age": 52, "since": "2023-01"},
    "COD": {"name": "塞巴斯蒂安·德萨布雷", "nameEn": "Sébastien Desabre", "nationality": "法国", "age": 49, "since": "2022-08"},
    "UZB": {"name": "帖木儿·卡帕泽", "nameEn": "Timur Kapadze", "nationality": "乌兹别克斯坦", "age": 44, "since": "2024-02"},
    "COL": {"name": "内斯托尔·洛伦索", "nameEn": "Néstor Lorenzo", "nationality": "阿根廷", "age": 59, "since": "2022-06"},
    "ENG": {"name": "托马斯·图赫尔", "nameEn": "Thomas Tuchel", "nationality": "德国", "age": 52, "since": "2025-01"},
    "CRO": {"name": "兹拉特科·达利奇", "nameEn": "Zlatko Dalić", "nationality": "克罗地亚", "age": 59, "since": "2017-10"},
    "GHA": {"name": "奥托·阿多", "nameEn": "Otto Addo", "nationality": "加纳", "age": 50, "since": "2024-03"},
    "PAN": {"name": "托马斯·克里斯蒂安森", "nameEn": "Thomas Christiansen", "nationality": "西班牙", "age": 52, "since": "2020-07"},
}

# ============================================================
# 2. 国家队 -> 国籍映射
# ============================================================
TEAM_NATIONALITY = {
    "MEX": "墨西哥", "RSA": "南非", "KOR": "韩国", "CZE": "捷克",
    "CAN": "加拿大", "BIH": "波黑", "QAT": "卡塔尔", "SUI": "瑞士",
    "BRA": "巴西", "MAR": "摩洛哥", "HAI": "海地", "SCO": "苏格兰",
    "USA": "美国", "PAR": "巴拉圭", "AUS": "澳大利亚", "TUR": "土耳其",
    "GER": "德国", "CUW": "库拉索", "CIV": "科特迪瓦", "ECU": "厄瓜多尔",
    "NED": "荷兰", "JPN": "日本", "SWE": "瑞典", "TUN": "突尼斯",
    "BEL": "比利时", "EGY": "埃及", "IRN": "伊朗", "NZL": "新西兰",
    "ESP": "西班牙", "CPV": "佛得角", "KSA": "沙特阿拉伯", "URU": "乌拉圭",
    "FRA": "法国", "SEN": "塞内加尔", "IRQ": "伊拉克", "NOR": "挪威",
    "ARG": "阿根廷", "ALG": "阿尔及利亚", "AUT": "奥地利", "JOR": "约旦",
    "POR": "葡萄牙", "COD": "刚果(金)", "UZB": "乌兹别克斯坦", "COL": "哥伦比亚",
    "ENG": "英格兰", "CRO": "克罗地亚", "GHA": "加纳", "PAN": "巴拿马",
}

# ============================================================
# 3. 惯用脚生成（基于位置分布）
# ============================================================
def generate_preferred_foot(position):
    """基于位置生成符合足球规律的惯用脚"""
    r = random.random()
    if position == "GK":
        return "右脚" if r < 0.65 else "左脚"
    elif position == "CB":
        return "右脚" if r < 0.72 else "左脚"
    elif position == "LB":
        return "左脚" if r < 0.85 else "右脚"
    elif position == "RB":
        return "右脚" if r < 0.85 else "左脚"
    elif position == "CDM":
        return "右脚" if r < 0.75 else "左脚"
    elif position == "CM":
        return "右脚" if r < 0.73 else "左脚"
    elif position == "CAM":
        return "右脚" if r < 0.70 else "左脚"
    elif position == "LW":
        return "右脚" if r < 0.55 else "左脚"  # 内切边锋常见
    elif position == "RW":
        return "左脚" if r < 0.55 else "右脚"  # 内切边锋常见
    elif position == "ST":
        return "右脚" if r < 0.68 else "左脚"
    else:
        return "右脚" if r < 0.72 else "左脚"

# ============================================================
# 4. 俱乐部数据（按球队/联赛分组，用于填充缺失俱乐部）
# ============================================================
CLUB_POOL = {
    "MEX": ["美洲", "蒙特雷", "老虎", "蓝十字", "瓜达拉哈拉", "莱昂", "帕丘卡", "托卢卡"],
    "RSA": ["马梅洛迪日落", "奥兰多海盗", "凯撒酋长", "开普敦城"],
    "KOR": ["全北现代", "蔚山现代", "浦项制铁", "FC首尔", "水原三星"],
    "CZE": ["布拉格斯拉维亚", "布拉格斯巴达", "比尔森胜利"],
    "CAN": ["温哥华白帽", "多伦多FC", "CF蒙特利尔", "波特兰伐木者"],
    "BIH": ["萨拉热窝", "日林斯基", "莫斯塔尔"],
    "QAT": ["多哈萨德", "多哈杜海勒", "赖扬", "加拉法"],
    "SUI": ["年轻人", "巴塞尔", "苏黎世", "卢加诺"],
    "BRA": ["弗拉门戈", "帕尔梅拉斯", "圣保罗", "桑托斯", "弗鲁米嫩塞", "米内罗竞技", "博塔弗戈"],
    "MAR": ["卡萨布兰卡维达德", "拉贾卡萨布兰卡", "贝尔卡尼"],
    "HAI": ["紫罗兰", "海地竞技", "卡瓦利"],
    "SCO": ["凯尔特人", "流浪者", "阿伯丁", "哈茨", "希伯尼安"],
    "USA": ["洛杉矶FC", "迈阿密国际", "哥伦布机员", "辛辛那提FC", "亚特兰大联"],
    "PAR": ["奥林匹亚", "波特诺山丘", "自由", "亚松森国民"],
    "AUS": ["墨尔本城", "悉尼FC", "西悉尼流浪者", "阿德莱德联"],
    "TUR": ["加拉塔萨雷", "费内巴切", "贝西克塔斯", "特拉布宗体育", "巴沙克谢希尔"],
    "GER": ["拜仁慕尼黑", "多特蒙德", "莱比锡红牛", "勒沃库森", "斯图加特", "法兰克福", "沃尔夫斯堡"],
    "CUW": ["威廉斯塔德", "埃因霍温", "费耶诺德", "阿尔克马尔"],
    "CIV": ["阿比让竞技", "ASEC米莫萨"],
    "ECU": ["基多体育大学", "山谷独立", "巴塞罗那SC", "埃梅莱克"],
    "NED": ["阿贾克斯", "费耶诺德", "埃因霍温", "阿尔克马尔", "特温特"],
    "JPN": ["川崎前锋", "横滨水手", "浦和红钻", "神户胜利船", "鹿岛鹿角"],
    "SWE": ["马尔默", "埃夫斯堡", "赫根", "尤尔加登", "北雪平"],
    "TUN": ["突尼斯希望", "斯法克西恩", "非洲人"],
    "BEL": ["布鲁日", "安德莱赫特", "亨克", "安特卫普", "标准列日"],
    "EGY": ["开罗国民", "扎马雷克", "金字塔"],
    "IRN": ["波斯波利斯", "德黑兰独立", "塞帕汉", "拖拉机"],
    "NZL": ["惠灵顿凤凰", "奥克兰FC", "基督城联"],
    "ESP": ["皇家马德里", "巴塞罗那", "马德里竞技", "皇家社会", "毕尔巴鄂竞技", "比利亚雷亚尔", "塞维利亚"],
    "CPV": ["明德卢体育", "普拉亚体育"],
    "KSA": ["利雅得新月", "利雅得胜利", "吉达联合", "吉达国民", "青年人"],
    "URU": ["佩纳罗尔", "乌拉圭民族", "捍卫者竞技"],
    "FRA": ["巴黎圣日耳曼", "马赛", "里昂", "摩纳哥", "里尔", "朗斯", "雷恩"],
    "SEN": ["生成者", "迪亚拉夫", "皮金"],
    "IRQ": ["巴格达警察", "巴格达空军", "扎乌拉"],
    "NOR": ["博德闪耀", "莫尔德", "罗森博格", "布兰", "维京"],
    "ARG": ["河床", "博卡青年", "竞技", "独立", "萨斯菲尔德", "拉努斯"],
    "ALG": ["贝鲁兹达德", "USM阿尔及尔", "MC阿尔及尔"],
    "AUT": ["萨尔茨堡红牛", "格拉茨风暴", "维也纳快速", "林茨"],
    "JOR": ["安曼团结", "费萨里", "安曼"],
    "POR": ["本菲卡", "波尔图", "葡萄牙体育", "布拉加", "吉马良斯"],
    "COD": ["马泽姆贝", "维塔"],
    "UZB": ["棉农", "纳萨夫", "本尤德科"],
    "COL": ["麦德林国民竞技", "百万富翁", "巴兰基亚青年", "卡利美洲"],
    "ENG": ["曼城", "阿森纳", "利物浦", "曼联", "切尔西", "热刺", "纽卡斯尔联", "阿斯顿维拉"],
    "CRO": ["萨格勒布迪纳摩", "哈伊杜克", "里耶卡", "奥西耶克"],
    "GHA": ["阿桑特科托科", "橡树之心", "梅德埃马"],
    "PAN": ["阿拉伯联", "圣米格利托", "陶罗"],
}

def assign_club(player):
    """给没有俱乐部的球员分配合理的俱乐部"""
    team = player.get("team", "")
    position = player.get("position", "")
    club = player.get("club", "")
    if club:
        return club

    club_pool = CLUB_POOL.get(team, [])
    # 明星球员更可能在欧洲踢球
    is_star = player.get("isStar", False)
    name = player.get("name", "")

    if is_star and random.random() < 0.7:
        # 明星球员分配给欧洲大俱乐部
        top_clubs = [
            "皇家马德里", "巴塞罗那", "马德里竞技",
            "曼城", "阿森纳", "利物浦", "曼联", "切尔西", "热刺", "纽卡斯尔联",
            "拜仁慕尼黑", "多特蒙德", "勒沃库森", "莱比锡红牛",
            "巴黎圣日耳曼", "马赛", "摩纳哥",
            "国际米兰", "AC米兰", "尤文图斯", "那不勒斯", "亚特兰大",
            "本菲卡", "波尔图", "葡萄牙体育",
            "阿贾克斯", "埃因霍温", "费耶诺德",
        ]
        return random.choice(top_clubs)

    # 70% 概率在本国联赛, 30% 在其他联赛
    if random.random() < 0.7 and club_pool:
        return random.choice(club_pool)
    else:
        # 分配到各国中游俱乐部
        mid_clubs = [
            "狼队", "富勒姆", "布伦特福德", "水晶宫", "埃弗顿", "伯恩茅斯",
            "西汉姆联", "诺丁汉森林", "伯恩利", "南安普顿",
            "斯图加特", "法兰克福", "沃尔夫斯堡", "门兴", "霍芬海姆",
            "里昂", "里尔", "朗斯", "雷恩", "尼斯",
            "皇家社会", "比利亚雷亚尔", "贝蒂斯", "毕尔巴鄂竞技",
            "罗马", "拉齐奥", "佛罗伦萨", "博洛尼亚",
            "加拉塔萨雷", "费内巴切", "本菲卡", "埃因霍温",
            "凯尔特人", "萨尔茨堡红牛", "顿涅茨克矿工",
        ]
        return random.choice(mid_clubs)

# ============================================================
# 5. 主程序
# ============================================================

def main():
    # 读取 teams.json
    with open("src/data/teams.json", "r", encoding="utf-8") as f:
        teams_data = json.load(f)

    # 读取 players.json
    with open("src/data/players.json", "r", encoding="utf-8") as f:
        players_data = json.load(f)

    # 构建球员查找索引 (按 id)
    player_index = {}
    for p in players_data["players"]:
        # 确保新字段
        if "preferredFoot" not in p or not p["preferredFoot"]:
            p["preferredFoot"] = generate_preferred_foot(p["position"])
        if "nationality" not in p or not p["nationality"]:
            p["nationality"] = TEAM_NATIONALITY.get(p["team"], p["team"])
        if "club" not in p or not p.get("club"):
            p["club"] = assign_club(p)
        player_index[p["id"]] = p

    # 更新 teams.json
    for team in teams_data["teams"]:
        code = team["code"]

        # 更新教练为对象
        coach_info = COACH_DATA.get(code)
        if coach_info:
            team["coach"] = coach_info
        elif isinstance(team["coach"], str):
            team["coach"] = {
                "name": team["coach"],
                "nameEn": "",
                "nationality": TEAM_NATIONALITY.get(code, ""),
                "age": None,
                "since": ""
            }

        # 更新内嵌球员数据（添加详细信息）
        for player in team.get("players", []):
            pid = player.get("id", "")
            full_player = player_index.get(pid)
            if full_player:
                player["age"] = full_player.get("age")
                player["height"] = full_player.get("height")
                player["weight"] = full_player.get("weight")
                player["club"] = full_player.get("club")
                player["preferredFoot"] = full_player.get("preferredFoot")
                player["nationality"] = full_player.get("nationality")

    # 确保所有球员都有新字段
    for p in players_data["players"]:
        if "preferredFoot" not in p or not p.get("preferredFoot"):
            p["preferredFoot"] = generate_preferred_foot(p["position"])
        if "nationality" not in p or not p.get("nationality"):
            p["nationality"] = TEAM_NATIONALITY.get(p["team"], p["team"])
        if "club" not in p or not p.get("club"):
            p["club"] = assign_club(p)

    # 写入 teams.json
    with open("src/data/teams.json", "w", encoding="utf-8") as f:
        json.dump(teams_data, f, ensure_ascii=False, indent=2)
    print(f"✅ teams.json 已更新 ({len(teams_data['teams'])} 支球队)")

    # 写入 players.json
    players_data["lastUpdated"] = "2026-06-10T12:00:00Z"
    with open("src/data/players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, ensure_ascii=False, indent=2)
    print(f"✅ players.json 已更新 ({len(players_data['players'])} 名球员)")

    # 统计
    coach_count = sum(1 for t in teams_data["teams"] if isinstance(t.get("coach"), dict))
    print(f"  - 教练对象: {coach_count}/48")

    foot_count = sum(1 for p in players_data["players"] if p.get("preferredFoot"))
    nat_count = sum(1 for p in players_data["players"] if p.get("nationality"))
    club_count = sum(1 for p in players_data["players"] if p.get("club"))
    print(f"  - 惯用脚: {foot_count}/{len(players_data['players'])}")
    print(f"  - 国籍: {nat_count}/{len(players_data['players'])}")
    print(f"  - 俱乐部: {club_count}/{len(players_data['players'])}")

if __name__ == "__main__":
    main()
