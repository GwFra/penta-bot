import type { Command } from "../types/command.ts";

const ping: Command = {
  name: "ping",
  execute(message) {
    message.reply("Pong!");
  },
};

export default ping;
