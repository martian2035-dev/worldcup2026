#!/usr/bin/env python3
"""
扩展球员数据：将每队从 8-11 人扩展到 23-26 人（符合 FIFA 2026 大名单规则）
总目标：约 1246 名球员
"""

import json
import random
import copy

random.seed(2026)

# ============================================================
# 1. 姓名库（按语言/地区分组）
# ============================================================

# 拉丁美洲（西班牙语）- 用于 MEX, PAR, ECU, URU, ARG, COL, PAN, USA(部分)
LATAM_FIRST = [
    "卡洛斯", "路易斯", "米格尔", "安德烈斯", "迭戈", "费尔南多", "加布里埃尔", "拉斐尔",
    "塞巴斯蒂安", "丹尼尔", "亚历杭德罗", "胡安", "何塞", "哈维尔", "安东尼奥", "弗朗西斯科",
    "马蒂亚斯", "尼古拉斯", "费利佩", "罗德里戈", "马丁", "豪尔赫", "爱德华多", "阿尔瓦罗",
    "克里斯蒂安", "大卫", "埃米利奥", "比森特", "劳塔罗", "莱安德罗", "埃塞基耶尔", "法昆多",
    "赫尔曼", "吉列尔莫", "伊格纳西奥", "华金", "卢西亚诺", "马克西米利亚诺", "内斯托尔",
    "巴勃罗", "拉蒙", "圣地亚哥", "塞尔吉奥", "托马斯", "维克托", "哈维", "萨穆埃尔",
    "马科斯", "索尔", "胡里奥", "埃斯特万", "毛罗",
]
LATAM_LAST = [
    "加西亚", "罗德里格斯", "马丁内斯", "洛佩斯", "冈萨雷斯", "费尔南德斯", "佩雷斯", "桑切斯",
    "拉米雷斯", "托雷斯", "弗洛雷斯", "巴斯克斯", "莫拉莱斯", "门德斯", "埃雷拉", "卡斯特罗",
    "希门尼斯", "罗哈斯", "阿吉拉尔", "阿库尼亚", "贝尼特斯", "比达尔", "克鲁斯", "迪亚兹",
    "埃斯皮诺萨", "富恩特斯", "古斯曼", "伊巴涅斯", "莱昂", "梅迪纳", "莫利纳", "蒙特斯",
    "纳瓦罗", "奥尔特加", "帕拉西奥斯", "帕雷德斯", "里维拉", "萨尔加多", "索萨", "塔皮亚",
    "巴尔加斯", "贝拉斯克斯", "萨帕塔", "萨瓦拉", "阿雷利亚诺", "多明格斯",
]

# 巴西（葡萄牙语）
BRA_FIRST = [
    "卢卡斯", "加布里埃尔", "马特乌斯", "佩德罗", "维尼修斯", "布鲁诺", "古斯塔沃", "蒂亚戈",
    "拉斐尔", "若昂", "马科斯", "菲利佩", "里卡多", "爱德华多", "莱昂纳多", "卡约",
    "埃里克", "韦斯利", "迭戈", "雷南", "法布里西奥", "安德烈", "罗德里戈", "维托尔",
    "达尼洛", "阿利松", "埃德森", "马尔基尼奥斯", "米利唐", "布雷默", "吉列尔梅",
    "奥塔维奥", "道格拉斯", "亨里克", "伊戈尔", "杰斐逊", "若泽", "克莱伯", "路易斯",
    "内马尔", "拉蒙", "萨维奥", "万德松", "文德尔", "威廉",
]
BRA_LAST = [
    "席尔瓦", "桑托斯", "奥利维拉", "索萨", "利马", "佩雷拉", "科斯塔", "费雷拉",
    "阿尔维斯", "巴博萨", "卡瓦略", "戈麦斯", "阿劳霍", "特谢拉", "努内斯", "维埃拉",
    "马丁斯", "莫雷拉", "里贝罗", "阿尔梅达", "罗沙", "迪亚斯", "卡多索", "梅洛",
    "坎波斯", "蒙泰罗", "布里托", "科雷亚", "弗雷塔斯", "皮涅罗",
]

