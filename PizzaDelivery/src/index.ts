import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

const server = http.createServer(app);

const websocket = new WebSocketServer({ noServer: true });

const orderSubscriptions = new Map<string, WebSocket>();

websocket.on("connection", (ws: WebSocket, request: http.IncomingMessage) => {
  console.log("New Client connected!");

  const url = new URL(request.url!, `http://${request.headers.host}`);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    ws.close();
    return;
  }

  console.log(`Websocket connection established for order: ${orderId}`);
  orderSubscriptions.set(orderId, ws);

  ws.on("close", () => {
    console.log("Client disconnected!");
    orderSubscriptions.delete(orderId);
  });
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url!, `http://${request.headers.host}`);

  if (url.pathname === "/order/stream") {
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      socket.destroy();
      return;
    }

    websocket.handleUpgrade(request, socket, head, (ws) => {
      websocket.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

const broadcastStatus = (orderId: string, status: string) => {
  const subscribers = orderSubscriptions.get(orderId);

  if (subscribers && subscribers.readyState === WebSocket.OPEN) {
    console.log('Connection is live let"s send order updates!');
    subscribers.send(
      JSON.stringify({
        orderId,
        status,
        timestamp: new Date().toISOString(),
      })
    );
  }
};

app.post("/order", (req: Request, res: Response) => {
  const orderId = uuidv4();

  res.json({
    message: "Order placed",
    orderId: orderId,
    upgradeUrl: `/order/stream?orderId=${orderId}`,
  });

  console.log(`Starting process for ${orderId}`);

  setTimeout(() => broadcastStatus(orderId, "pending"), 100000);

  setTimeout(() => {
    broadcastStatus(orderId, "preparing");
  }, 200000);

  setTimeout(() => {
    broadcastStatus(orderId, "delivered");
    const ws = orderSubscriptions.get(orderId);

    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`Closing websocket connection for order ${orderId}`);
      ws.close();
    }

    orderSubscriptions.delete(orderId);
  }, 250000);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
