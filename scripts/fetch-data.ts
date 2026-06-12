#!/usr/bin/env tsx
/**
 * 世界杯数据抓取主脚本
 *
 * 用法:
 *   pnpm run fetch-data              # 完整数据更新
 *   pnpm run fetch-data -- --squads  # 仅更新大名单
 *   pnpm run fetch-data -- --stats   # 仅更新比赛统计
 *   pnpm run fetch-data -- --report  # 显示数据报告
 *   pnpm run fetch-data -- --import <file>  # 从文件导入
 *
 * 数据流:
 *   FIFA API → update-squads.ts → players.json / teams.json
 *   FIFA API → update-matches.ts → matches.json / public/matches.json
 *   FIFA API → update-stats.ts   → players.json / matches.json
 *
 * 当 FIFA API 不可用时（FIFA_SEASON_ID 未配置），
 * 使用本地数据进行增量更新。
 */

import fs from "node:fs";
import path from "node:path";
import { updateSquadsFromFifa, updateSquadsFromFile, syncTeamsEmbeddedPlayers, getSquadReport, deduplicatePlayersByEnglishName, capTeamPlayers } from "./update-squads";
import { updateMatchesFromFifa } from "./update-matches";
import { updateStatsFromMatches, updateStatsFromFifa, printStatsReport } from "./update-stats";
import { updateStandingsFromMatches } from "./update-standings";
import { isApiConfigured, getSeasonId } from "./fifa-client";
import type { DataUpdateStatus } from "../src/types";

const DATA_DIR = path.resolve("src/data");

// ============================================================
// CLI 参数解析
// ============================================================

function parseArgs(): {
  squadsOnly: boolean;
  statsOnly: boolean;
  reportOnly: boolean;
  importFile: string | null;
} {
  const args = process.argv.slice(2);
  return {
    squadsOnly: args.includes("--squads"),
    statsOnly: args.includes("--stats"),
    reportOnly: args.includes("--report"),
    importFile: args.find((_, i) => args[i - 1] === "--import") || null,
  };
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const startTime = Date.now();
  const args = parseArgs();

  console.log("=" .repeat(50));
  console.log("🏆 World Cup 2026 - 数据抓取系统");
  console.log("=" .repeat(50));
  console.log(`⏰ 开始时间: ${new Date().toISOString()}`);
  console.log(`📡 API 状态: ${isApiConfigured() ? `已配置 (赛季 ${getSeasonId()})` : "未配置 (离线模式)"}`);

  const status: DataUpdateStatus = {
    lastUpdated: new Date().toISOString(),
    dataSource: isApiConfigured() ? "FIFA API" : "本地数据",
    playersUpdated: 0,
    matchesUpdated: 0,
    errors: [],
  };

  // -- 仅报告模式 --
  if (args.reportOnly) {
    getSquadReport();
    printStatsReport();
    return;
  }

  // -- 文件导入模式 --
  if (args.importFile) {
    const result = await updateSquadsFromFile(args.importFile);
    if (result) {
      syncTeamsEmbeddedPlayers();
      status.playersUpdated = result.total;
    }
    console.log(`\n✅ 导入完成 (${(Date.now() - startTime) / 1000}s)`);
    return;
  }

  // -- 大名单更新 --
  if (!args.statsOnly) {
    console.log("\n📋 步骤 1/3: 更新球员大名单");
    console.log("-".repeat(40));

    try {
      let result = null;

      // 优先从 FIFA API 获取
      if (isApiConfigured()) {
        result = await updateSquadsFromFifa();
      }

      // FIFA API 不可用时，用本地数据
      if (!result) {
        console.log("  ℹ 使用本地球员数据（FIFA API 将在比赛期间自动启用）");
      }

      if (result) {
        status.playersUpdated = result.total;
      }

      // 同步 teams.json
      syncTeamsEmbeddedPlayers();

      // 清理重复球员（generated + FIFA 去重）
      const dedupResult = deduplicatePlayersByEnglishName();
      // 清理超出 26 人上限的多余生成球员
      const capResult = capTeamPlayers();
      if (dedupResult.removed > 0 || capResult.removed > 0) {
        syncTeamsEmbeddedPlayers();
        console.log(`  🧹 清理完成: 去重 ${dedupResult.removed} + 上限清理 ${capResult.removed} 人`);
      }
    } catch (err: any) {
      status.errors!.push(`大名单更新失败: ${err.message}`);
      console.error(`  ❌ 大名单更新失败: ${err.message}`);
    }
  }

  // -- 比赛统计更新 --
  if (!args.squadsOnly) {
    console.log("\n📊 步骤 2/3: 更新比赛统计");
    console.log("-".repeat(40));

    try {
      if (isApiConfigured()) {
        const matchesResult = await updateMatchesFromFifa();
        if (matchesResult) {
          status.matchesUpdated = matchesResult.updated;
        }
      }

      // 先从本地 match 数据更新（playerEvents -> matchLog -> stats）
      const result = updateStatsFromMatches();
      status.matchesUpdated += result.matchesProcessed;

      // 再尝试从 FIFA API 补充
      if (isApiConfigured()) {
        await updateStatsFromFifa();
      }

      if (result.updated > 0) {
        console.log(`  ✅ 比赛统计更新完成`);
      }

      updateStandingsFromMatches();
    } catch (err: any) {
      status.errors!.push(`统计更新失败: ${err.message}`);
      console.error(`  ❌ 统计更新失败: ${err.message}`);
    }
  }

  // -- 写入更新状态 --
  console.log("\n💾 步骤 3/3: 保存更新状态");
  console.log("-".repeat(40));

  const statusPath = path.join(DATA_DIR, ".update-status.json");
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  console.log("  ✅ 更新状态已保存");

  // -- 完成 --
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "=".repeat(50));
  console.log(`✅ 数据抓取完成 (${elapsed}s)`);
  console.log(`   ${"─".repeat(30)}`);
  console.log(`   数据源:   ${status.dataSource}`);
  console.log(`   球员更新: ${status.playersUpdated}`);
  console.log(`   比赛处理: ${status.matchesUpdated}`);
  if (status.errors?.length) {
    console.log(`   ⚠ 错误:   ${status.errors.length} 个`);
    status.errors.forEach((e) => console.log(`     - ${e}`));
  }
  console.log("=" .repeat(50));

  // -- 可选：打印报告 --
  if (args.squadsOnly) getSquadReport();
  if (args.statsOnly) printStatsReport();
}

main().catch((err) => {
  console.error("❌ 数据抓取失败:", err);
  process.exit(1);
});