# 西欧 - 英语圈（ENG, SCO, USA, CAN, AUS, NZL）
ENG_FIRST = [
    "詹姆斯", "奥利弗", "杰克", "哈利", "查理", "乔治", "托马斯", "威廉",
    "本杰明", "丹尼尔", "亨利", "亚历山大", "卢卡斯", "梅森", "伊桑", "洛根",
    "诺亚", "利亚姆", "欧文", "卢克", "内森", "亚当", "瑞安", "乔丹",
    "卡勒姆", "芬利", "泰勒", "迪伦", "扎克", "凯尔",
]
ENG_LAST = [
    "布朗", "威尔逊", "安德森", "泰勒", "琼斯", "戴维斯", "米勒", "摩尔",
    "克拉克", "怀特", "沃克", "霍尔", "格林", "贝克", "希尔", "斯科特",
    "米切尔", "库珀", "金", "赖特", "埃文斯", "特纳", "菲利普斯", "坎贝尔",
    "帕克", "沃森", "伍德", "罗斯", "约翰逊", "汤普森",
]

# 日耳曼语系（GER, AUT, SUI(德语), NED, BEL(弗拉芒)）
GERMANIC_FIRST = [
    "卢卡斯", "马克西米利安", "菲利克斯", "莱昂", "诺亚", "埃利亚斯", "保罗", "约纳斯",
    "莫里茨", "蒂姆", "汤姆", "扬", "拉斯", "斯文", "弗洛里安", "塞巴斯蒂安",
    "托比亚斯", "马蒂亚斯", "马库斯", "斯特凡", "米夏埃尔", "托马斯", "凯", "尼尔斯",
    "帕特里克", "凯文", "丹尼斯", "巴斯", "维姆", "迪尔克",
]
GERMANIC_LAST = [
    "施密特", "穆勒", "韦伯", "瓦格纳", "贝克尔", "霍夫曼", "舍费尔", "科赫",
    "鲍尔", "里希特", "克劳斯", "沃尔夫", "诺伊曼", "施瓦茨", "齐默尔曼", "布劳恩",
    "克鲁格", "哈特曼", "朗格", "施密茨", "迈尔", "菲舍尔", "范戴克", "德容",
    "彼得斯", "扬森", "德弗里斯", "博斯", "斯密特", "费尔哈亨",
]

# 法语圈（FRA, BEL(法语), SUI(法语), HAI, 非洲法语区）
FRENCH_FIRST = [
    "雨果", "安托万", "特奥", "洛朗", "马蒂厄", "亚历山大", "尼古拉", "朱利安",
    "克莱芒", "阿德里安", "罗曼", "凯文", "克里斯托夫", "皮埃尔", "让", "让-克洛德",
    "穆萨", "阿马杜", "易卜拉欣", "奥斯曼", "帕佩", "伊斯梅尔", "塞古", "切克",
    "布巴卡尔", "马马杜", "阿卜杜拉耶", "拉西纳", "蒂埃莫科", "弗朗克",
]
FRENCH_LAST = [
    "马丁", "贝尔纳", "杜布瓦", "佩蒂", "罗伯特", "里夏尔", "杜兰德", "勒鲁瓦",
    "莫罗", "西蒙", "洛朗", "米歇尔", "勒费弗尔", "梅西耶", "方丹", "吉拉尔",
    "迪亚洛", "西塞", "图雷", "特拉奥雷", "库里巴利", "门迪", "萨科", "福法纳",
    "恩迪亚耶", "索乌", "卡马拉", "孔德", "巴卡约科", "苏马雷",
]

