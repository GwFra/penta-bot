import { obtainResults } from "../utils/update.js";

export default {
  name: "penta",
  async execute(message) {
    const res = await obtainResults();
    message.reply(`Penta/Quad data: ${JSON.stringify(res)}`);
  },
};
