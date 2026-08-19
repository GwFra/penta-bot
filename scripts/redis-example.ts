import { redis } from "../redis/index.ts";

const key = "example_party_id";

await redis.hset(key, {
  discord_id_1: "puuid-example-1",
  discord_id_2: "puuid-example-2",
  // updated_at: Date.now().toString(),
  updated_at: 1234,
});

await redis.hset(key, {
  discord_id_1: "puuid-example-1",
  discord_id_2: "puuid-example-2",
  discord_id_3: "puuid-example-3",
  updated_at: 4321,
});

const result = await redis.hgetall(key);

console.log(result["discord_id_1"]);
console.log(Object.entries(result));
console.log(Object.values(result));
console.log(new Date(Number(result["updated_at"])));

process.exit(0);
