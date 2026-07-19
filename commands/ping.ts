import type { Command } from "../types/command.js";

const ping: Command = {
  name: "ping",
  execute(message) {
    message.reply("Pong!");
  },
};

export default ping;