# 南欧（ESP, POR）
SOUTHERN_EURO_FIRST = [
    "巴勃罗", "马里奥", "鲁本", "伊尼戈", "乌奈", "艾托尔", "米克尔", "安德尔",
    "约恩", "伊克尔", "诺亚", "埃里克", "马克", "波尔", "奥里奥尔", "塞尔吉",
    "迪奥戈", "努诺", "鲁伊", "贡萨洛", "蒂亚戈", "法比奥", "安德烈", "里卡多",
    "贝尔纳多", "马特乌斯", "奥塔维奥", "雷纳托", "阿尔瓦罗", "乌戈",
]
SOUTHERN_EURO_LAST = [
    "加西亚", "费尔南德斯", "冈萨雷斯", "罗德里格斯", "洛佩斯", "桑切斯", "马丁内斯",
    "佩雷斯", "戈麦斯", "阿尔瓦雷斯", "莫雷诺", "希门尼斯", "托雷斯", "鲁伊斯",
    "努涅斯", "门德斯", "卡瓦略", "阿尔梅达", "佩雷拉", "科雷亚", "苏亚雷斯",
    "埃雷拉", "伊格莱西亚斯", "莫拉莱斯", "多明格斯", "卡斯特罗", "莱昂", "纳瓦罗",
    "奥尔蒂斯", "古铁雷斯",
]

# 斯拉夫/东欧（CZE, CRO, BIH）
SLAVIC_FIRST = [
    "扬", "彼得", "马丁", "托马斯", "帕维尔", "雅各布", "翁德雷", "沃伊捷赫",
    "伊万", "马尔科", "卢卡", "马特奥", "菲利普", "约西普", "安特", "伊戈尔",
    "马里奥", "博日达尔", "埃丁", "韦达德", "米拉莱姆", "哈里斯", "阿米尔", "阿德米尔",
    "塞亚德", "戈兰", "达米尔", "德拉甘", "兹德拉夫科", "克雷索",
]
SLAVIC_LAST = [
    "诺瓦克", "斯沃博达", "切尔尼", "霍拉克", "普罗哈兹卡", "库切拉", "耶利奇",
    "巴比奇", "克拉马里奇", "佩里西奇", "莫德里奇", "科瓦契奇", "布罗佐维奇",
    "茹科维奇", "伊万诺维奇", "普尔利奇", "霍吉奇", "哈伊洛维奇", "梅杜尼亚宁",
    "杜布拉夫卡", "马雷克", "波科尔尼", "西穆尼奇", "武科维奇", "什特帕内克",
    "贝兰", "西科拉", "日夫科维奇", "德沃夏克",
]

# 北欧（NOR, SWE）
NORDIC_FIRST = [
    "埃里克", "卡尔", "尼尔斯", "拉尔斯", "安德斯", "珀", "斯文", "古斯塔夫",
    "亨里克", "弗雷德里克", "马格努斯", "奥勒", "埃米尔", "维克托", "阿克塞尔",
    "马丁", "克里斯蒂安", "约纳斯", "马尔科", "安德烈亚斯", "埃尔林", "亚历山大",
    "埃斯彭", "霍瓦尔", "克里斯托弗", "莫滕", "奥德", "特里格弗", "维达尔",
]
NORDIC_LAST = [
    "汉森", "约翰森", "奥尔森", "拉森", "安德森", "佩德森", "尼尔森", "克里斯滕森",
    "埃里克森", "克努森", "马德森", "拉斯穆森", "贝里", "林德格伦", "埃克斯特伦",
    "永贝里", "斯特兰德", "伦德", "奥德加德", "索尔巴肯", "海于格", "厄斯蒂高",
    "内森", "布拉滕", "托马森", "林德斯特伦", "霍尔姆", "比约克", "诺德利",
]

