export default {
  name: "hello",
  execute(message) {
    message.reply(`Hello, ${message.author.username}!`);
  },
};
