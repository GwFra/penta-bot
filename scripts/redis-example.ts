import { redis } from "../redis/index.ts";

const key = "example_party_id";

await redis.hset(key, {
  discord_id_1: "puuid-example-1",
  discord_id_2: "puuid-example-2",
});

const result = await redis.hgetall(key);

console.log(result["discord_id_1"]);
console.log(Object.entries(result));
console.log(Object.values(result));

process.exit(0);