# 中东/西亚（QAT, KSA, IRQ, JOR, IRN, EGY）
ARABIC_FIRST = [
    "穆罕默德", "阿里", "哈桑", "侯赛因", "阿卜杜拉", "奥马尔", "艾哈迈德", "马哈茂德",
    "优素福", "哈立德", "易卜拉欣", "塔里克", "萨米尔", "纳德", "法赫德", "萨勒曼",
    "卡里姆", "埃马德", "巴萨姆", "阿米尔", "拉米", "萨米", "阿什拉夫", "穆斯塔法",
    "哈马德", "贾西姆", "萨拉赫", "莫赫塔", "比拉尔", "瓦利德",
]
ARABIC_LAST = [
    "阿卜杜拉赫曼", "艾哈迈迪", "哈希米", "贾巴尔", "哈利法", "马哈茂迪",
    "纳赛尔", "卡塔尼", "拉希德", "萨利赫", "沙赫拉尼", "塔希尔", "扎赫拉尼",
    "阿尔-多萨里", "阿尔-沙拉尼", "阿巴斯", "阿米尔", "法里德", "加齐",
    "哈迪德", "伊萨", "卡迈勒", "曼苏尔", "卡西姆", "赛义德",
    "塔里克", "瓦赫迪", "扎卡里亚", "拉马丹", "沙班",
]

# 东亚（KOR, JPN）
EAST_ASIAN_FIRST_KR = [
    "金", "李", "朴", "崔", "郑", "姜", "赵", "尹",
    "张", "林", "吴", "韩", "安", "宋", "柳", "高",
]
EAST_ASIAN_LAST_KR = [
    "旻", "俊", "宇", "浩", "贤", "赫", "秀", "泰",
    "硕", "基", "荣", "范", "仁", "诚", "燮", "宰",
]

JPN_FIRST = [
    "翔太", "大翔", "蓮", "陽太", "悠真", "大和", "颯太", "樹",
    "大輝", "健太", "拓海", "優斗", "大輔", "誠", "翼", "洋介",
    "涼太", "隆", "武", "弘樹", "和也", "祐介", "亮", "翔",
    "直樹", "一郎", "二郎", "太郎", "浩二", "智也",
]
JPN_LAST = [
    "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村",
    "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上",
    "木村", "清水", "林", "斎藤", "森", "池田", "橋本", "阿部",
    "石川", "前田", "藤田", "後藤", "小川", "村上",
]

# 土耳其
TURKISH_FIRST = [
    "埃姆雷", "布拉克", "岑克", "哈坎", "凯雷姆", "奥尔昆", "梅里赫", "坚克",
    "厄梅尔", "优素福", "埃姆雷詹", "厄兹詹", "萨利赫", "阿尔达", "巴雷什",
    "德尼兹", "埃内斯", "格克汗", "伊斯梅尔", "穆拉特", "奥赞", "塞尔丘克",
    "塔伊丰", "乌穆特", "韦利", "亚瑟尔", "扎费尔", "泽基", "尤努斯",
]
TURKISH_LAST = [
    "伊尔马兹", "切利克", "厄兹詹", "恰尔汗奥卢", "卡赫韦吉", "于纳尔", "柯克曲",
    "德米拉尔", "阿克图尔科卢", "厄兹卡卡尔", "申图尔克", "巴延德尔", "萨里",
    "卡巴克", "于克塞克", "阿克巴巴", "托帕尔", "卡拉曼", "耶尔德勒姆",
    "厄兹德米尔", "阿伊登", "比林吉", "乔拉克", "达格代伦", "埃尔多安",
    "古莱尔", "哈斯波拉特", "凯莱什", "马勒特佩", "佩克泰梅克",
]

