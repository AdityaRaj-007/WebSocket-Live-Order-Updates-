import { parentPort } from "worker_threads";

// interface Job {
//   orderId: string;
//   steps: { status: string; delay: number }[];
// }

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

parentPort?.on("message", async (job) => {
  const { orderId, steps } = job;

  for (const step of steps) {
    await sleep(step.delay);

    parentPort.postMessage({
      orderId,
      status: step.status,
      timestamp: new Date().toISOString(),
    });
  }

  parentPort.postMessage({
    orderId,
    done: true,
  });
});
