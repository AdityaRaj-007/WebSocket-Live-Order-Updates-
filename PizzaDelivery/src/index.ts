import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import { Worker } from "worker_threads";
import path from "path";

type OrderStatus = "pending" | "preparing" | "delivered" | "failed";

interface OrderState {
  id: string;
  symbol: string;
  amount: number;
  status: OrderStatus;
  socket?: WebSocket;
}

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

const server = http.createServer(app);

const websocket = new WebSocketServer({ noServer: true });

const orders = new Map<string, OrderState>();

const startOrderProcessing = (orderId: string) => {
  //   const processStep = (
  //     status: OrderStatus,
  //     delay: number,
  //     next?: () => void
  //   ) => {
  //     setTimeout(() => {
  //       const order = orders.get(orderId);

  //       if (!order) return;

  //       order.status = status;

  //       console.log(`Order ${orderId}, status changed to: ${status}`);

  //       if (order.socket && order.socket.readyState === WebSocket.OPEN) {
  //         order.socket.send(
  //           JSON.stringify({
  //             orderId,
  //             status,
  //             timestamp: new Date().toISOString(),
  //           })
  //         );
  //       }

  //       if (next) next();

  //       if (status === "delivered" || status === "failed") {
  //         if (order.socket) order.socket.close();
  //         orders.delete(orderId);
  //       }
  //     }, delay);
  //   };

  //   processStep("pending", 500, () => {
  //     processStep("preparing", 2000, () => {
  //       processStep("delivered", 5000);
  //     });
  //   });
  const worker = new Worker(path.resolve(__dirname, "orderWorker.js"));

  worker.postMessage({
    orderId,
    steps: [
      {
        status: "pending",
        delay: 1000,
      },
      { status: "preparing", delay: 2000 },
      { status: "delivered", delay: 5000 },
    ],
  });

  worker.on("message", (msg) => {
    const order = orders.get(orderId);

    if (!order) return;

    if (msg.status) {
      order.status = msg.status;

      console.log(`Worker update: ${orderId} -> ${msg.status}`);

      if (order.socket && order.socket.readyState === WebSocket.OPEN) {
        order.socket.send(JSON.stringify(msg));
      }
    }
  });
};

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url!, `http://${request.headers.host}`);

  if (url.pathname === "/api/orders") {
    const orderId = url.searchParams.get("orderId");

    if (!orderId || !orders.has(orderId)) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    websocket.handleUpgrade(request, socket, head, (ws) => {
      const order = orders.get(orderId);

      if (order) {
        order.socket = ws;
        console.log(`Connection upgraded on /api/order for order ${orderId}`);
      }
    });
  } else {
    socket.destroy();
  }
});

app.post("/api/orders", (req: Request, res: Response) => {
  const { symbol, amount } = req.body;

  if (!symbol || !amount) {
    res.status(400).json({ error: "Invalid order data!" });
    return;
  }
  const orderId = uuidv4();

  orders.set(orderId, {
    id: orderId,
    symbol,
    amount,
    status: "pending",
  });

  console.log(`📝 Order received, ID: ${orderId}`);

  res.writeHead(200, {
    "Content-Type": "application/json",
    Connection: "keep-alive",
    "Keep-Alive": "timeout=10",
  });

  res.end(
    JSON.stringify({
      orderId,
      message: "Order accepted. Please upgrade to WebSocket on this endpoint.",
    })
  );

  console.log(`Starting process for ${orderId}`);

  startOrderProcessing(orderId);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