# 撒哈拉以南非洲（RSA, GHA, CPV）
AFRICAN_FIRST = [
    "奎西", "乔丹", "伦吉", "库杜斯", "穆罕默德", "安德烈", "塔佩洛", "博伊图梅洛",
    "西扬达", "泰博霍", "莱尔", "邦加尼", "伊诺克", "勒博冈", "珀西", "罗恩",
    "奇波", "滕达伊", "塔法兹瓦", "库德夸谢", "布巴卡尔", "吉布里尔", "拉明",
    "凯文", "埃里克", "克里斯", "帕特里克", "阿尔弗雷德", "艾萨克", "詹姆斯",
]
AFRICAN_LAST = [
    "杜贝", "祖马", "姆西比", "茨塔", "莫科纳", "姆瓦拉", "伦塞", "莫莱科",
    "马洛科", "莫索纳", "西比亚", "莫莱菲", "哈特什瓦约", "马巴索", "姆赫利泽",
    "阿尤", "门萨", "库马尔", "奥乌苏", "阿皮亚", "阿萨莫阿", "阿福库",
    "蒙泰罗", "席尔瓦", "塞梅多", "皮雷斯", "费尔南德斯", "塔瓦雷斯", "安德拉德",
]

# 中亚（UZB）
UZBEK_FIRST = [
    "埃尔多尔", "贾洛利丁", "胡斯尼丁", "奥塔别克", "阿齐兹别克", "鲁斯塔姆",
    "谢尔佐德", "多斯顿别克", "伊斯洛姆", "法鲁赫", "贾姆希德", "阿克马尔",
    "巴赫季约尔", "迪尔肖德", "伊克博尔", "贾苏尔", "科米尔", "拉夫尚",
    "萨尔多尔", "帖木儿", "乌卢格别克", "舒赫拉特", "扎法尔", "阿利舍尔",
    "博布尔", "达夫龙", "伊尔霍姆", "米尔贾莫ル", "桑贾尔",
]
UZBEK_LAST = [
    "卡里莫夫", "伊斯梅洛夫", "阿赫梅多夫", "图尔苏诺夫", "拉希莫夫", "哈萨诺夫",
    "尤苏波夫", "库尔班诺夫", "阿卜杜拉耶夫", "埃尔加舍夫", "伊布拉希莫夫",
    "米尔扎耶夫", "萨伊多夫", "霍贾耶夫", "法伊祖拉耶夫", "马马特库洛夫",
    "纳扎ロフ", "拉ジャボフ", "苏莱曼诺夫", "托什テミロフ",
]

# 库拉索（荷兰式命名）
CURACAO_FIRST = [
    "莱安德罗", "朱里恩", "儒尼尼奥", "布兰登", "肯吉", "吉利亚诺", "罗シェン",
    "エルトン", "ジャイロ", "ダリル", "ジェレミ", "ジュリエン", "シャノン",
    "ティリック", "ナサニエル", "ラモン", "レイヴァン", "リカルド", "リッチーノ",
    "ロマリオ", "シェルドン", "タイロン", "ジョシュア", "デンゼル", "ジェファーソン",
]
CURACAO_LAST = [
    "バクーナ", "アニタ", "マルティナ", "フライテル", "ジュスト", "ファンエイマ",
    "ベルナルドゥス", "ゴレ", "ヤンセン", "マリア", "ピーテルス", "ロザリオ",
    "スタティ", "テンペスト", "ファンケッセル", "アントニウス", "セルベラ",
    "デレイク", "ハスペルス", "クライファー",
]

# ============================================================
# 2. 位置分布模板（26 人大名单）
# ============================================================
# 合理的位置配比: 3 GK, 3 CB, 2 LB, 2 RB, 3 CDM, 3 CM, 2 CAM, 2 LW, 2 RW, 3 ST
SQUAD_TEMPLATE = {
    "GK": 3, "CB": 3, "LB": 2, "RB": 2,
    "CDM": 3, "CM": 3, "CAM": 2,
    "LW": 2, "RW": 2, "ST": 3,
}

