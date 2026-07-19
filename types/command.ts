import type { Message } from "discord.js";

export interface Command {
  name: string;
  execute(message: Message, args: string[]): void | Promise<void>;
}
