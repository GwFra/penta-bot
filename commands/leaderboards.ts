// Eventual DB call to get all the stats
// import { getLeaderboard } from "../services/leaderboard.ts";
import { renderTable } from "../utils/table.ts";
import type { Command } from "../types/command.ts";

const leaderboard: Command = {
  name: "leaderboard",
  async execute(message) {
    const reply = await message.reply("Building leaderboard...");
    // const data = await getLeaderboard();

    // if (!data.length) {
    //   return void reply.edit("No stats recorded yet.");
    // }

    const data = [
      {
        discordName: "gwfranklin",
        pentas: 0,
        pentasStolen: 4,
        pentasLost: 2,
        snowballsMissed: 32,
      },
      {
        discordName: "Nyero",
        pentas: 2,
        pentasStolen: 1,
        pentasLost: 0,
        snowballsMissed: 2,
      },
    ];

    const headers = ["Player", "Pentas", "Stolen", "Lost", "SB Missed"];
    const rows = data.map((u) => [
      u.discordName,
      u.pentas,
      u.pentasStolen,
      u.pentasLost,
      u.snowballsMissed,
    ]);

    const table = renderTable(headers, rows);
    await reply.edit("```\n" + table + "\n```");
  },
};

export default leaderboard;