# ============================================================
# 3. 身体数据生成参数
# ============================================================
BODY_PARAMS = {
    "GK":  {"age": (22, 38), "height": (185, 200), "weight": (78, 95)},
    "CB":  {"age": (21, 35), "height": (183, 198), "weight": (75, 92)},
    "LB":  {"age": (20, 33), "height": (172, 183), "weight": (65, 78)},
    "RB":  {"age": (20, 33), "height": (172, 183), "weight": (65, 78)},
    "CDM": {"age": (21, 34), "height": (175, 192), "weight": (70, 85)},
    "CM":  {"age": (20, 33), "height": (170, 188), "weight": (65, 82)},
    "CAM": {"age": (20, 33), "height": (168, 183), "weight": (62, 78)},
    "LW":  {"age": (19, 32), "height": (168, 183), "weight": (60, 78)},
    "RW":  {"age": (19, 32), "height": (168, 183), "weight": (60, 78)},
    "ST":  {"age": (19, 35), "height": (172, 195), "weight": (68, 90)},
}

# ============================================================
# 4. 名字生成函数
# ============================================================

def get_name_pool(team_code):
    """返回队伍对应的名字库"""
    latam = {"MEX", "PAR", "ECU", "URU", "ARG", "COL", "PAN"}
    english = {"ENG", "SCO", "USA", "CAN", "AUS", "NZL"}
    germanic = {"GER", "AUT", "NED"}
    french = {"FRA", "HAI", "CIV", "SEN", "COD", "ALG", "TUN", "MAR"}
    southern = {"ESP", "POR"}
    slavic = {"CZE", "CRO", "BIH"}
    nordic = {"NOR", "SWE"}
    arabic = {"QAT", "KSA", "IRQ", "JOR", "IRN", "EGY"}
    east_asian_kr = {"KOR"}
    east_asian_jp = {"JPN"}
    turkish = {"TUR"}
    african = {"RSA", "GHA", "CPV"}
    uzbek = {"UZB"}
    curacao = {"CUW"}
    brazil = {"BRA"}
    swiss = {"SUI"}
    belgium = {"BEL"}

    if team_code in latam:
        return ("latam", LATAM_FIRST, LATAM_LAST)
    elif team_code in brazil:
        return ("brazil", BRA_FIRST, BRA_LAST)
    elif team_code in english:
        return ("english", ENG_FIRST, ENG_LAST)
    elif team_code in germanic:
        return ("germanic", GERMANIC_FIRST, GERMANIC_LAST)
    elif team_code in french:
        return ("french", FRENCH_FIRST, FRENCH_LAST)
    elif team_code in southern:
        return ("southern", SOUTHERN_EURO_FIRST, SOUTHERN_EURO_LAST)
    elif team_code in slavic:
        return ("slavic", SLAVIC_FIRST, SLAVIC_LAST)
    elif team_code in nordic:
        return ("nordic", NORDIC_FIRST, NORDIC_LAST)
    elif team_code in arabic:
        return ("arabic", ARABIC_FIRST, ARABIC_LAST)
    elif team_code in east_asian_kr:
        return ("korean", EAST_ASIAN_FIRST_KR, EAST_ASIAN_LAST_KR)
    elif team_code in east_asian_jp:
        return ("japanese", JPN_FIRST, JPN_LAST)
    elif team_code in turkish:
        return ("turkish", TURKISH_FIRST, TURKISH_LAST)
    elif team_code in african:
        return ("african", AFRICAN_FIRST, AFRICAN_LAST)
    elif team_code in uzbek:
        return ("uzbek", UZBEK_FIRST, UZBEK_LAST)
    elif team_code in curacao:
        return ("curacao", CURACAO_FIRST, CURACAO_LAST)
    elif team_code in swiss:
        return ("swiss_germanic", GERMANIC_FIRST, GERMANIC_LAST)  # 瑞士德语区为主
    elif team_code in belgium:
        return ("belgian", FRENCH_FIRST + GERMANIC_FIRST, FRENCH_LAST + GERMANIC_LAST)
    else:
        return ("latam", LATAM_FIRST, LATAM_LAST)

