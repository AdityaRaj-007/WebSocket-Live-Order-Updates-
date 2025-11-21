import { Queue } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import redisConnection from "./utils/redisConnection.js";

const pizzaQueue = new Queue("pizza-queue", { connection: redisConnection });

const addOrders = async () => {
  console.log("🎟️  Adding 100 pizza orders to the queue...");

  for (let i = 1; i <= 100; i++) {
    await pizzaQueue.add("pizza-order", {
      orderId: uuidv4(),
    });
  }

  console.log("✅ All 100 orders added!");
  console.log("👉 Now run: node worker.js to process them.");
  process.exit(0);
};

addOrders();
