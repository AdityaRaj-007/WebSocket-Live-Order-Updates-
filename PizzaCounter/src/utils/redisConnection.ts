import Redis from "ioredis";

const redisConfig = {
  port: 6379,
  host: "127.0.0.1",
  maxRetriesPerRequest: null,
};

const redisConnection = new Redis(redisConfig);

export default redisConnection;