def generate_name(team_code, existing_names):
    """生成一个不重复的球员名字"""
    _, first_pool, last_pool = get_name_pool(team_code)
    for _ in range(200):
        if team_code == "KOR":
            # 韩国名字格式：姓+双字名
            last = random.choice(first_pool)  # 韩国 first_pool 实际上是姓
            first = random.choice(last_pool) + random.choice(last_pool)
            name = last + first
        elif team_code == "JPN":
            # 日本名字格式：姓+名
            name = random.choice(last_pool) + random.choice(first_pool)
        else:
            name = random.choice(first_pool) + "·" + random.choice(last_pool)
        if name not in existing_names:
            return name
    # Fallback: add a number
    base = random.choice(first_pool) + "·" + random.choice(last_pool)
    for i in range(100):
        candidate = base + str(i)
        if candidate not in existing_names:
            return candidate
    return base + "X"

def generate_english_name(name_chinese):
    """从中文名生成音译英文名（简化处理）"""
    # 简单返回拼音风格的名字
    return name_chinese.replace("·", " ")

# ============================================================
# 5. 核心生成逻辑
# ============================================================

def generate_player(team_code, position, existing_ids, existing_names, existing_numbers, is_star=False):
    """生成一名新球员"""
    # ID
    base_id = team_code.lower() + "-" + position.lower()
    counter = 1
    while f"{base_id}-{counter}" in existing_ids:
        counter += 1
    pid = f"{base_id}-{counter}"
    existing_ids.add(pid)

    # 名字
    name = generate_name(team_code, existing_names)
    existing_names.add(name)
    name_en = generate_english_name(name)

    # 号码
    num = 1
    while num in existing_numbers:
        num += 1
    existing_numbers.add(num)

    # 身体数据
    params = BODY_PARAMS.get(position, BODY_PARAMS["CM"])
    age = random.randint(*params["age"])
    height = random.randint(*params["height"])
    weight = random.randint(*params["weight"])

    # 惯用脚
    if position == "LB":
        foot = "左脚" if random.random() < 0.85 else "右脚"
    elif position == "RB":
        foot = "右脚" if random.random() < 0.85 else "左脚"
    elif position == "RW":
        foot = "左脚" if random.random() < 0.55 else "右脚"
    elif position == "LW":
        foot = "右脚" if random.random() < 0.55 else "左脚"
    elif position == "GK":
        foot = "右脚" if random.random() < 0.65 else "左脚"
    elif position == "CB":
        foot = "右脚" if random.random() < 0.72 else "左脚"
    else:
        foot = "右脚" if random.random() < 0.72 else "左脚"

    # 俱乐部
    club = assign_club(team_code, position, is_star)

    # 国籍
    nationality = TEAM_NATIONALITY.get(team_code, team_code)

    return {
        "id": pid,
        "name": name,
        "nameEn": name_en,
        "team": team_code,
        "position": position,
        "number": num,
        "isStar": is_star,
        "stats": {
            "goals": 0, "penalties": 0, "assists": 0, "shots": 0,
            "shotsOnTarget": 0, "minutesPlayed": 0, "distanceKm": 0,
            "yellowCards": 0, "redCards": 0, "matchRatings": [],
        },
        "age": age,
        "height": height,
        "weight": weight,
        "preferredFoot": foot,
        "nationality": nationality,
        "club": club,
        "clubEn": "",
        "photoUrl": "",
    }

def assign_club(team_code, position, is_star):
    """分配俱乐部"""
    club_pool = CLUB_POOL.get(team_code, [])

    if is_star and random.random() < 0.7:
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

    if random.random() < 0.6 and club_pool:
        return random.choice(club_pool)

    mid_clubs = [
        "狼队", "富勒姆", "布伦特福德", "水晶宫", "埃弗顿", "伯恩茅斯",
        "西汉姆联", "诺丁汉森林", "伯恩利", "南安普顿",
        "斯图加特", "法兰克福", "沃尔夫斯堡", "门兴", "霍芬海姆",
        "里昂", "里尔", "朗斯", "雷恩", "尼斯",
        "皇家社会", "比利亚雷亚尔", "贝蒂斯", "毕尔巴鄂竞技",
        "罗马", "拉齐奥", "佛罗伦萨", "博洛尼亚",
        "加拉塔萨雷", "费内巴切", "本菲卡", "埃因霍温",
        "凯尔特人", "萨尔茨堡红牛", "顿涅茨克矿工", "布鲁日",
        "安德莱赫特", "年轻人", "巴塞尔", "奥林匹亚科斯",
        "贝尔格莱德红星", "萨格勒布迪纳摩", "哥本哈根",
    ]
    return random.choice(mid_clubs)

