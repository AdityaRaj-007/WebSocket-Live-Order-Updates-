import http from "http";
import WebSocket from "ws";

// Configuration
const HOST = "localhost";
const PORT = 3000;
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
      // Keep socket alive, limit to 1 to force reuse
      agent: new http.Agent({ keepAlive: true, maxSockets: 1 }),
    },
    (res) => {
      // --- FIX IS HERE ---
      // Capture the socket IMMEDIATELY, before the response body is consumed.
      // Waiting for 'end' is too late in Node v22+.
      const socket = res.socket;

      if (!socket) {
        console.error("❌ Immediate Error: Socket not found on response.");
        return;
      }

      // Prevent the Agent from destroying/recycling this socket automatically
      socket.removeAllListeners("timeout");
      socket.setTimeout(0);

      let buffer = "";
      res.on("data", (chunk) => (buffer += chunk));

      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.error(`❌ Server Error: ${res.statusCode}`);
          return;
        }

        try {
          const data = JSON.parse(buffer);
          const orderId = data.orderId;
          console.log(`🟢 2. Order Created! ID: ${orderId}`);
          console.log(
            `🔌 Socket Info: Local Port ${socket.localPort} (Reusing connection)`
          );

          console.log(`🔵 3. Upgrading to WebSocket...`);

          // Small delay to allow HTTP parser to detach cleanly
          setTimeout(() => {
            const wsUrl = `ws://${HOST}:${PORT}${ENDPOINT}?orderId=${orderId}`;

            // Cast options to 'any' to bypass TS check
            const ws = new WebSocket(wsUrl, { socket: socket } as any);

            ws.on("open", () => {
              console.log("🟢 4. WebSocket Connected successfully!");
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

            ws.on("error", (e: Error) => {
              console.error("❌ WebSocket Error:", e.message);
            });

            ws.on("close", () => {
              console.log("🔴 WebSocket Closed");
            });
          }, 100); // 100ms delay for safety
        } catch (e) {
          console.error("❌ Parse Error:", e);
        }
      });
    }
  );

  req.on("error", (e) => console.error("❌ Request Error:", e));

  req.write(JSON.stringify({ symbol: "BTC", amount: 0.5 }));
  req.end();
}

submitAndWatchOrder();
