import http from "http";
import WebSocket from "ws";

// Configuration
const HOST = "localhost";
const PORT = 3000;
// MAKE SURE THIS MATCHES YOUR SERVER.TS EXACTLY
const ENDPOINT = "/api/orders";

function submitAndWatchOrder() {
  console.log(`🔵 1. Submitting Order via HTTP POST to ${ENDPOINT}...`);

  const req = http.request(
    {
      host: HOST,
      port: PORT,
      path: ENDPOINT,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "keep-alive",
      },
      agent: new http.Agent({ keepAlive: true, maxSockets: 1 }),
    },
    (res) => {
      const socket = res.socket;

      let buffer = "";
      res.on("data", (chunk) => (buffer += chunk));

      res.on("end", () => {
        // --- DEBUGGING: CHECK STATUS CODE ---
        if (res.statusCode !== 200) {
          console.error(
            `❌ Server responded with Status Code: ${res.statusCode}`
          );
          console.error(`❌ Response Body: \n${buffer}`);
          console.error(
            "👉 Hint: Check if SERVER path and CLIENT path match exactly."
          );
          return;
        }

        try {
          const data = JSON.parse(buffer);
          const orderId = data.orderId;

          console.log(`🟢 2. Order Created! ID: ${orderId}`);

          console.log(
            `🔌 Socket Info: Local Port ${socket?.localPort} (Reusing this connection)`
          );

          console.log(`🔵 3. Upgrading to WebSocket on SAME endpoint...`);

          const wsUrl = `ws://${HOST}:${PORT}${ENDPOINT}?orderId=${orderId}`;

          // Cast to 'any' to fix TS error
          const ws = new WebSocket(wsUrl, { socket: socket } as any);

          ws.on("open", () => {
            console.log("🟢 4. WebSocket Connected!");
          });

          ws.on("message", (msg: Buffer) => {
            const update = JSON.parse(msg.toString());
            console.log(
              `📩 UPDATE: [${update.status.toUpperCase()}] at ${
                update.timestamp
              }`
            );

            if (update.status === "delivered" || update.status === "failed") {
              console.log("🏁 Order finished. Closing.");
              ws.close();
            }
          });

          ws.on("error", (e: Error) => console.error("WS Error", e));

          ws.on("close", () => {
            console.log("🔴 WebSocket Closed");
          });
        } catch (e) {
          console.error("❌ JSON Parse Error:", e);
          console.log("Raw Buffer:", buffer);
        }
      });
    }
  );

  req.write(JSON.stringify({ symbol: "BTC", amount: 0.5 }));
  req.end();
}

submitAndWatchOrder();