# ============================================================
# 6. TEAM_NATIONALITY 字典（本地定义，避免导入问题）
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
# 7. CLUB_POOL 字典（本地定义）
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

# ============================================================
# 8. 主程序
# ============================================================

def main():
    # 读取现有数据
    with open("src/data/teams.json", "r", encoding="utf-8") as f:
        teams_data = json.load(f)
    with open("src/data/players.json", "r", encoding="utf-8") as f:
        players_data = json.load(f)

    existing_players = players_data["players"]
    all_player_index = {p["id"]: p for p in existing_players}

    # 追踪已有的名字和 ID 避免重复
    existing_ids = set(p["id"] for p in existing_players)
    existing_names = set(p["name"] for p in existing_players)

    total_new = 0
    new_players_all = []

    for team in teams_data["teams"]:
        code = team["code"]
        current_players = team.get("players", [])

        # 分析现有位置分布
        current_positions = {}
        for p in current_players:
            pos = p.get("position", "")
            current_positions[pos] = current_positions.get(pos, 0) + 1

        # 计算还需要多少球员
        target_per_position = dict(SQUAD_TEMPLATE)
        needed = {}
        for pos, target in target_per_position.items():
            have = current_positions.get(pos, 0)
            if have < target:
                needed[pos] = target - have

        # 收集已有的号码
        existing_numbers = set(p.get("number", 0) for p in current_players)

        # 为球队生成新球员
        team_new_players = []
        for pos, count in needed.items():
            for _ in range(count):
                new_p = generate_player(code, pos, existing_ids, existing_names, existing_numbers,
                                        is_star=(len(team_new_players) < 2 and random.random() < 0.3))
                team_new_players.append(new_p)
                all_player_index[new_p["id"]] = new_p

        # 更新 team.players
        for p in team_new_players:
            team["players"].append({
                "id": p["id"],
                "name": p["name"],
                "nameEn": p["nameEn"],
                "position": p["position"],
                "number": p["number"],
                "isStar": p["isStar"],
                "age": p["age"],
                "height": p["height"],
                "weight": p["weight"],
                "club": p["club"],
                "preferredFoot": p["preferredFoot"],
                "nationality": p["nationality"],
            })

        new_players_all.extend(team_new_players)
        total_new += len(team_new_players)

    # 更新 players.json
    players_data["players"].extend(new_players_all)
    players_data["lastUpdated"] = "2026-06-10T14:00:00Z"

    # 写入
    with open("src/data/teams.json", "w", encoding="utf-8") as f:
        json.dump(teams_data, f, ensure_ascii=False, indent=2)
    print(f"✅ teams.json 已更新 ({len(teams_data['teams'])} 支球队)")

    with open("src/data/players.json", "w", encoding="utf-8") as f:
        json.dump(players_data, f, ensure_ascii=False, indent=2)
    print(f"✅ players.json 已更新 ({len(players_data['players'])} 名球员)")

    # 统计
    print(f"\n📊 统计:")
    print(f"  原有球员: {len(existing_players)}")
    print(f"  新增球员: {total_new}")
    print(f"  总计: {len(players_data['players'])}")
    for team in teams_data["teams"]:
        print(f"  {team['code']} {team['name']}: {len(team['players'])} 人")

if __name__ == "__main__":
    main()
