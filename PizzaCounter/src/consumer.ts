import { Worker } from "bullmq";
import redisConnection from "./utils/redisConnection.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const worker = new Worker(
  "pizza-queue",
  async (job) => {
    console.log(`[Processing] Order ${job.data.orderId} `);

    await sleep(1000);

    console.log(`Order ${job.data.orderId} finished`);
    return { status: "ready", orderId: job.data.orderId };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

console.log("👷 Worker started! Waiting for orders...");
console.log("   (Counters set to 5)");

worker.on("completed", (job) => {
  console.log(`Delivered order: ${job.data.orderId}`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.data.orderId} failed with ${err}`);
});
