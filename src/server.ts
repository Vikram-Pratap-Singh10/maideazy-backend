import express from 'express';
import cors from 'cors';
import cron from "node-cron";
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import 'dotenv/config';
import { setupSocketHandlers, startBookingTimer, extendBookingTimer } from './socket/socketHandler.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { razorpayWebhook } from './controllers/paymentController.js';


const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH"]
  }
});

// Setup socket handlers
setupSocketHandlers(io);

// Webhook razorpay
app.post(
  '/api/paymets/webbook',
  express.raw({ type: 'application/json' }),
  razorpayWebhook
);


// Middlewares
app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
// app.use(limiter);

// Static uploads folder
app.use('/uploads', express.static('uploads'));

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import maidRoutes from './routes/maids.js';
import serviceRoutes from './routes/services.js';
import maidAvailabilityRoutes from './routes/maidAvailability.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import reviewRoutes from './routes/reviews.js';
import adminRoutes from "./routes/admin.js";
import messageRoutes from "./routes/messages.js";
import favoriteRoutes from "./routes/favorites.js";
import offerRoutes from "./routes/offers.js";
import arrivalConfigRoutes from "./routes/arrivalConfigs.js";
import timeSlotRoutes from "./routes/timeSlots.js";
import SettingRoutes from "./routes/setting.js";
import BannerRoutes from "./routes/banner.js"
import buildingRoutes from "./routes/buildings.js";
import reportRoutes from "./routes/reports.js";
import attendanceRoutes from "./routes/attendance.js"
import notificationRoutes from "./routes/notifications.js"
import appVersionRoutes from "./routes/appVersion.js";
import override from "./routes/override.js";
import connectDB from './config/database.js';
import { autoCancelPendingBookings, updateBookingPaymentStatus, updateUserAddressWithBuilding } from './controllers/bookingController.js';
import { sendAppUpdateNotification } from './utils/firebase.js';



app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/maids', maidRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/availability', maidAvailabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/favorite", favoriteRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/arrival-configs", arrivalConfigRoutes);
app.use("/api/time-slots", timeSlotRoutes);
app.use("/api/settings", SettingRoutes);
app.use("/api/banners", BannerRoutes)
app.use("/api/app-version", appVersionRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/attendances", attendanceRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/override", override)

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Export functions for use in controllers
export { io, startBookingTimer, extendBookingTimer };

app.use("/", (req, res) => {
  res.send("Hello World")
})

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database
    await connectDB();
    // console.log(' Database connection established');

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // console.log(`API Base URL: http://localhost:${PORT}/api`);
    });

    cron.schedule("0 */6 * * *", async () => {
    // cron.schedule("* * * * *", async () => {
      console.log("Running app update notification cron...");
      await sendAppUpdateNotification();
    });

  } catch (error) {
    console.error(' Failed to start server:', (error as Error).message);
    console.log('\n Try running: npm run setup-db');
    process.exit(1);
  }
}
// cron job
// autoCancelPendingBookings();
updateUserAddressWithBuilding();
// updateBookingPaymentStatus();

startServer();
